/**
 * Chat Hook - SSE-based chat interface for pi-mono agent
 *
 * Replaces the LangGraph SDK useStream with a custom SSE client.
 * Provides message streaming, tool approval handling, and event processing.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { ToolApprovalMode } from "@/lib/stores/chat-settings";
import { useModelConfig } from "@/lib/stores/model-config";

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
  message_id?: string;
  tool_call_id?: string;
  tool_name?: string;
  [key: string]: unknown;
}

export interface ToolApprovalConfig {
  mode: ToolApprovalMode;
  auto_approve_tools: string[];
  never_approve_tools: string;
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

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

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

export interface Message {
  id: string;
  role: string;
  content: string | ContentBlock[];
  tool_calls?: unknown[];
  [key: string]: unknown;
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
  approveInterrupt: () => void;
  rejectInterrupt: () => void;
  getMessagesMetadata: (message: Message) => MessageMetadata | null;
  getToolCalls: (message: unknown) => unknown[];
  processEvent: (event: Record<string, unknown>) => ProcessedEvent | null;
  stream: unknown;
}

function classifyError(error: unknown): ChatError {
  console.error("[chat] raw error:", error);

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes("rate limit") || message.includes("429")) {
      return {
        type: "rate_limit",
        message: `Rate limit exceeded: ${error.message}`,
        details: error,
      };
    }
    if (message.includes("500") || message.includes("internal server")) {
      return { type: "server_error", message: error.message, details: error };
    }
    if (message.includes("network") || message.includes("fetch")) {
      return { type: "network_error", message: `Network error: ${error.message}`, details: error };
    }
    return { type: "unknown", message: error.message, details: error };
  }

  return { type: "unknown", message: String(error), details: error };
}

function formatNodeName(name: string): string {
  return name
    .replace(/_/g, " ")
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
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
  const [messages, setMessages] = useState<Message[]>([]);
  const [lastEvent, setLastEvent] = useState<Record<string, unknown> | null>(null);
  const [interrupt, setInterrupt] = useState<InterruptData | null>(null);
  const [uiMessages, setUIMessages] = useState<UIMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isResuming, setIsResuming] = useState(false);
  const [isActivelyResuming, setIsActivelyResuming] = useState(false);
  const [hasPendingTasks, setHasPendingTasks] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const onThreadIdCalledRef = useRef(false);
  const toolApprovalRef = useRef(toolApproval);

  useEffect(() => {
    toolApprovalRef.current = toolApproval;
  }, [toolApproval]);

  const handleThreadId = useCallback(
    async (threadId: string) => {
      setCurrentThreadId(threadId);
      if (userId && !initialThreadId && !onThreadIdCalledRef.current) {
        try {
          await fetch(`${apiUrl}/threads/${threadId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ metadata: { user_id: userId } }),
          });
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
      setError(error);
      onError?.(classifyError(error));
    },
    [onError]
  );

  useEffect(() => {
    if (initialThreadId) {
      setCurrentThreadId(initialThreadId);
      onThreadIdCalledRef.current = true;
    } else {
      setCurrentThreadId(undefined);
      onThreadIdCalledRef.current = false;
    }
    setInterrupt(null);
    setUIMessages([]);
    setLastEvent(null);
    setIsActivelyResuming(false);
    setMessages([]);
  }, [initialThreadId]);

  // Check for pending interrupts on thread mount
  useEffect(() => {
    if (!currentThreadId || isActivelyResuming) return;

    const checkForInterrupt = async () => {
      try {
        const response = await fetch(`${apiUrl}/threads/${currentThreadId}/state`);
        if (!response.ok) return;

        const state = await response.json();
        if (state.isStreaming) {
          setHasPendingTasks(true);
          return;
        }

        setHasPendingTasks(false);
      } catch {
        setHasPendingTasks(false);
      }
    };

    checkForInterrupt();
  }, [currentThreadId, apiUrl, isActivelyResuming]);

  // Load messages when thread changes
  useEffect(() => {
    if (!currentThreadId) {
      setMessages([]);
      return;
    }

    const loadMessages = async () => {
      try {
        const response = await fetch(`${apiUrl}/threads/${currentThreadId}/history`);
        if (response.ok) {
          const history = await response.json();
          setMessages(
            history.map((msg: any, i: number) => ({
              id: msg.id || `msg-${i}`,
              role:
                msg.role ||
                (msg.type === "human"
                  ? "user"
                  : msg.type === "ai"
                    ? "assistant"
                    : msg.type || "unknown"),
              content: msg.content || "",
              tool_calls: msg.tool_calls,
            }))
          );
        }
      } catch (error) {
        console.error("[useChat] Failed to load message history:", error);
      }
    };

    if (fetchStateHistory) {
      loadMessages();
    }
  }, [currentThreadId, apiUrl, fetchStateHistory]);

  const parseSSELine = useCallback((line: string) => {
    if (line.startsWith("event: ")) {
      return { type: "event", data: line.slice(7) };
    }
    if (line.startsWith("data: ")) {
      return { type: "data", data: line.slice(6) };
    }
    if (line.startsWith("id: ")) {
      return { type: "id", data: line.slice(4) };
    }
    return null;
  }, []);

  const streamChat = useCallback(
    async (
      threadId: string,
      inputMessages: Array<{ type: string; content: string | ContentBlock[] }>,
      isResume = false,
      approval?: { approved: boolean }
    ) => {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setIsLoading(true);
      setError(null);

      try {
        const modelConfigState = useModelConfig.getState();
        const { config: modelConfig } = modelConfigState;

        const body = isResume
          ? { approval }
          : {
              input: { messages: inputMessages },
              config: {
                configurable: {
                  user_id: userId,
                  tool_approval: toolApprovalRef.current,
                  model_config: {
                    provider: modelConfig.provider,
                    modelName: modelConfig.modelName,
                    enableReasoning: modelConfig.enableReasoning,
                    reasoningEffort: modelConfig.reasoningEffort,
                    thinkingBudget: modelConfig.thinkingBudget,
                    apiKey: modelConfig.providers[modelConfig.provider]?.apiKey,
                    baseUrl: modelConfig.providers[modelConfig.provider]?.baseUrl,
                  },
                },
              },
            };

        const endpoint = isResume ? "runs/resume" : "runs/stream";
        const response = await fetch(`${apiUrl}/threads/${threadId}/${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";
        let currentEvent = "";
        let assistantMessageContent = "";
        let toolCallIndex = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const parsed = parseSSELine(line);
            if (!parsed) continue;

            if (parsed.type === "event") {
              currentEvent = parsed.data;
            } else if (parsed.type === "data") {
              try {
                const data = JSON.parse(parsed.data);

                if (currentEvent === "metadata") {
                  if (data.run_id && !isResume) {
                    await handleThreadId(threadId);
                  }
                  continue;
                }

                if (currentEvent === "interrupt") {
                  setInterrupt(data as InterruptData);
                  setIsActivelyResuming(false);
                  setIsLoading(false);
                  onInterrupt?.(data as Record<string, unknown>);
                  continue;
                }

                if (currentEvent === "agent_end") {
                  if (data.messages) {
                    setMessages(
                      data.messages.map((msg: any, i: number) => ({
                        id: msg.id || `msg-${i}`,
                        role: msg.role || "assistant",
                        content: msg.content || "",
                        tool_calls: msg.tool_calls,
                      }))
                    );
                  }
                  setIsLoading(false);
                  setHasPendingTasks(false);
                  continue;
                }

                if (currentEvent === "error") {
                  handleError(new Error(data.error || "Unknown error"));
                  setIsLoading(false);
                  continue;
                }

                if (currentEvent === "message_update") {
                  const eventData = data as Record<string, unknown>;
                  if (eventData.type === "text_delta" && eventData.delta) {
                    assistantMessageContent += eventData.delta;
                  }

                  setLastEvent({ event: currentEvent, data });
                  onEvent?.({ event: currentEvent, data });
                  continue;
                }

                if (currentEvent === "tool_execution_end") {
                  const toolData = data as Record<string, unknown>;
                  const uiMessage: UIMessage = {
                    id: `tool-${toolData.toolCallId || toolCallIndex++}`,
                    name: (toolData.toolName as string) || "tool",
                    props: {
                      toolName: toolData.toolName,
                      status: toolData.isError ? "error" : "completed",
                      result: toolData.result,
                      displayTitle: (toolData as any).displayTitle,
                    },
                    metadata: {
                      tool_call_id: toolData.toolCallId as string,
                      tool_name: toolData.toolName as string,
                    },
                  };

                  setUIMessages((prev) => {
                    const idx = prev.findIndex((m) => m.id === uiMessage.id);
                    if (idx >= 0) {
                      const updated = [...prev];
                      updated[idx] = { ...updated[idx], ...uiMessage };
                      return updated;
                    }
                    return [...prev, uiMessage];
                  });

                  setLastEvent({ event: currentEvent, data });
                  onEvent?.({ event: currentEvent, data });
                  continue;
                }

                if (currentEvent === "tool_execution_start") {
                  const toolData = data as Record<string, unknown>;
                  const uiMessage: UIMessage = {
                    id: `tool-${toolData.toolCallId || toolCallIndex++}`,
                    name: (toolData.toolName as string) || "tool",
                    props: {
                      toolName: toolData.toolName,
                      status: "loading",
                      args: toolData.args,
                      displayTitle: (toolData as any).displayTitle,
                    },
                    metadata: {
                      tool_call_id: toolData.toolCallId as string,
                      tool_name: toolData.toolName as string,
                    },
                  };

                  setUIMessages((prev) => {
                    const idx = prev.findIndex((m) => m.id === uiMessage.id);
                    if (idx >= 0) {
                      const updated = [...prev];
                      updated[idx] = { ...updated[idx], ...uiMessage };
                      return updated;
                    }
                    return [...prev, uiMessage];
                  });
                  continue;
                }

                setLastEvent({ event: currentEvent, data });
                onEvent?.({ event: currentEvent, data });
              } catch {
                // Ignore JSON parse errors
              }
            }
          }
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        handleError(error);
        setIsLoading(false);
      }
    },
    [apiUrl, userId, handleThreadId, handleError, onEvent, onInterrupt, parseSSELine]
  );

  const submit = useCallback(
    async (
      input: { messages: Array<{ type: string; content: string | ContentBlock[] }> } | undefined,
      options?: SubmitOptions
    ) => {
      const threadId = options?.threadId || currentThreadId;
      if (!threadId) return;

      if (!onThreadIdCalledRef.current) {
        await handleThreadId(threadId);
      }

      if (options?.optimisticValues) {
        const newState = options.optimisticValues({ messages, ui: uiMessages });
        setMessages(newState.messages);
        if (newState.ui) setUIMessages(newState.ui);
      }

      const inputMessages = input?.messages || [];
      await streamChat(threadId, inputMessages);
    },
    [currentThreadId, messages, uiMessages, handleThreadId, streamChat]
  );

  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
  }, []);

  const approveInterrupt = useCallback(() => {
    console.log("[useChat] Approving interrupt");
    setInterrupt(null);
    setIsResuming(true);
    setIsActivelyResuming(true);

    if (currentThreadId) {
      streamChat(currentThreadId, [], true, { approved: true }).finally(() => {
        setIsResuming(false);
      });
    } else {
      setIsResuming(false);
      setIsActivelyResuming(false);
    }
  }, [currentThreadId, streamChat]);

  const rejectInterrupt = useCallback(() => {
    console.log("[useChat] Rejecting interrupt");
    setInterrupt(null);
    setIsResuming(true);
    setIsActivelyResuming(true);

    if (currentThreadId) {
      streamChat(currentThreadId, [], true, { approved: false }).finally(() => {
        setIsResuming(false);
      });
    } else {
      setIsResuming(false);
      setIsActivelyResuming(false);
    }
  }, [currentThreadId, streamChat]);

  const getMessagesMetadata = useCallback((_message: Message): MessageMetadata | null => {
    return null;
  }, []);

  const getToolCalls = useCallback((message: unknown): unknown[] => {
    const msg = message as { tool_calls?: unknown[] };
    return msg.tool_calls || [];
  }, []);

  const processEvent = useCallback((event: Record<string, unknown>): ProcessedEvent | null => {
    const eventName = (event.event as string) || "";
    if (!eventName) return null;

    return {
      title: formatNodeName(eventName),
      data: JSON.stringify(event.data || {}),
      timestamp: Date.now(),
    };
  }, []);

  return {
    messages,
    isLoading: isLoading && !interrupt,
    error,
    threadId: currentThreadId,
    lastEvent,
    ui: uiMessages,
    interrupt,
    isWaitingForInterrupt: interrupt !== null,
    isResuming,
    hasPendingTasks,
    submit,
    stop,
    approveInterrupt,
    rejectInterrupt,
    getMessagesMetadata,
    getToolCalls,
    processEvent,
    stream: { messages, isLoading, values: { ui: uiMessages } },
  };
}
