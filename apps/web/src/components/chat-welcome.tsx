import { motion } from "framer-motion";
import { Sparkles, Bug, Code2, BookOpen, MoreHorizontal } from "lucide-react";
import { HorizonLogo } from "@/components/animated-logo";
import { ChatInput } from "@/components/chat-input";

const suggestions = [
  { label: "Explain quantum computing", icon: Sparkles },
  { label: "Debug my Python script", icon: Bug },
  { label: "Design a REST API", icon: Code2 },
  { label: "Summarize a book", icon: BookOpen },
];

interface ChatWelcomeProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function ChatWelcome({ onSend, disabled }: ChatWelcomeProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 flex flex-col items-center w-full max-w-[760px] mx-auto px-8"
      >
        <div className="w-[64px] h-[64px] flex items-center justify-center mb-[24px] bg-bg-surface border border-border-subtle relative overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent_20%,rgba(255,255,255,0.1)_50%,transparent_80%)] animate-[sheen_10s_linear_infinite]" />
          <HorizonLogo size={26} animate={false} />
        </div>

        <h1 className="font-sora text-[40px] font-semibold tracking-[-0.04em] leading-[1.1] text-center max-w-[600px]">
          How can Horizon assist you today?
        </h1>

        <p className="mt-[16px] text-[15px] leading-[1.7] text-text-secondary text-center max-w-[580px]">
          Deep reasoning, creative exploration, technical execution — all within a cinematic atmospheric workspace.
        </p>

        <div className="w-full mt-8">
          <ChatInput onSend={onSend} disabled={disabled} />
        </div>

        <div className="flex flex-wrap justify-center gap-[8px] mt-6">
          {suggestions.map(({ label, icon: Icon }, i) => (
            <motion.button
              key={label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.15 + i * 0.05 }}
              onClick={() => onSend(label)}
              className="flex items-center gap-2 px-[14px] py-[8px] bg-bg-surface border border-border-subtle text-text-muted text-[12px] hover:border-border-hover hover:text-text-secondary hover:bg-bg-elevated transition-all duration-200"
            >
              <Icon size={14} />
              {label}
            </motion.button>
          ))}
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15 + suggestions.length * 0.05 }}
            className="flex items-center gap-2 px-[14px] py-[8px] bg-bg-surface border border-border-subtle text-text-muted text-[12px] hover:border-border-hover hover:text-text-secondary hover:bg-bg-elevated transition-all duration-200"
            aria-label="More suggestions"
          >
            <MoreHorizontal size={14} />
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
