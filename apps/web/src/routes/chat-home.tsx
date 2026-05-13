import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChatWelcome } from "@/components/chat-welcome";
import { useSessionStore } from "@/stores/session-store";

export function ChatHome() {
  const navigate = useNavigate();
  const { createSession } = useSessionStore();
  const [isStarting, setIsStarting] = useState(false);

  const handleSend = async (message: string) => {
    if (isStarting) return;
    setIsStarting(true);
    try {
      const session = await createSession(message.slice(0, 40));
      navigate(`/c/${session.id}`, { state: { initialMessage: message } });
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full relative">
      <ChatWelcome onSend={handleSend} disabled={isStarting} />
    </div>
  );
}
