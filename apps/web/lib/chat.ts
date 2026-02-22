/**
 * Chat Hook - Wrapper around LangGraph SDK's useStream
 *
 * Provides a full-featured interface for chat functionality including:
 * - Message streaming
 * - Message editing and regeneration
 * - Optimistic updates
 * - Event processing
 * - Tool approval handling with proper LangGraph interrupt/resume
 */

import { Client, type Message } from "@langchain/langgraph-sdk";
import { useStream } from "@langchain/langgraph-sdk/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ToolApprovalMode } from "@/lib/stores/chat-settings";

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
  streamMetadata?: {
    langgraph_node?: string;
  };
}

export interface ToolApprovalConfig {
  mode: ToolApprovalMode;
  auto_approve_tools: string[];
  never_approve_tools: string[];
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
  toolApproval?: ToolApprovalConfig;
}

export interface SubmitOptions {
  checkpoint?: { checkpoint_id: string };
  threadId?: string;
  optimisticValues?: (prev: ChatState) => ChatState;
  metadata?: Record<string, unknown>;
  configurable?: Record<string, unknown>;
}

export interface ActionRequest {
  name: string;
  arguments: Record<string, unknown>;
  description: string;
}

export interface ReviewConfig {
  action_name: string;
  allowed_decisions: string[];
}

export interface InterruptData {
  action_requests: ActionRequest[];
  review_configs: ReviewConfig[];
}

export interface HitlDecision {
  type: "approve" | "reject";
  message?: string;
}

export interface UseChatReturn {
  messages: Message[];
  isLoading: boolean;
  error: unknown;
  threadId: string | undefined;
  lastEvent: Record<string, unknown> | null;
  ui: UIMessage[];
  interrupt: InterruptData | null;
  isWaitingForInterrupt: boolean;
  isResuming: boolean;
  hasPendingTasks: boolean;
  submit: (
    input: { messages: Array<{ type: string; content: string | ContentBlock[] }> } | undefined,
    options?: SubmitOptions
  ) => void;
  stop: () => void;
  setBranch: (branch: string) => void;
  approveInterrupt: () => void;
  rejectInterrupt: () => void;
  getMessagesMetadata: (message: Message) => MessageMetadata | null;
  getToolCalls: (message: unknown) => unknown[];
  processEvent: (event: Record<string, unknown>) => ProcessedEvent | null;
  stream: unknown;
}

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

