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
// STATE TYPE
// ============================================================================

interface ChatState {
  messages: Message[];
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
    // Throttle to prevent excessive re-renders
    throttle: 100,
    // Enable experimental branching support
    experimental_branchTree: true,
    fetchStateHistory,
  } as any); // Cast to any because experimental_branchTree might not be in the strict type definition yet

  // Submit function with full branching support
  const submit = useCallback(
    (
      input: { messages: Array<{ type: string; content: string }> } | undefined,
      options?: SubmitOptions,
    ) => {
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

      // Add metadata (e.g., user_id)
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
    [stream.submit, userId],
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

  return {
    messages,
    isLoading: stream.isLoading,
    error: stream.error,
    threadId: currentThreadId,
    lastEvent,

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
