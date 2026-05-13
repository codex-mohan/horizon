import { MarkdownView } from "@horizon/ui";
import type { ToolCall } from "@/stores/chat-store";
import { ToolCard } from "@/components/tool-card";
import { HorizonEventHorizon } from "@/components/typing-indicators";

interface AssistantMessageProps {
  content: string;
  toolCalls?: ToolCall[];
  isStreaming?: boolean;
}

export function AssistantMessage({ content, toolCalls, isStreaming }: AssistantMessageProps) {
  return (
    <div
      className="flex items-start gap-3"
      style={{ animation: "messageIn .4s ease both" }}
    >
      <div className="w-7 h-7 shrink-0 bg-white/[0.04] border border-[rgba(255,255,255,0.07)] flex items-center justify-center text-white text-xs font-semibold">
        H
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-[10px] mb-3">
          <span className="text-[13px] font-medium text-white/84">Horizon</span>
          <span className="text-xs text-white/[0.28]">{timeNow()}</span>
        </div>
        <div
          className="relative max-w-[760px] px-6 py-6 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] border border-[rgba(255,255,255,0.05)] backdrop-blur-[38px] saturate-[180%] shadow-[0_20px_60px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.04)] overflow-hidden"
        >
          <div
            className="absolute inset-0 pointer-events-none opacity-45"
            style={{
              background: "radial-gradient(ellipse at top, rgba(255,255,255,0.06), transparent 70%)",
            }}
          />
          <div className="relative text-[15px] leading-[1.85] text-text-secondary">
            <MarkdownView text={content} isStreaming={isStreaming} />
          </div>
        </div>

        {isStreaming && !content && (
          <div className="mt-3">
            <HorizonEventHorizon />
          </div>
        )}

        {isStreaming && content && (
          <span
            className="inline-block w-1.5 h-4 bg-white/60 ml-1 align-middle mt-2"
            style={{
              animation: "dotPulse 1s ease-in-out infinite",
            }}
          />
        )}

        {toolCalls && toolCalls.length > 0 && (
          <div className="mt-3 flex flex-col gap-2">
            {toolCalls.map((tc) => (
              <ToolCard key={tc.id} toolCall={tc} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function timeNow() {
  const d = new Date();
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
