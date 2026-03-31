"use client";

import { cn } from "@horizon/ui/lib/utils";
import type { ProcessedEvent as ChatProcessedEvent } from "@/lib/chat";
import type { ToolCall } from "./tool-call-message";

interface ChatLoadingIndicatorProps {
  isLightTheme: boolean;
  showToolCalls: boolean;
  showActivityTimeline: boolean;
  currentToolCalls: ToolCall[];
  liveActivityEvents: ChatProcessedEvent[];
}

export function ChatLoadingIndicator({ isLightTheme }: ChatLoadingIndicatorProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5">
        <LoadingDot delay={0} />
        <LoadingDot delay={0.15} />
        <LoadingDot delay={0.3} />
      </div>
      <span
        className={cn(
          "text-sm font-medium",
          isLightTheme ? "text-slate-600" : "text-muted-foreground"
        )}
      >
        Generating...
      </span>
    </div>
  );
}

function LoadingDot({ delay }: { delay: number }) {
  return (
    <span
      className="h-2 w-2 shrink-0 rounded-full"
      style={{
        background:
          "linear-gradient(90deg, var(--gradient-from), var(--gradient-via), var(--gradient-to))",
        animation: "pulse-dot-smooth 1.4s ease-in-out infinite",
        animationDelay: `${delay}s`,
      }}
    />
  );
}
