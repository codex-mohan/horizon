/**
 * Chat Hook - Wrapper around LangGraph SDK's useStream
 *
 * Provides a full-featured interface for chat functionality including:
 * - Message streaming
 * - Branching (edit, regenerate, switch branches)
 * - Optimistic updates
 * - Event processing
 */

import { useCallback, useRef, useState, useEffect, useMemo } from "react";
import { useStream } from "@langchain/langgraph-sdk/react";
import type { Message } from "@langchain/langgraph-sdk";

// ============================================================================
// TYPES
// ============================================================================

export interface ChatError {
  type: "rate_limit" | "server_error" | "network_error" | "unknown";
  message: string;
  lastMessageContent?: string;
  details?: unknown;
}

export interface ProcessedEvent {
  title: string;
  data: string;
  icon?: string;
  timestamp?: number;
}

export interface MessageMetadata {
  firstSeenState?: {
    parent_checkpoint?: { checkpoint_id: string };
  };
  branch?: string;
  branchOptions?: string[];
  // Stream metadata for multi-agent support
  streamMetadata?: {
    langgraph_node?: string;
  };
}

export interface UseChatOptions {
  apiUrl: string;
  assistantId: string;
  threadId?: string | null;
  userId?: string;
  onThreadId?: (threadId: string) => void;
  onError?: (error: ChatError) => void;
  onEvent?: (event: Record<string, unknown>) => void;
  onInterrupt?: (interrupt: Record<string, unknown>) => void;
  fetchStateHistory?: boolean;
}

export interface SubmitOptions {
  checkpoint?: { checkpoint_id: string };
  threadId?: string;
  optimisticValues?: (prev: ChatState) => ChatState;
  metadata?: Record<string, unknown>;
}

export interface UseChatReturn {
  messages: Message[];
  isLoading: boolean;
  error: unknown;
  threadId: string | undefined;
  lastEvent: Record<string, unknown> | null;

  // UI state for generative UI
  ui: UIMessage[];

  // Interrupt handling
  interrupt: Record<string, unknown> | null;
  isWaitingForInterrupt: boolean;

  // Core actions
  submit: (
    input: { messages: Array<{ type: string; content: string }> } | undefined,
    options?: SubmitOptions,
  ) => void;
  stop: () => void;

  // Interrupt actions
  approveInterrupt: () => void;
  rejectInterrupt: (reason?: string) => void;

  // Branching support
  getMessagesMetadata: (message: Message) => MessageMetadata | null;
  getToolCalls: (message: any) => any[];
  setBranch: (branch: string) => void;

  // Utilities
  processEvent: (event: Record<string, unknown>) => ProcessedEvent | null;
  stream: any;
}

// ============================================================================
// ERROR CLASSIFICATION
// ============================================================================

function classifyError(error: unknown): ChatError {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes("rate limit") || message.includes("429")) {
      return {
        type: "rate_limit",
        message:
          "Rate limit exceeded. Please wait a moment before trying again.",
        details: error,
      };
    }

    if (message.includes("500") || message.includes("internal server")) {
      return {
        type: "server_error",
        message: "Server error. Please try again.",
        details: error,
      };
    }

    if (message.includes("network") || message.includes("fetch")) {
      return {
        type: "network_error",
        message: "Network error. Please check your connection.",
        details: error,
      };
    }

    return {
      type: "unknown",
      message: error.message,
      details: error,
    };
  }

  return {
    type: "unknown",
    message: String(error),
    details: error,
  };
}

// ============================================================================
// EVENT PROCESSING
// ============================================================================

const nodeStartTimes = new Map<string, number>();

function getIconForNode(nodeName: string): string {
  const lower = nodeName.toLowerCase();
  if (lower.includes("search") || lower.includes("retriev")) return "search";
  if (lower.includes("tool") || lower.includes("action")) return "wrench";
  if (
    lower.includes("think") ||
    lower.includes("reason") ||
    lower.includes("agent")
  )
    return "brain";
  if (lower.includes("start") || lower.includes("init")) return "rocket";
  if (
    lower.includes("done") ||
    lower.includes("complete") ||
    lower.includes("finish")
  )
    return "check";
  if (lower.includes("compress") || lower.includes("summar")) return "compress";
  return "sparkles";
}

