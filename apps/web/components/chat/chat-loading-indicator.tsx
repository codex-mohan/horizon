"use client";

import { cn } from "@workspace/ui/lib/utils";
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
        <span
          className={cn(
            "h-2 w-2 rounded-full animate-pulse-dot",
            "bg-gradient-to-r from-[var(--gradient-from)] to-[var(--gradient-via)]"
          )}
        />
        <span
          className={cn(
            "h-2 w-2 rounded-full animate-pulse-dot",
            "bg-gradient-to-r from-[var(--gradient-via)] to-[var(--gradient-to)]",
            "animation-delay-150"
          )}
        />
        <span
          className={cn(
            "h-2 w-2 rounded-full animate-pulse-dot",
            "bg-gradient-to-r from-[var(--gradient-to)] to-[var(--gradient-from)]",
            "animation-delay-300"
          )}
        />
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
