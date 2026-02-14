"use client";

import type { Message } from "@langchain/langgraph-sdk";
import { useStream } from "@langchain/langgraph-sdk/react";
import {
  isRemoveUIMessage,
  isUIMessage,
  type UIMessage,
  uiMessageReducer,
} from "@langchain/langgraph-sdk/react-ui";
import { createContext, type ReactNode, useCallback, useContext, useMemo } from "react";

export interface StreamContextValue {
  messages: Message[];
  isLoading: boolean;
  error: unknown;
  threadId: string | undefined;
  ui: UIMessage[];
  interrupt: unknown;
  submit: (input?: unknown, options?: Record<string, unknown>) => void;
  stop: () => void;
  setBranch: (branch: string) => void;
  getMessagesMetadata: (msg: Message) => Record<string, unknown> | null;
  values: Record<string, unknown>;
  approveInterrupt: () => void;
  rejectInterrupt: (reason?: string) => void;
  stream: unknown;
}

const StreamContext = createContext<StreamContextValue | null>(null);

export interface StreamProviderProps {
  children: ReactNode;
  apiUrl: string;
  assistantId: string;
  threadId?: string | null;
  userId?: string;
  onThreadId?: (id: string) => void;
  onError?: (error: Error) => void;
}

interface ChatState {
  messages: Message[];
  ui?: UIMessage[];
}

export function StreamProvider({
  children,
  apiUrl,
  assistantId,
  threadId,
  onThreadId,
  onError,
}: StreamProviderProps) {
  const stream = useStream<ChatState>({
    apiUrl,
    assistantId,
    messagesKey: "messages",
    threadId: threadId ?? undefined,
    onThreadId,
    onError,
    onCustomEvent: (
      event: unknown,
      options: { mutate: (fn: (prev: ChatState) => ChatState) => void }
    ) => {
      if (isUIMessage(event) || isRemoveUIMessage(event)) {
        options.mutate((prev: ChatState) => ({
          ...prev,
          ui: uiMessageReducer(prev.ui ?? [], event as Parameters<typeof uiMessageReducer>[1]),
        }));
      }
    },
  } as any);

  const approveInterrupt = useCallback(() => {
    (stream as any).submit(undefined, { command: { resume: "approved" } });
  }, [stream]);

  const rejectInterrupt = useCallback(
    (reason?: string) => {
      (stream as any).submit(undefined, {
        command: { resume: reason || "rejected" },
      });
    },
    [stream]
  );

  const getMessagesMetadata = useCallback(
    (msg: Message): Record<string, unknown> | null => {
      if (!(stream as any).getMessagesMetadata) {
        return null;
      }
      try {
        return (stream as any).getMessagesMetadata(msg) as Record<string, unknown> | null;
      } catch {
        return null;
      }
    },
    [stream]
  );

  const setBranch = useCallback(
    (branch: string) => {
      if ((stream as any).setBranch) {
        (stream as any).setBranch(branch);
      }
    },
    [stream]
  );

  const submit = useCallback(
    (input?: unknown, options?: Record<string, unknown>) => {
      (stream as any).submit(input, options);
    },
    [stream]
  );

  const value: StreamContextValue = useMemo(
    () => ({
      messages: stream.messages ?? [],
      isLoading: stream.isLoading,
      error: stream.error,
      threadId: (stream as any).threadId,
      ui: (stream.values?.ui as UIMessage[]) ?? [],
      interrupt: stream.interrupt,
      submit,
      stop: stream.stop,
      setBranch,
      getMessagesMetadata,
      values: stream.values ?? {},
      approveInterrupt,
      rejectInterrupt,
      stream,
    }),
    [stream, submit, setBranch, getMessagesMetadata, approveInterrupt, rejectInterrupt]
  );

  return <StreamContext.Provider value={value}>{children}</StreamContext.Provider>;
}

export function useStreamContext(): StreamContextValue {
  const context = useContext(StreamContext);
  if (!context) {
    throw new Error("useStreamContext must be used within StreamProvider");
  }
  return context;
}