function classifyError(error: unknown): ChatError {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes("rate limit") || message.includes("429")) {
      return {
        type: "rate_limit",
        message: "Rate limit exceeded. Please wait a moment before trying again.",
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

const nodeStartTimes = new Map<string, number>();

function getIconForNode(nodeName: string): string {
  const lower = nodeName.toLowerCase();
  if (lower.includes("search") || lower.includes("retriev")) {
    return "search";
  }
  if (lower.includes("tool") || lower.includes("action")) {
    return "wrench";
  }
  if (lower.includes("think") || lower.includes("reason") || lower.includes("agent")) {
    return "brain";
  }
  if (lower.includes("start") || lower.includes("init")) {
    return "rocket";
  }
  if (lower.includes("done") || lower.includes("complete") || lower.includes("finish")) {
    return "check";
  }
  if (lower.includes("compress") || lower.includes("summar")) {
    return "compress";
  }
  return "sparkles";
}

function processStreamEvent(event: Record<string, unknown>): ProcessedEvent | null {
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
      }
      nodeStartTimes.set(nodeName, now);

      return {
        title: formattedName,
        data: "Running...",
        icon: getIconForNode(nodeName),
        timestamp: now,
      };
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

export interface UIMessage {
  id: string;
  name: string;
  props: Record<string, unknown>;
  metadata?: {
    message_id?: string;
    tool_call_id?: string;
    tool_name?: string;
    [key: string]: unknown;
  };
}

interface ChatState {
  messages: Message[];
  ui?: UIMessage[];
}

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
    toolApproval,
  } = options;

  const [currentThreadId, setCurrentThreadId] = useState<string | undefined>(
    initialThreadId ?? undefined
  );
  const [lastEvent, setLastEvent] = useState<Record<string, unknown> | null>(null);
  const [interrupt, setInterrupt] = useState<InterruptData | null>(null);
  const [uiMessages, setUIMessages] = useState<UIMessage[]>([]);
  const [isResuming, setIsResuming] = useState(false);
  const [isActivelyResuming, setIsActivelyResuming] = useState(false);
  const [hasPendingTasks, setHasPendingTasks] = useState(false);
  const onThreadIdCalledRef = useRef(false);
  const toolApprovalRef = useRef(toolApproval);

  useEffect(() => {
    toolApprovalRef.current = toolApproval;
  }, [toolApproval]);

  const handleThreadId = useCallback(
    async (threadId: string) => {
      setCurrentThreadId(threadId);

      // Update thread metadata with user_id for proper filtering
      // Only do this for newly created threads (not when loading existing ones)
      if (userId && !initialThreadId && !onThreadIdCalledRef.current) {
        try {
          const client = new Client({ apiUrl });
          await client.threads.update(threadId, {
            metadata: { user_id: userId },
          });
          console.log("[useChat] Updated thread metadata with user_id:", threadId);
        } catch (error) {
          console.error("[useChat] Failed to update thread metadata:", error);
        }
      }

      if (!(onThreadIdCalledRef.current || initialThreadId)) {
        onThreadIdCalledRef.current = true;
        onThreadId?.(threadId);
      }
    },
    [initialThreadId, onThreadId, userId, apiUrl]
  );

  const handleError = useCallback(
    (error: unknown) => {
      onError?.(classifyError(error));
    },
    [onError]
  );

  const handleUpdateEvent = useCallback(
    (data: unknown) => {
      const eventObj = { event: "updates", data };
      setLastEvent(eventObj);
      onEvent?.(eventObj);

      // Always check for interrupt data regardless of resuming state.
      // A new interrupt may arrive immediately after a resume command is sent
      // (second tool call), and we must not suppress it.
      if (data && typeof data === "object") {
        const dataRecord = data as Record<string, unknown>;
        if (dataRecord.__interrupt__) {
          console.log("[useChat] Interrupt in update event:", dataRecord.__interrupt__);
          const interruptValue =
            (dataRecord.__interrupt__ as any)?.value || dataRecord.__interrupt__;
          if (interruptValue && interruptValue.action_requests) {
            // A new interrupt arrived — clear the resuming flag so the UI shows it immediately
            setIsActivelyResuming(false);
            setIsResuming(false);
            setInterrupt(interruptValue as InterruptData);
          }
        }
      }
    },
    [onEvent]
  );

  const handleInterrupt = useCallback(
    (interruptData: unknown) => {
      console.log("[useChat] onInterrupt callback fired with:", JSON.stringify(interruptData));

      // LangGraph sends interrupt as { action_requests: [...], review_configs: [...] }
      // Always process — a new interrupt may arrive immediately after resume (second tool call).
      const interruptObj = interruptData as InterruptData;
      if (interruptObj && Array.isArray(interruptObj.action_requests)) {
        console.log("[useChat] Setting interrupt state — clearing resuming flags");
        setIsActivelyResuming(false);
        setIsResuming(false);
        setInterrupt(interruptObj);
        onInterrupt?.(interruptData as Record<string, unknown>);
      } else {
        console.warn("[useChat] Unknown interrupt format, trying to extract:", interruptData);
        if (interruptData && typeof interruptData === "object") {
          const data = interruptData as Record<string, unknown>;
          if (data.value && (data.value as any).action_requests) {
            console.log("[useChat] Found nested action_requests in .value");
            setIsActivelyResuming(false);
            setIsResuming(false);
            setInterrupt(data.value as InterruptData);
          } else if (data.action_requests) {
            console.log("[useChat] Found action_requests at root");
            setIsActivelyResuming(false);
            setIsResuming(false);
            setInterrupt(interruptData as InterruptData);
          }
        }
      }
    },
    [onInterrupt]
  );

  const handleCustomEvent = useCallback((event: unknown) => {
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
        }
        return [...prev, uiMessage];
      });
    }

    if (customEvent.event === "status" && customEvent.data) {
      const statusData = customEvent.data as unknown as {
        tool_call_id?: string;
        status: string;
        [key: string]: unknown;
      };
      if (statusData.tool_call_id) {
        setUIMessages((prev) => {
          const existingIndex = prev.findIndex(
            (m) => m.metadata?.tool_call_id === statusData.tool_call_id
          );

          if (existingIndex >= 0) {
            const updated = [...prev];
            const { status, ...rest } = statusData;
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

  useEffect(() => {
    if (initialThreadId) {
      setCurrentThreadId(initialThreadId);
      onThreadIdCalledRef.current = true;
    } else {
      // Reset thread ID for new chat
      setCurrentThreadId(undefined);
      onThreadIdCalledRef.current = false;
    }
    // Clear all state when thread changes
    setInterrupt(null);
    setUIMessages([]);
    setLastEvent(null);
    setIsActivelyResuming(false);
  }, [initialThreadId]);

  // Check for pending interrupts when thread is loaded
  useEffect(() => {
    if (!currentThreadId || isActivelyResuming) {
      // No thread or actively resuming - ensure interrupt is cleared appropriately
      if (!isActivelyResuming) {
        setInterrupt(null);
        setHasPendingTasks(false);
      }
      return;
    }

    const checkForInterrupt = async () => {
      try {
        const response = await fetch(`${apiUrl}/threads/${currentThreadId}/state`);
        if (!response.ok) {
          setHasPendingTasks(false);
          return;
        }

        const state = await response.json();
        console.log("[useChat] State check for thread", currentThreadId, {
          hasNext: state.next?.length > 0,
          next: state.next,
          tasks: state.tasks?.length || 0,
        });

        // Check if the thread has pending tasks (interrupt)
        if (state.next && state.next.length > 0) {
          // Thread has pending execution - check for interrupt data
          setHasPendingTasks(true);
          if (state.tasks && Array.isArray(state.tasks)) {
            for (const task of state.tasks) {
              if (task.interrupts && task.interrupts.length > 0) {
                const interruptValue = task.interrupts[0].value;
                if (interruptValue && interruptValue.action_requests) {
                  console.log("[useChat] Found pending interrupt:", interruptValue);
                  setInterrupt(interruptValue as InterruptData);
                  return;
                }
              }
            }
          }

          // Also check state.values for __interrupt__ data
          if (state.values?.__interrupt__) {
            const interruptValue = state.values.__interrupt__;
            const value = interruptValue.value || interruptValue;
            if (value && value.action_requests) {
              console.log("[useChat] Found interrupt in state.values:", value);
              setInterrupt(value as InterruptData);
              return;
            }
          }
        } else {
          setHasPendingTasks(false);
        }
      } catch (error) {
        console.error("[useChat] Error checking for interrupt:", error);
        setHasPendingTasks(false);
      }
    };

    const timeoutId = setTimeout(checkForInterrupt, 300);
    return () => clearTimeout(timeoutId);
  }, [currentThreadId, apiUrl, isActivelyResuming]);

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
    throttle: 30,
    fetchStateHistory,
  } as any);

  // The SDK exposes interrupt as a property on stream - use it as a fallback
  const streamInterrupt = (stream as any).interrupt;

  // Update interrupt state when stream.interrupt changes (fallback for SDK-level interrupts)
  useEffect(() => {
    if (isActivelyResuming) return;
    if (!streamInterrupt) return;
    const interruptValue = streamInterrupt.value || streamInterrupt;
    if (interruptValue && interruptValue.action_requests) {
      console.log("[useChat] stream.interrupt detected:", streamInterrupt);
      setInterrupt(interruptValue as InterruptData);
    } else if (typeof streamInterrupt === "object" && (streamInterrupt as any).action_requests) {
      setInterrupt(streamInterrupt as InterruptData);
    }
  }, [streamInterrupt, interrupt, isActivelyResuming]);

  const submit = useCallback(
    async (
      input: { messages: Array<{ type: string; content: string | ContentBlock[] }> } | undefined,
      options?: SubmitOptions
    ) => {
      const submitOptions: Record<string, unknown> = {};

      if (options?.checkpoint) {
        const cp = options.checkpoint;
        if (typeof cp === "object" && cp !== null) {
          submitOptions.checkpoint = cp;
        } else {
          submitOptions.checkpoint = { checkpoint_id: cp };
        }
      }

      if (options?.threadId) {
        submitOptions.threadId = options.threadId;
      }

      if (options?.optimisticValues) {
        submitOptions.optimisticValues = options.optimisticValues;
      }

      const config: { configurable: Record<string, unknown> } = {
        configurable: {
          ...(options?.configurable || {}),
        },
      };

      if (userId) {
        config.configurable.user_id = userId;
      }

      const currentToolApproval = toolApprovalRef.current;
      if (currentToolApproval) {
        config.configurable.tool_approval = currentToolApproval;
      }

      if (Object.keys(config.configurable).length > 0) {
        submitOptions.config = config;
      }

      if (options?.metadata) {
        submitOptions.metadata = options.metadata;
      }

      if (input) {
        stream.submit(
          { messages: input.messages as unknown as Message[] },
          Object.keys(submitOptions).length > 0 ? submitOptions : undefined
        );
      } else {
        stream.submit(undefined, submitOptions);
      }
    },
    [stream, userId]
  );

  const stop = useCallback(() => {
    stream.stop();
  }, [stream]);

  // Resume with approval
  const approveInterrupt = useCallback(() => {
    console.log("[useChat] Approving interrupt");

    const currentInterrupt = interrupt;
    setInterrupt(null);
    setIsResuming(true);
    setIsActivelyResuming(true);

    if (currentInterrupt && currentThreadId) {
      const decisions: HitlDecision[] = currentInterrupt.action_requests.map(() => ({
        type: "approve" as const,
      }));

      console.log("[useChat] Sending approve decisions:", decisions);

      // Use the stream's submit method with command
      const streamAny = stream as any;
      streamAny.submit(null, {
        command: { resume: decisions },
      });
      setIsResuming(false);
    } else {
      setIsResuming(false);
      setIsActivelyResuming(false);
    }
  }, [currentThreadId, interrupt, stream]);

  const rejectInterrupt = useCallback(() => {
    console.log("[useChat] Rejecting interrupt");

    const currentInterrupt = interrupt;
    setInterrupt(null);
    setIsResuming(true);
    setIsActivelyResuming(true);

    if (currentInterrupt && currentThreadId) {
      const decisions: HitlDecision[] = currentInterrupt.action_requests.map(() => ({
        type: "reject" as const,
      }));

      console.log("[useChat] Sending reject decisions:", decisions);

      // Use the stream's submit method with command
      const streamAny = stream as any;
      streamAny.submit(null, {
        command: { resume: decisions },
      });
      setIsResuming(false);
    } else {
      setIsResuming(false);
      setIsActivelyResuming(false);
    }
  }, [currentThreadId, interrupt, stream]);

  const getMessagesMetadata = useCallback(
    (message: Message): MessageMetadata | null => {
      const streamAny = stream as any;
      if (!streamAny.getMessagesMetadata) {
        return null;
      }
      try {
        return streamAny.getMessagesMetadata(message) as MessageMetadata | null;
      } catch {
        return null;
      }
    },
    [stream]
  );

  const processEvent = useCallback((event: Record<string, unknown>): ProcessedEvent | null => {
    return processStreamEvent(event);
  }, []);

  // Only return messages if we have an active thread
  // When threadId is null/undefined (new chat), return empty array to show empty state
  const messages = currentThreadId ? (stream.messages ?? []) : [];

  // Reset isActivelyResuming when stream finishes (no longer loading and no interrupt)
  useEffect(() => {
    if (!stream.isLoading && !(stream as any).interrupt && isActivelyResuming) {
      setIsActivelyResuming(false);
    }
  }, [stream.isLoading, isActivelyResuming, stream]);

  // Debug: Log stream state
  useEffect(() => {
    console.log("[useChat] Stream state:", {
      isLoading: stream.isLoading,
      hasMessages: messages.length > 0,
      hasInterrupt: !!(stream as any).interrupt,
      hasValues: !!(stream as any).values,
      valuesKeys: (stream as any).values ? Object.keys((stream as any).values) : [],
    });
  }, [stream.isLoading, messages.length, stream]);

  const streamUIMessages = (stream.values?.ui as UIMessage[]) ?? [];
  const uiMessageMap = new Map<string, UIMessage>();

  streamUIMessages.forEach((msg) => {
    uiMessageMap.set(msg.id, msg);
  });

  uiMessages.forEach((msg) => {
    const existing = uiMessageMap.get(msg.id);
    if (existing) {
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

  const setBranch = useCallback(
    (branch: string) => {
      const streamAny = stream as any;
      if (streamAny.setBranch) {
        streamAny.setBranch(branch);
      }
    },
    [stream]
  );

  return {
    messages,
    isLoading: stream.isLoading && !interrupt,
    error: stream.error,
    threadId: currentThreadId,
    lastEvent,
    ui: mergedUIMessages,
    interrupt,
    isWaitingForInterrupt: interrupt !== null,
    isResuming,
    hasPendingTasks,
    submit,
    stop,
    setBranch,
    approveInterrupt,
    rejectInterrupt,
    getMessagesMetadata,
    getToolCalls: stream.getToolCalls as (message: unknown) => unknown[],
    processEvent,
    stream,
  };
}
