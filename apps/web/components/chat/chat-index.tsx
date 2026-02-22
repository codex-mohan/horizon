"use client";

import { cn } from "@workspace/ui/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

interface ChatIndexProps {
  entries: Array<{ id: string; role: "user" | "assistant" }>;
  visibleIds: Set<string>;
  onJump: (id: string) => void;
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
}

export function ChatIndex({ entries, visibleIds, onJump, scrollContainerRef }: ChatIndexProps) {
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  // Get unique group IDs (strip -assistant suffix)
  const groupIds = useMemo(() => {
    const groups = new Set<string>();
    for (const entry of entries) {
      groups.add(entry.id.replace("-assistant", ""));
    }
    return Array.from(groups);
  }, [entries]);

  // Find current focused group based on visible entries
  const currentGroupIndex = useMemo(() => {
    for (const groupId of groupIds) {
      if (visibleIds.has(groupId)) {
        return groupIds.indexOf(groupId);
      }
    }
    return -1;
  }, [groupIds, visibleIds]);

  const navigateToPrevious = useCallback(() => {
    const prevIndex = currentGroupIndex > 0 ? currentGroupIndex - 1 : 0;
    const prevGroupId = groupIds[prevIndex];
    if (prevGroupId) {
      onJump(prevGroupId);
      setFocusedIndex(prevIndex);
    }
  }, [currentGroupIndex, groupIds, onJump]);

  const navigateToNext = useCallback(() => {
    const nextIndex =
      currentGroupIndex < groupIds.length - 1 ? currentGroupIndex + 1 : groupIds.length - 1;
    const nextGroupId = groupIds[nextIndex];
    if (nextGroupId) {
      onJump(nextGroupId);
      setFocusedIndex(nextIndex);
    }
  }, [currentGroupIndex, groupIds, onJump]);

  // Determine which tick to highlight for a group
  const getHighlightState = useCallback(
    (entryId: string): { isVisible: boolean; isPrimary: boolean } => {
      const groupId = entryId.replace("-assistant", "");
      const isInGroup = visibleIds.has(groupId);

      if (!isInGroup) {
        return { isVisible: false, isPrimary: false };
      }

      const isAssistant = entryId.endsWith("-assistant");

      // Check if both user and assistant entries exist for this group
      const hasUserEntry = entries.some((e) => e.id === groupId);
      const hasAssistantEntry = entries.some((e) => e.id === groupId + "-assistant");

      // If only one type exists, highlight it
      if (!hasUserEntry) return { isVisible: true, isPrimary: isAssistant };
      if (!hasAssistantEntry) return { isVisible: true, isPrimary: !isAssistant };

      // Both exist - prioritize assistant as primary when group is visible
      return { isVisible: true, isPrimary: isAssistant };
    },
    [entries, visibleIds]
  );

  if (entries.length === 0) return null;

  return (
    <div
      aria-label="Chat message index"
      className="group pointer-events-none absolute right-3 top-1/2 z-20 -translate-y-1/2"
    >
      <div className="flex flex-col items-center gap-1">
        <button
          onClick={navigateToPrevious}
          className="pointer-events-auto -me-2 flex h-8 w-8 translate-y-1 cursor-pointer items-center justify-center rounded-full border border-transparent text-muted-foreground opacity-0 transition-all duration-200 hover:text-foreground group-hover:translate-y-0 group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={currentGroupIndex <= 0}
          title="Navigate to previous message"
          type="button"
        >
          <ChevronUp className="size-4" />
        </button>

        <div className="group/timeline flex flex-col items-end gap-0">
          {entries.map((entry) => {
            const { isVisible, isPrimary } = getHighlightState(entry.id);
            const isAssistant = entry.role === "assistant";

            return (
              <button
                className="group/timeline-tick pointer-events-auto relative flex h-3 w-10 cursor-pointer items-center justify-end rounded-full border border-transparent px-2.5 transition-colors duration-100 hover:bg-transparent"
                key={entry.id}
                onClick={() => onJump(entry.id)}
                title={isAssistant ? "Go to response" : "Go to your message"}
                type="button"
              >
                <div
                  className={cn(
                    "h-[1px] rounded-full transition-all duration-150",
                    "group-hover/timeline-tick:w-4 group-hover/timeline-tick:bg-primary",
                    isPrimary && isVisible
                      ? "w-4 bg-foreground opacity-100"
                      : isVisible
                        ? isAssistant
                          ? "w-3 bg-foreground/70 opacity-100"
                          : "w-2.5 bg-foreground/60 opacity-100"
                        : isAssistant
                          ? "w-2 bg-foreground/30 opacity-100 hover:w-3 hover:bg-foreground/50"
                          : "w-1.5 bg-foreground/30 opacity-100 hover:w-2 hover:bg-foreground/50"
                  )}
                />
              </button>
            );
          })}
        </div>

        <button
          onClick={navigateToNext}
          className="pointer-events-auto -me-2 flex h-8 w-8 -translate-y-1 cursor-pointer items-center justify-center rounded-full border border-transparent text-muted-foreground opacity-0 transition-all duration-200 hover:text-foreground group-hover:translate-y-0 group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={currentGroupIndex >= groupIds.length - 1}
          title="Navigate to next message"
          type="button"
        >
          <ChevronDown className="size-4" />
        </button>
      </div>
    </div>
  );
}
