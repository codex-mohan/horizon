import { useEffect, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import { MessageList } from "@/components/message-list";
import { ChatInput } from "@/components/chat-input";
import { ChatWelcome } from "@/components/chat-welcome";
import { useChatStore } from "@/stores/chat-store";
import { useSessionStore } from "@/stores/session-store";
import { get } from "@/lib/api";
import type { Message } from "@/stores/chat-store";

interface LocationState {
  initialMessage?: string;
}

export function ChatSession() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const location = useLocation();
  const state = location.state as LocationState | null;
  const { messages, isStreaming, sendMessage, loadMessages, clearMessages } = useChatStore();
  const { setActiveSession } = useSessionStore();
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    setActiveSession(sessionId);

    let cancelled = false;
    async function load() {
      try {
        const session = await get<{ messages?: Message[] }>(`/v1/sessions/${sessionId}`);
        if (!cancelled) {
          if (session.messages && session.messages.length > 0) {
            loadMessages(session.messages);
          } else {
            clearMessages();
          }
          setHasLoaded(true);
        }
      } catch {
        if (!cancelled) {
          clearMessages();
          setHasLoaded(true);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [sessionId, setActiveSession, loadMessages, clearMessages]);

  useEffect(() => {
    if (hasLoaded && state?.initialMessage && messages.length === 0 && sessionId) {
      sendMessage(state.initialMessage, sessionId);
      window.history.replaceState({}, document.title);
    }
  }, [hasLoaded, state, messages.length, sessionId, sendMessage]);

  const handleSend = (content: string) => {
    if (!sessionId || isStreaming) return;
    sendMessage(content, sessionId);
  };

  if (!sessionId) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-muted text-sm">
        Invalid session
      </div>
    );
  }

  const showWelcome = messages.length === 0 && !isStreaming;

  return (
    <div className="flex-1 flex flex-col h-full relative">
      {showWelcome ? (
        <ChatWelcome onSend={handleSend} disabled={isStreaming} />
      ) : (
        <>
          <MessageList messages={messages} isStreaming={isStreaming} />
          <div className="absolute left-0 right-0 bottom-8 px-7 flex justify-center pointer-events-none">
            <div className="w-full max-w-[980px] pointer-events-auto">
              <ChatInput onSend={handleSend} disabled={isStreaming} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
