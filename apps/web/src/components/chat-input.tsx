import { useState, useRef, useEffect } from "react";
import { Send, Mic, Sparkles, ChevronDown } from "lucide-react";
import { HorizonWaveform } from "@/components/typing-indicators";
import { get } from "@/lib/api";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

const LS_KEY = "horizon:default-model";

function getSavedModel(): string {
  if (typeof window === "undefined") return "openai/gpt-4o";
  return localStorage.getItem(LS_KEY) || "openai/gpt-4o";
}

export function ChatInput({ onSend, disabled, placeholder = "Ask Horizon anything..." }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Embedded model selector state
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [selectedModel, setSelectedModel] = useState(getSavedModel);
  const [pickStep, setPickStep] = useState<"provider" | "model">("provider");
  const [selectedProvider, setSelectedProvider] = useState("");
  const [providers, setProviders] = useState<Array<{ provider: string; label: string; models: Array<{ id: string; name: string }> }>>([]);
  const modelPickerRef = useRef<HTMLDivElement>(null);
  const fetched = useRef(false);

  // Fetch models once
  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    get<{ providers: Array<{ provider: string; label: string; models: Array<{ id: string; name: string }> }> }>("/v1/models/all")
      .then((data) => setProviders(data.providers || []))
      .catch(() => {});
  }, []);

  // Close picker on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (modelPickerRef.current && !modelPickerRef.current.contains(e.target as Node)) {
        setShowModelPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

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

  const selectProvider = (provider: string) => {
    setSelectedProvider(provider);
    setPickStep("model");
  };

  const selectModel = (id: string) => {
    setSelectedModel(id);
    localStorage.setItem(LS_KEY, id);
    setShowModelPicker(false);
    setPickStep("provider");
  };

  const openPicker = () => {
    setShowModelPicker(true);
    setPickStep("provider");
    setSelectedProvider("");
  };

  // Resolve display label
  let displayLabel = selectedModel;
  for (const g of providers) {
    if (g.provider && selectedModel.startsWith(g.provider + "/")) {
      const m = g.models.find((m) => m.id === selectedModel);
      displayLabel = m ? `${g.label} / ${m.name}` : selectedModel;
      break;
    }
  }

  const currentProviderModels = selectedProvider
    ? providers.find((g) => g.provider === selectedProvider)?.models || []
    : [];

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

        {/* Model selector bar */}
        <div className="relative flex items-center gap-1 px-[16px] pb-2">
          <div ref={modelPickerRef} className="relative">
            <button
              onClick={openPicker}
              className="flex items-center gap-1.5 px-2 py-0.5 bg-white/[0.03] border border-white/[0.06] text-text-muted text-[11px] hover:text-text-secondary hover:border-white/[0.12] transition-all duration-200"
            >
              <Sparkles size={10} />
              <span className="truncate max-w-[160px]">{displayLabel}</span>
              <ChevronDown size={10} />
            </button>

            {showModelPicker && (
              <div className="absolute left-0 bottom-full mb-1 w-[280px] max-h-[320px] overflow-y-auto bg-bg-elevated border border-border-subtle z-[200] shadow-lg">
                {pickStep === "provider" ? (
                  providers.map((group) => (
                    <button
                      key={group.provider}
                      onClick={() => selectProvider(group.provider)}
                      className="w-full text-left px-3 py-2 text-[13px] text-text-secondary hover:bg-white/[0.03] hover:text-text-primary transition-colors duration-150"
                    >
                      {group.label}
                    </button>
                  ))
                ) : (
                  <>
                    <button
                      onClick={() => setPickStep("provider")}
                      className="w-full text-left px-3 py-1.5 text-[11px] text-text-muted hover:text-text-secondary border-b border-border-subtle"
                    >
                      &larr; Back to providers
                    </button>
                    {currentProviderModels.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => selectModel(m.id)}
                        className={`w-full text-left px-3 py-2 text-[13px] transition-colors duration-150 ${
                          selectedModel === m.id
                            ? "bg-white/[0.06] text-text-primary"
                            : "text-text-secondary hover:bg-white/[0.03] hover:text-text-primary"
                        }`}
                      >
                        {m.name}
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
