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

import type { Message } from "@langchain/langgraph-sdk";
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
  submit: (
    input: { messages: Array<{ type: string; content: string }> } | undefined,
    options?: SubmitOptions
  ) => void;
  stop: () => void;
  setBranch: (branch: string) => void;
  approveInterrupt: () => void;
  rejectInterrupt: (reason?: string) => void;
  getMessagesMetadata: (message: Message) => MessageMetadata | null;
  getToolCalls: (message: unknown) => unknown[];
  processEvent: (event: Record<string, unknown>) => ProcessedEvent | null;
  stream: unknown;
}

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
  const onThreadIdCalledRef = useRef(false);
  const toolApprovalRef = useRef(toolApproval);

  useEffect(() => {
    toolApprovalRef.current = toolApproval;
  }, [toolApproval]);

  const handleThreadId = useCallback(
    (threadId: string) => {
      setCurrentThreadId(threadId);
      if (!(onThreadIdCalledRef.current || initialThreadId)) {
        onThreadIdCalledRef.current = true;
        onThreadId?.(threadId);
      }
    },
    [initialThreadId, onThreadId]
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
    },
    [onEvent]
  );

  const handleInterrupt = useCallback(
    (interruptData: unknown) => {
      console.log("[useChat] Interrupt received:", interruptData);

      // LangGraph sends interrupt as { action_requests: [...], review_configs: [...] }
      const interruptObj = interruptData as InterruptData;
      if (interruptObj && Array.isArray(interruptObj.action_requests)) {
        setInterrupt(interruptObj);
        onInterrupt?.(interruptData as Record<string, unknown>);
      } else {
        console.warn("[useChat] Unknown interrupt format:", interruptData);
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
      onThreadIdCalledRef.current = false;
    }
  }, [initialThreadId]);

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

  const submit = useCallback(
    (
      input: { messages: Array<{ type: string; content: string }> } | undefined,
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
        configurable: {},
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

  // Resume with approval - uses Command(resume={decisions: [...]})
  const approveInterrupt = useCallback(() => {
    console.log("[useChat] Approving interrupt");

    const currentInterrupt = interrupt;
    setInterrupt(null);

    if (currentInterrupt && currentThreadId) {
      // Build decisions array - one approve for each action_request
      const decisions: HitlDecision[] = currentInterrupt.action_requests.map(() => ({
        type: "approve" as const,
      }));

      console.log("[useChat] Sending decisions:", decisions);

      // Use Command(resume={...}) pattern via stream.submit
      const streamAny = stream as any;
      streamAny.submit(undefined, {
        command: {
          resume: {
            decisions,
          },
        },
      });
    }
  }, [currentThreadId, interrupt, stream]);

  const rejectInterrupt = useCallback(
    (reason?: string) => {
      console.log("[useChat] Rejecting interrupt:", reason);

      const currentInterrupt = interrupt;
      setInterrupt(null);

      if (currentInterrupt && currentThreadId) {
        // Build decisions array - one reject for each action_request
        const decisions: HitlDecision[] = currentInterrupt.action_requests.map(() => ({
          type: "reject" as const,
          message: reason || "User declined",
        }));

        console.log("[useChat] Sending reject decisions:", decisions);

        const streamAny = stream as any;
        streamAny.submit(undefined, {
          command: {
            resume: {
              decisions,
            },
          },
        });
      }
    },
    [currentThreadId, interrupt, stream]
  );

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

  const messages = stream.messages ?? [];

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
    isLoading: stream.isLoading,
    error: stream.error,
    threadId: currentThreadId,
    lastEvent,
    ui: mergedUIMessages,
    interrupt,
    isWaitingForInterrupt: interrupt !== null,
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
