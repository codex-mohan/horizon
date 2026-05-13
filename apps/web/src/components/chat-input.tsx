import { useState, useRef, useEffect } from "react";
import { Send, Mic } from "lucide-react";
import { HorizonWaveform } from "@/components/typing-indicators";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, disabled, placeholder = "Ask Horizon anything..." }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const hasText = value.trim().length > 0;

  return (
    <div className="w-full">
      <div
        className="relative bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] border border-[rgba(255,255,255,0.08)] backdrop-blur-[42px] saturate-[180%] shadow-[0_30px_90px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-1px_0_rgba(255,255,255,0.03)] overflow-hidden"
      >
        {/* Ambient lighting effect */}
        <div
          className="absolute -left-[10%] -right-[10%] top-0 h-full pointer-events-none opacity-[0.45]"
          style={{
            background: "radial-gradient(ellipse at center, rgba(255,255,255,0.14), transparent 60%)",
          }}
        />

        {/* Sheen animation */}
        <div className="absolute top-0 -left-[20%] w-[40%] h-full bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.10),transparent)] skew-x-[-18deg] animate-[barSheen_8s_linear_infinite] pointer-events-none" />

        {/* Input row */}
        <div className="min-h-[64px] flex items-center gap-3 px-[16px]">
          <button
            className="w-[28px] h-[28px] flex items-center justify-center text-text-secondary text-[22px] font-extralight hover:text-text-primary transition-colors shrink-0"
            aria-label="Attach file"
          >
            +
          </button>

          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            disabled={disabled}
            className="flex-1 bg-transparent border-none text-text-primary text-[16px] tracking-[-0.01em] placeholder:text-text-muted resize-none outline-none min-h-[24px] max-h-[140px] py-3 leading-relaxed"
          />

          {disabled ? (
            <div className="w-[40px] h-[40px] flex items-center justify-center bg-bg-soft border border-border-subtle shrink-0 opacity-30 cursor-not-allowed">
              <div className="w-3.5 h-3 flex items-center justify-center">
                <HorizonWaveform barCount={3} />
              </div>
            </div>
          ) : hasText ? (
            <button
              onClick={handleSubmit}
              disabled={!hasText}
              className="w-[40px] h-[40px] flex items-center justify-center bg-bg-soft border border-border-subtle hover:bg-bg-surface hover:border-border-hover transition-all duration-250 shrink-0"
              aria-label="Send message"
            >
              <Send size={16} />
            </button>
          ) : (
            <button
              className="w-[40px] h-[40px] flex items-center justify-center bg-bg-soft border border-border-subtle hover:bg-bg-surface hover:border-border-hover transition-all duration-250 shrink-0"
              aria-label="Voice input"
            >
              <Mic size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
