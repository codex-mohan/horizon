"use client";

import { cn } from "@workspace/ui/lib/utils";
import { Loader2 } from "lucide-react";
import type { ProcessedEvent as ChatProcessedEvent } from "@/lib/chat";
import { hasCustomUI } from "@/lib/tool-config";
import { ActivityTimeline } from "./activity-timeline";
import { GenerativeUIRenderer } from "./generative-ui-renderer";
import { type ToolCall, ToolCallMessage } from "./tool-call-message";

interface ChatLoadingIndicatorProps {
  isLightTheme: boolean;
  showToolCalls: boolean;
  showActivityTimeline: boolean;
  currentToolCalls: ToolCall[];
  liveActivityEvents: ChatProcessedEvent[];
}

/**
 * ChatLoadingIndicator - Loading state component for chat
 *
 * Features:
 * - Shows loading spinner when processing
 * - Displays tool calls in progress
 * - Shows activity timeline for real-time updates
 */
export function ChatLoadingIndicator({
  isLightTheme,
  showToolCalls,
  showActivityTimeline,
  currentToolCalls,
  liveActivityEvents,
}: ChatLoadingIndicatorProps) {
  const hasToolCalls = currentToolCalls.length > 0;
  const hasActivityEvents = liveActivityEvents.length > 0;
  const showDetailedLoading = hasToolCalls || hasActivityEvents;

  return (
    <div className="flex items-start gap-3">
      <div
        className={cn(
          "min-h-[56px] w-full rounded-xl p-3",
          isLightTheme ? "glass-strong bg-white/60" : "glass bg-card/60"
        )}
      >
        {showDetailedLoading ? (
          <div className="space-y-3">
            {showToolCalls && hasToolCalls && (
              <>
                <GenerativeUIRenderer
                  isLoading
                  toolCalls={currentToolCalls.filter((tc) =>
                    hasCustomUI(tc.name)
                  )}
                />
                {currentToolCalls.some((tc) => !hasCustomUI(tc.name)) && (
                  <ToolCallMessage
                    isLoading
                    toolCalls={currentToolCalls.filter(
                      (tc) => !hasCustomUI(tc.name)
                    )}
                  />
                )}
              </>
            )}
            {showActivityTimeline && hasActivityEvents && (
              <ActivityTimeline
                isLoading
                processedEvents={liveActivityEvents}
              />
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Loader2
              className={cn(
                "size-5 animate-spin",
                isLightTheme ? "text-slate-600" : "text-primary"
              )}
            />
            <span
              className={isLightTheme ? "text-slate-600" : "text-foreground"}
            >
              Processing...
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
