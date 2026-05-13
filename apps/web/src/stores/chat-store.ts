import { create } from "zustand";
import { createSSEConnection, type SSEMessage } from "@/lib/sse";
import { useSessionStore } from "@/stores/session-store";

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: string;
  status: "pending" | "success" | "error";
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  toolCalls?: ToolCall[];
}

interface ChatState {
  messages: Message[];
  isStreaming: boolean;
  streamError: string | null;
  currentStreamId: string | null;
}

interface ChatActions {
  sendMessage: (content: string, sessionId: string) => void;
  appendChunk: (messageId: string, chunk: string) => void;
  addToolCall: (messageId: string, toolCall: ToolCall) => void;
  updateToolCall: (messageId: string, toolCallId: string, updates: Partial<ToolCall>) => void;
  setStreaming: (streaming: boolean) => void;
  setStreamError: (error: string | null) => void;
  clearMessages: () => void;
  loadMessages: (messages: Message[]) => void;
}

export const useChatStore = create<ChatState & ChatActions>((set, get) => ({
  messages: [],
  isStreaming: false,
  streamError: null,
  currentStreamId: null,

  sendMessage: (content, sessionId) => {
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };

    const assistantMessage: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString(),
      toolCalls: [],
    };

    set({
      messages: [...get().messages, userMessage, assistantMessage],
      isStreaming: true,
      streamError: null,
      currentStreamId: assistantMessage.id,
    });

    const connection = createSSEConnection(
      "/v1/chat/stream",
      { sessionId, message: content },
      {
        onMessage: (msg: SSEMessage) => {
          if (msg.event === "message_start" || msg.event === "message_end") {
            try {
              const parsed = JSON.parse(msg.data) as { role?: string; content?: string };
              if (parsed.role === "assistant" && parsed.content) {
                const content = parsed.content;
                set({
                  messages: get().messages.map((m) =>
                    m.id === assistantMessage.id ? { ...m, content } : m
                  ),
                });
              }
            } catch {
              // ignore malformed event
            }
          } else if (msg.event === "message_delta") {
            try {
              const parsed = JSON.parse(msg.data) as { content?: string; text?: string; delta?: string };
              const chunk = parsed.content ?? parsed.text ?? parsed.delta ?? "";
              set({
                messages: get().messages.map((m) =>
                  m.id === assistantMessage.id ? { ...m, content: chunk } : m
                ),
              });
            } catch {
              // ignore malformed delta
            }
          } else if (msg.event === "tool_start") {
            try {
              const parsed = JSON.parse(msg.data) as {
                toolCallId: string;
                toolName: string;
                args: Record<string, unknown>;
              };
              const toolCall: ToolCall = {
                id: parsed.toolCallId,
                name: parsed.toolName,
                arguments: parsed.args,
                status: "pending",
              };
              get().addToolCall(assistantMessage.id, toolCall);
            } catch {
              // ignore malformed tool call
            }
          } else if (msg.event === "tool_end") {
            try {
              const parsed = JSON.parse(msg.data) as {
                toolCallId: string;
                toolName: string;
                result: string;
                isError: boolean;
              };
              get().updateToolCall(assistantMessage.id, parsed.toolCallId, {
                result: parsed.result,
                status: parsed.isError ? "error" : "success",
              });
            } catch {
              // ignore malformed result
            }
          } else if (msg.event === "error") {
            try {
              const parsed = JSON.parse(msg.data) as { error?: string; content?: string };
              const errorMsg = parsed.error || msg.data;
              set({
                streamError: errorMsg,
                messages: get().messages.map((m) =>
                  m.id === assistantMessage.id
                    ? { ...m, content: m.content || errorMsg }
                    : m
                ),
                isStreaming: false,
              });
            } catch {
              set({ streamError: msg.data, isStreaming: false });
            }
          } else if (msg.event === "done") {
            const state = get();
            const lastMsg = state.messages[state.messages.length - 1];
            if (lastMsg?.role === "assistant" && !lastMsg.content && !state.streamError) {
              set({
                messages: state.messages.map((m) =>
                  m.id === lastMsg.id
                    ? { ...m, content: "The model returned an empty response." }
                    : m
                ),
              });
            }
            set({ isStreaming: false, currentStreamId: null });
            // Update session title if it's the first message
            if (state.messages.length <= 2) {
              useSessionStore.getState().updateSessionTitle(sessionId, content.slice(0, 40));
            }
          }
        },
        onError: (err) => {
          set({ streamError: err.message, isStreaming: false, currentStreamId: null });
        },
        onClose: () => {
          const state = get();
          if (state.isStreaming) {
            const lastMsg = state.messages[state.messages.length - 1];
            if (lastMsg?.role === "assistant" && !lastMsg.content && !state.streamError) {
              set({
                streamError: "Connection closed unexpectedly.",
                messages: state.messages.map((m) =>
                  m.id === lastMsg.id
                    ? { ...m, content: "Connection closed unexpectedly." }
                    : m
                ),
                isStreaming: false,
                currentStreamId: null,
              });
            } else {
              set({ isStreaming: false, currentStreamId: null });
            }
          }
        },
      }
    );

    // Store connection on window for cleanup if needed
    (window as unknown as Record<string, unknown>).__horizon_sse = connection;
  },

  appendChunk: (messageId, chunk) => {
    set({
      messages: get().messages.map((m) =>
        m.id === messageId ? { ...m, content: m.content + chunk } : m
      ),
    });
  },

  addToolCall: (messageId, toolCall) => {
    set({
      messages: get().messages.map((m) =>
        m.id === messageId
          ? { ...m, toolCalls: [...(m.toolCalls ?? []), toolCall] }
          : m
      ),
    });
  },

  updateToolCall: (messageId, toolCallId, updates) => {
    set({
      messages: get().messages.map((m) =>
        m.id === messageId
          ? {
              ...m,
              toolCalls: m.toolCalls?.map((tc) =>
                tc.id === toolCallId ? { ...tc, ...updates } : tc
              ),
            }
          : m
      ),
    });
  },

  setStreaming: (streaming) => set({ isStreaming: streaming }),
  setStreamError: (error) => set({ streamError: error }),
  clearMessages: () => set({ messages: [], streamError: null }),
  loadMessages: (messages) => {
    const withIds = messages.map((m) => {
      const content = typeof m.content === "string"
        ? m.content
        : Array.isArray(m.content)
          ? (m.content as Array<{ text?: string; type?: string }>)
              .filter((b) => b.type === "text" || b.text)
              .map((b) => b.text ?? "")
              .join("")
          : String(m.content ?? "");
      return {
        ...m,
        id: m.id || crypto.randomUUID(),
        content,
        createdAt: m.createdAt || new Date().toISOString(),
      };
    });
    set({ messages: withIds, streamError: null });
  },
}));