function processStreamEvent(
  event: Record<string, unknown>,
): ProcessedEvent | null {
  if (event.event === "updates" && event.data) {
    const data = event.data as Record<string, unknown>;
    const nodeNames = Object.keys(data);

    if (nodeNames.length > 0) {
      const nodeName = nodeNames[0];
      const now = Date.now();
      const formattedName = formatNodeName(nodeName);

      if (nodeStartTimes.has(nodeName)) {
        const startTime = nodeStartTimes.get(nodeName)!;
        nodeStartTimes.delete(nodeName);
        const duration = now - startTime;

        return {
          title: formattedName,
          data: `Completed in ${duration}ms`,
          icon: "check",
          timestamp: now,
        };
      } else {
        nodeStartTimes.set(nodeName, now);

        return {
          title: formattedName,
          data: "Running...",
          icon: getIconForNode(nodeName),
          timestamp: now,
        };
      }
    }
  }

  if (event.event === "metadata" && event.data) {
    return {
      title: "Metadata",
      data: "Processing metadata",
      icon: "hash",
      timestamp: Date.now(),
    };
  }

  return null;
}

function formatNodeName(name: string): string {
  return name
    .replace(/_/g, " ")
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

// ============================================================================
// UI MESSAGE TYPE
// ============================================================================

export interface UIMessage {
  id: string;
  name: string;
  props: Record<string, any>;
  metadata?: {
    message_id?: string;
    tool_call_id?: string;
    tool_name?: string;
    [key: string]: any;
  };
}

// ============================================================================
// STATE TYPE
// ============================================================================

interface ChatState {
  messages: Message[];
  ui?: UIMessage[];
}

// ============================================================================
// MAIN HOOK
// ============================================================================

export function useChat(options: UseChatOptions): UseChatReturn {
  const {
    apiUrl,
    assistantId,
    threadId: initialThreadId,
    userId,
    onThreadId,
    onError,
    onEvent,
    onInterrupt,
    fetchStateHistory,
  } = options;

  // Track thread ID locally since useStream uses callback
  const [currentThreadId, setCurrentThreadId] = useState<string | undefined>(
    initialThreadId ?? undefined,
  );
  const [lastEvent, setLastEvent] = useState<Record<string, unknown> | null>(
    null,
  );
  const [interrupt, setInterrupt] = useState<Record<string, unknown> | null>(
    null,
  );
  const [uiMessages, setUIMessages] = useState<UIMessage[]>([]);
  const onThreadIdCalledRef = useRef(false);

  // Handle thread ID callback
  const handleThreadId = useCallback(
    (threadId: string) => {
      setCurrentThreadId(threadId);
      if (!onThreadIdCalledRef.current && !initialThreadId) {
        onThreadIdCalledRef.current = true;
        onThreadId?.(threadId);
      }
    },
    [initialThreadId, onThreadId],
  );

  // Handle errors
  const handleError = useCallback(
    (error: unknown) => {
      onError?.(classifyError(error));
    },
    [onError],
  );

  // Handle update events (for tracking & timeline)
  const handleUpdateEvent = useCallback(
    (data: unknown) => {
      const eventObj = { event: "updates", data };
      setLastEvent(eventObj);
      onEvent?.(eventObj);
    },
    [onEvent],
  );

  // Handle interrupt events (Human-in-the-Loop)
  const handleInterrupt = useCallback(
    (interruptData: unknown) => {
      console.log("[useChat] Interrupt received:", interruptData);
      const interruptObj = interruptData as Record<string, unknown>;
      setInterrupt(interruptObj);
      onInterrupt?.(interruptObj);
    },
    [onInterrupt],
  );

  // Handle custom events for real-time UI updates
  const handleCustomEvent = useCallback((event: unknown) => {
    console.log("[useChat] Custom event received:", event);
    const customEvent = event as { event?: string; data?: UIMessage };

    if (customEvent.event === "ui" && customEvent.data) {
      const uiMessage = customEvent.data;

      setUIMessages((prev) => {
        const existingIndex = prev.findIndex((m) => m.id === uiMessage.id);

        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            props: { ...updated[existingIndex].props, ...uiMessage.props },
            metadata: {
              ...updated[existingIndex].metadata,
              ...uiMessage.metadata,
            },
          };
          return updated;
        } else {
          return [...prev, uiMessage];
        }
      });
    }

    // Handle status updates by tool_call_id for better real-time updates
    if (customEvent.event === "status" && customEvent.data) {
      const statusData = customEvent.data as unknown as {
        tool_call_id?: string;
        status: string;
        [key: string]: unknown;
      };
      if (statusData.tool_call_id) {
        setUIMessages((prev) => {
          const existingIndex = prev.findIndex(
            (m) => m.metadata?.tool_call_id === statusData.tool_call_id,
          );

          if (existingIndex >= 0) {
            const updated = [...prev];
            const { tool_call_id, status, ...rest } = statusData;
            updated[existingIndex] = {
              ...updated[existingIndex],
              props: {
                ...updated[existingIndex].props,
                status,
                ...rest,
              },
            };
            return updated;
          }
          return prev;
        });
      }
    }
  }, []);

  // Reset thread callback tracking when threadId changes
  useEffect(() => {
    if (initialThreadId) {
      setCurrentThreadId(initialThreadId);
      onThreadIdCalledRef.current = true;
    } else {
      onThreadIdCalledRef.current = false;
    }
  }, [initialThreadId]);

  // Use the LangGraph SDK's useStream hook with full capabilities
  // Critical Fix: Pass currentThreadId (state) instead of initialThreadId (prop)
  // This ensures that once we have an ID (generated on first message), we stick to it
  // even if the parent prop hasn't updated yet (e.g. silent URL replacement).
  const stream = useStream<ChatState>({
    apiUrl,
    assistantId,
    messagesKey: "messages",
    threadId: currentThreadId || initialThreadId || undefined,
    onThreadId: handleThreadId,
    onError: handleError,
    onUpdateEvent: handleUpdateEvent,
    onInterrupt: handleInterrupt,
    onCustomEvent: handleCustomEvent,
    // Throttle for smoother updates (30ms balances responsiveness with performance)
    throttle: 30,
    // Enable experimental branching support
    experimental_branchTree: true,
    fetchStateHistory,
  } as any); // Cast to any because experimental_branchTree might not be in the strict type definition yet

  // Reset UI messages when streaming stops (conversation ends)
  useEffect(() => {
    if (!stream.isLoading && uiMessages.length > 0) {
      // Keep the final state but could optionally clear here
      // setUIMessages([]);
    }
  }, [stream.isLoading, uiMessages.length]);

  // Clear UI messages when starting a new submission (retry/edit)
  const clearUIMessages = useCallback(() => {
    setUIMessages([]);
  }, []);

  // Submit function with full branching support
  const submit = useCallback(
    (
      input: { messages: Array<{ type: string; content: string }> } | undefined,
      options?: SubmitOptions,
    ) => {
      // Clear UI messages when starting a new submission (retry/edit/regenerate)
      clearUIMessages();

      const submitOptions: Record<string, unknown> = {};

      // Add checkpoint for branching (edit/regenerate)
      if (options?.checkpoint) {
        // robustly handle checkpoint as object or string
        const cp = options.checkpoint;
        if (typeof cp === "object" && cp !== null) {
          submitOptions.checkpoint = cp;
        } else {
          submitOptions.checkpoint = { checkpoint_id: cp };
        }
      }

      // Add thread ID for optimistic creation
      if (options?.threadId) {
        submitOptions.threadId = options.threadId;
      }

      // Add optimistic values for instant UI updates
      if (options?.optimisticValues) {
        submitOptions.optimisticValues = options.optimisticValues;
      }

      // Add metadata (e.g. user_id)
      if (userId || options?.metadata) {
        submitOptions.metadata = {
          ...(userId ? { user_id: userId } : {}),
          ...options?.metadata,
        };
      }

      // Submit with or without input (undefined input for regenerate)
      if (input) {
        stream.submit(
          { messages: input.messages as unknown as Message[] },
          Object.keys(submitOptions).length > 0 ? submitOptions : undefined,
        );
      } else {
        // For regeneration - submit undefined to replay from checkpoint
        stream.submit(undefined, submitOptions);
      }
    },
    [stream.submit, userId, clearUIMessages],
  );

  // Stable stop function
  const stop = useCallback(() => {
    stream.stop();
  }, [stream.stop]);

  // Approve interrupt (resume with approval)
  const approveInterrupt = useCallback(() => {
    console.log("[useChat] Approving interrupt");
    setInterrupt(null);

    // Submit with command to resume
    stream.submit(undefined, {
      command: { resume: "approved" },
    });
  }, [stream]);

  // Reject interrupt (resume with rejection)
  const rejectInterrupt = useCallback(
    (reason?: string) => {
      console.log("[useChat] Rejecting interrupt:", reason);
      setInterrupt(null);

      // Submit with command to resume with rejection
      stream.submit(undefined, {
        command: { resume: reason || "rejected" },
      });
    },
    [stream],
  );

  // Get metadata for a message (branch info, parent checkpoint)
  const getMessagesMetadata = useCallback(
    (message: Message): MessageMetadata | null => {
      if (!stream.getMessagesMetadata) {
        return null;
      }
      try {
        const meta = stream.getMessagesMetadata(message);

        // If branchOptions is missing, try to extract from fork tree structure
        if (!meta?.branchOptions && stream.experimental_branchTree) {
          console.log(
            "[useChat] No branchOptions in metadata, checking fork tree",
          );
          const treeAny = stream.experimental_branchTree as any;

          // Check if this is a fork tree with items array
          if (
            typeof treeAny.type === "string" &&
            treeAny.type === "fork" &&
            Array.isArray(treeAny.items)
          ) {
            const branchOptions = treeAny.items.map(
              (_item: any, index: number) => {
                // Extract branch identifier from the path array
                // Items in a fork have a path with checkpoint IDs
                const itemPath = _item?.path;
                if (Array.isArray(itemPath) && itemPath.length > 0) {
                  const checkpointId = itemPath[0];
                  if (typeof checkpointId === "string") {
                    return checkpointId;
                  }
                }
                return `branch-${index}`;
              },
            );

            console.log(
              "[useChat] Extracted branchOptions from fork:",
              branchOptions,
            );
            return {
              ...meta,
              branchOptions,
              branch: meta?.branch || branchOptions[branchOptions.length - 1],
            } as MessageMetadata;
          }
        }

        return meta as MessageMetadata | null;
      } catch (err) {
        console.error("[useChat] getMessagesMetadata error:", err);
        return null;
      }
    },
    [stream],
  );

  // Set branch for switching between alternative message versions
  const setBranch = useCallback(
    (branch: string) => {
      if (stream.setBranch) {
        stream.setBranch(branch);
      }
    },
    [stream],
  );

  // Stable event processor
  const processEvent = useCallback(
    (event: Record<string, unknown>): ProcessedEvent | null => {
      return processStreamEvent(event);
    },
    [],
  );

  // Extract messages - rely on stream.messages for correct branch handling and metadata tracking
  const messages = stream.messages ?? [];

  console.log("[useChat] Messages:", stream.messages);

  // Use real-time UI messages from custom events
  // Merge stream UI with real-time updates, preferring real-time for updates
  const streamUIMessages = (stream.values?.ui as UIMessage[]) ?? [];

  // Create a map of existing UI messages by ID for deduplication
  const uiMessageMap = new Map<string, UIMessage>();

  // Add stream UI messages first (as fallback)
  streamUIMessages.forEach((msg) => {
    uiMessageMap.set(msg.id, msg);
  });

  // Overlay with real-time UI messages (these take precedence)
  uiMessages.forEach((msg) => {
    const existing = uiMessageMap.get(msg.id);
    if (existing) {
      // Merge with existing
      uiMessageMap.set(msg.id, {
        ...existing,
        props: { ...existing.props, ...msg.props },
        metadata: { ...existing.metadata, ...msg.metadata },
      });
    } else {
      uiMessageMap.set(msg.id, msg);
    }
  });

  const mergedUIMessages = Array.from(uiMessageMap.values());

  return {
    messages,
    isLoading: stream.isLoading,
    error: stream.error,
    threadId: currentThreadId,
    lastEvent,

    // UI state for generative UI - use real-time updates merged with stream
    ui: mergedUIMessages,

    // Interrupt handling
    interrupt,
    isWaitingForInterrupt: interrupt !== null,

    // Core actions
    submit,
    stop,

    // Interrupt actions
    approveInterrupt,
    rejectInterrupt,

    getMessagesMetadata,
    getToolCalls: stream.getToolCalls,
    setBranch,
    processEvent,
    stream, // Expose raw stream for advanced usage
  };
}
