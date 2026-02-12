"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@workspace/ui/lib/utils";
import { ActivityTimeline } from "./activity-timeline";
import { ToolCallMessage, type ToolCall } from "./tool-call-message";
import { GenerativeUIRenderer } from "./generative-ui-renderer";
import { hasCustomUI } from "@/lib/tool-config";
import type { ProcessedEvent as ChatProcessedEvent } from "@/lib/chat";

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
                    "rounded-xl p-3 w-full min-h-[56px]",
                    isLightTheme
                        ? "glass-strong bg-white/60"
                        : "glass bg-card/60",
                )}
            >
                {showDetailedLoading ? (
                    <div className="space-y-3">
                        {showToolCalls && hasToolCalls && (
                            <>
                                <GenerativeUIRenderer
                                    toolCalls={currentToolCalls.filter((tc) =>
                                        hasCustomUI(tc.name),
                                    )}
                                    isLoading
                                />
                                {currentToolCalls.some(
                                    (tc) => !hasCustomUI(tc.name),
                                ) && (
                                        <ToolCallMessage
                                            toolCalls={currentToolCalls.filter(
                                                (tc) => !hasCustomUI(tc.name),
                                            )}
                                            isLoading
                                        />
                                    )}
                            </>
                        )}
                        {showActivityTimeline && hasActivityEvents && (
                            <ActivityTimeline
                                processedEvents={liveActivityEvents}
                                isLoading
                            />
                        )}
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        <Loader2
                            className={cn(
                                "size-5 animate-spin",
                                isLightTheme ? "text-slate-600" : "text-primary",
                            )}
                        />
                        <span
                            className={
                                isLightTheme ? "text-slate-600" : "text-foreground"
                            }
                        >
                            Processing...
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
