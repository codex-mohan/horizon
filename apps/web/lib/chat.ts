import { useStream } from "@langchain/langgraph-sdk/react";
import type { Message } from "@langchain/langgraph-sdk";
import { useState } from "react";

export interface ProcessedEvent {
  title: string;
  data: string;
  icon?: string;
  timestamp?: number;
}

export interface UseChatOptions {
  apiUrl?: string;
  assistantId?: string;
  onEvent?: (event: Record<string, unknown>) => void;
}

export interface UseChatReturn {
  submit: (input: {
    messages: Array<{ type: string; content: string }>;
  }) => void;
  stop: () => void;
  messages: Message[];
  isLoading: boolean;
  lastEvent: Record<string, unknown> | null;
  processEvent: (event: Record<string, unknown>) => ProcessedEvent | null;
  apiUrl: string;
  assistantId: string;
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

  const thread = useStream({
    apiUrl,
    assistantId,
    messagesKey: "messages",
    onUpdateEvent: (event: Record<string, unknown>) => {
      setLastEvent(event);
      options.onEvent?.(event);
      return event;
    },
    onError: (error: unknown) => {
      if (error instanceof Error) {
        console.error("Chat error:", error);
      } else {
        console.error("Chat error: Unknown error", error);
      }
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
    processEvent,
    apiUrl,
    assistantId,
  };
}
