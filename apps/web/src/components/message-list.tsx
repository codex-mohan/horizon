import { useRef, useEffect } from "react";
import type { Message } from "@/stores/chat-store";
import { UserBubble } from "@/components/user-bubble";
import { AssistantMessage } from "@/components/assistant-message";

interface MessageListProps {
  messages: Message[];
  isStreaming: boolean;
}

export function MessageList({ messages, isStreaming }: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, isStreaming]);

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto">
      <div className="max-w-[920px] mx-auto px-8 pt-[60px] pb-[200px] flex flex-col gap-9">
        {messages.map((message, index) => (
          <div key={message.id}>
            {message.role === "user" ? (
              <UserBubble content={message.content} />
            ) : (
              <AssistantMessage
                content={message.content}
                toolCalls={message.toolCalls}
                isStreaming={isStreaming && index === messages.length - 1}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
