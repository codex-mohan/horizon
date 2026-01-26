import { useStream } from "@langchain/langgraph-sdk/react";
import type { Message } from "@langchain/langgraph-sdk";
import { useState, useCallback } from "react";

export interface ProcessedEvent {
  title: string;
  data: string;
  icon?: string;
  timestamp?: number;
}

export interface ChatError {
  type: "connection" | "processing" | "timeout" | "unknown";
  message: string;
  details?: unknown;
  lastMessageContent?: string;
  timestamp: number;
}

export interface UseChatOptions {
  apiUrl?: string;
  assistantId?: string;
  threadId?: string | null;
  onEvent?: (event: Record<string, unknown>) => void;
  onError?: (error: ChatError) => void;
}

export interface UseChatReturn {
  submit: (input: {
    messages: Array<{ type: string; content: string }>;
  }) => void;
  stop: () => void;
  messages: Message[];
  isLoading: boolean;
  lastEvent: Record<string, unknown> | null;
  error: ChatError | null;
  clearError: () => void;
  processEvent: (event: Record<string, unknown>) => ProcessedEvent | null;
  apiUrl: string;
  assistantId: string;
  threadId: string | null | undefined;
}

/**
 * Classifies an error into a specific type for better handling
 */
function classifyError(error: unknown, lastMessage?: Message): ChatError {
  const timestamp = Date.now();
  const lastMessageContent = lastMessage
    ? typeof lastMessage.content === 'string'
      ? lastMessage.content
      : JSON.stringify(lastMessage.content)
    : undefined;

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Connection errors
    if (message.includes("fetch") || message.includes("network") || message.includes("connection")) {
      return {
        type: "connection",
        message: "Failed to connect to the AI service. Please check your connection.",
        details: error.message,
        lastMessageContent,
        timestamp,
      };
    }

    // Timeout errors
    if (message.includes("timeout") || message.includes("timed out")) {
      return {
        type: "timeout",
        message: "The request timed out. The AI service may be busy.",
        details: error.message,
        lastMessageContent,
        timestamp,
      };
    }

    // Processing errors
    if (message.includes("parse") || message.includes("json") || message.includes("invalid")) {
      return {
        type: "processing",
        message: "Failed to process the response. Please try again.",
        details: error.message,
        lastMessageContent,
        timestamp,
      };
    }

    return {
      type: "unknown",
      message: error.message,
      details: error.stack,
      lastMessageContent,
      timestamp,
    };
  }

  return {
    type: "unknown",
    message: "An unexpected error occurred",
    details: error,
    lastMessageContent,
    timestamp,
  };
}

export function useChat(options: UseChatOptions = {}): UseChatReturn {
  const apiUrl =
    options.apiUrl ||
    process.env.NEXT_PUBLIC_LANGGRAPH_API_URL ||
    "http://localhost:2024";
  const assistantId = options.assistantId || "agent";

  const [lastEvent, setLastEvent] = useState<Record<string, unknown> | null>(
    null,
  );
  const [error, setError] = useState<ChatError | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const thread = useStream({
    apiUrl,
    assistantId,
    threadId: options.threadId ?? undefined,
    messagesKey: "messages",
    onUpdateEvent: (event: Record<string, unknown>) => {
      setLastEvent(event);
      setError(null); // Clear errors on successful events
      options.onEvent?.(event);
      return event;
    },
    onError: (rawError: unknown) => {
      // Get the last message from the current thread state for context
      const currentMessages = thread.messages as Message[];
      const lastMessage = currentMessages.length > 0 ? currentMessages[currentMessages.length - 1] : undefined;

      const classifiedError = classifyError(rawError, lastMessage);
      setError(classifiedError);

      // Log with appropriate severity and INCLUDE MESSAGE CONTENT
      console.group(`[Chat Error] ${classifiedError.type}`);
      console.error(`Message: ${classifiedError.message}`);
      if (classifiedError.lastMessageContent) {
        console.error(`Last User Message: "${classifiedError.lastMessageContent}"`);
      }
      if (classifiedError.details) {
        console.error(`Details:`, classifiedError.details);
      }
      console.groupEnd();

      // Notify callback if provided
      options.onError?.(classifiedError);
    },
  });

  const processEvent = (
    event: Record<string, unknown>,
  ): ProcessedEvent | null => {
    if (event.StartMiddleware) {
      return {
        title: "Starting Agent",
        data: "Initializing agent session",
        icon: "rocket",
        timestamp: Date.now(),
      };
    }

    if (event.memory) {
      return {
        title: "Loading Memory",
        data: "Retrieving user preferences and context",
        icon: "brain",
        timestamp: Date.now(),
      };
    }

    if (event.model) {
      return {
        title: "Processing",
        data: "AI is thinking...",
        icon: "cpu",
        timestamp: Date.now(),
      };
    }

    if (event.tools) {
      const toolsEvent = event.tools as Record<string, unknown>;
      let toolNames = "tools";

      if (toolsEvent.tool_calls && Array.isArray(toolsEvent.tool_calls)) {
        toolNames = toolsEvent.tool_calls
          .map((tc: Record<string, unknown>) => {
            if (typeof tc === "string") return tc;
            if (tc.name && typeof tc.name === "string") return tc.name;
            if (
              tc.function &&
              typeof tc.function === "object" &&
              tc.function &&
              (tc.function as Record<string, unknown>).name
            ) {
              return (tc.function as Record<string, unknown>).name as string;
            }
            return "unknown";
          })
          .filter(Boolean)
          .join(", ");
      } else if (toolsEvent.input && typeof toolsEvent.input === "string") {
        toolNames = toolsEvent.input;
      }

      return {
        title: "Using Tools",
        data: `Executing: ${toolNames}`,
        icon: "wrench",
        timestamp: Date.now(),
      };
    }

    if (event.token_tracker) {
      const tokenData = event as { token_tracker?: { total_tokens?: number } };
      return {
        title: "Token Usage",
        data: `Tokens: ${tokenData.token_tracker?.total_tokens?.toLocaleString() || 0}`,
        icon: "hash",
        timestamp: Date.now(),
      };
    }

    if (event.summarize) {
      return {
        title: "Summarizing",
        data: "Condensing conversation context",
        icon: "compress",
        timestamp: Date.now(),
      };
    }

    if (event.EndMiddleware) {
      return {
        title: "Complete",
        data: "Response generated",
        icon: "check",
        timestamp: Date.now(),
      };
    }

    return null;
  };

  return {
    submit: thread.submit as UseChatReturn["submit"],
    stop: thread.stop,
    messages: thread.messages as Message[],
    isLoading: thread.isLoading,
    lastEvent,
    error,
    clearError,
    processEvent,
    apiUrl,
    assistantId,
    threadId: options.threadId,
  };
}
