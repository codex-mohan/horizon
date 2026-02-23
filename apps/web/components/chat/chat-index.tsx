"use client";

import { cn } from "@workspace/ui/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";
import React, { useCallback, useMemo, useState } from "react";

interface ChatIndexProps {
  entries: Array<{ id: string; role: "user" | "assistant" }>;
  visibleIds: Set<string>;
  onJump: (id: string) => void;
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
}

// Memoized tick component to prevent re-renders of individual ticks
const TimelineTick = React.memo<{
  entryId: string;
  isAssistant: boolean;
  isVisible: boolean;
  isPrimary: boolean;
  onJump: (id: string) => void;
}>(({ entryId, isAssistant, isVisible, isPrimary, onJump }) => (
  <button
    className="group/timeline-tick pointer-events-auto relative flex h-3 w-10 cursor-pointer items-center justify-end rounded-full border border-transparent px-2.5 transition-colors duration-100 hover:bg-transparent"
    onClick={() => onJump(entryId)}
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
));
TimelineTick.displayName = "TimelineTick";

export const ChatIndex = React.memo(function ChatIndex({
  entries,
  visibleIds,
  onJump,
}: ChatIndexProps) {
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  // Pre-compute unique group IDs with a Map for O(1) lookups
  const { groupIds, groupIdSet, groupIdToIndex } = useMemo(() => {
    const groups = new Set<string>();
    for (const entry of entries) {
      groups.add(entry.id.replace("-assistant", ""));
    }
    const ids = Array.from(groups);
    const indexMap = new Map<string, number>();
    ids.forEach((id, idx) => indexMap.set(id, idx));
    return { groupIds: ids, groupIdSet: groups, groupIdToIndex: indexMap };
  }, [entries]);

  // Pre-compute entry existence maps for O(1) lookups in highlight state
  const entryExistenceMap = useMemo(() => {
    const map = new Map<string, { hasUser: boolean; hasAssistant: boolean }>();

    for (const groupId of groupIdSet) {
      map.set(groupId, { hasUser: false, hasAssistant: false });
    }

    for (const entry of entries) {
      const groupId = entry.id.replace("-assistant", "");
      const existing = map.get(groupId);
      if (existing) {
        if (entry.id === groupId) {
          existing.hasUser = true;
        } else {
          existing.hasAssistant = true;
        }
      }
    }

    return map;
  }, [entries, groupIdSet]);

  // Convert visibleIds to a stable array for memoization
  // This prevents re-renders when Set contents haven't changed
  const visibleIdsKey = useMemo(() => {
    return Array.from(visibleIds).sort().join(",");
  }, [visibleIds]);

  // Parse back to Set for O(1) lookups
  const visibleSet = useMemo(() => {
    return new Set(visibleIdsKey.split(",").filter(Boolean));
  }, [visibleIdsKey]);

  // Find current focused group using O(1) Map lookup
  const currentGroupIndex = useMemo(() => {
    for (const groupId of groupIdSet) {
      if (visibleSet.has(groupId)) {
        return groupIdToIndex.get(groupId) ?? -1;
      }
    }
    return -1;
  }, [groupIdSet, groupIdToIndex, visibleSet]);

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

  // Pre-compute highlight states for all entries
  const entryHighlightStates = useMemo(() => {
    const states = new Map<string, { isVisible: boolean; isPrimary: boolean }>();

    for (const entry of entries) {
      const groupId = entry.id.replace("-assistant", "");
      const isInGroup = visibleSet.has(groupId);

      if (!isInGroup) {
        states.set(entry.id, { isVisible: false, isPrimary: false });
        continue;
      }

      const isAssistant = entry.id.endsWith("-assistant");
      const existence = entryExistenceMap.get(groupId);

      // If only one type exists, highlight it
      if (!existence?.hasUser) {
        states.set(entry.id, { isVisible: true, isPrimary: isAssistant });
        continue;
      }
      if (!existence?.hasAssistant) {
        states.set(entry.id, { isVisible: true, isPrimary: !isAssistant });
        continue;
      }

      // Both exist - prioritize assistant as primary when group is visible
      states.set(entry.id, { isVisible: true, isPrimary: isAssistant });
    }

    return states;
  }, [entries, visibleSet, entryExistenceMap]);

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
            const state = entryHighlightStates.get(entry.id) ?? {
              isVisible: false,
              isPrimary: false,
            };

            return (
              <TimelineTick
                isAssistant={entry.role === "assistant"}
                isPrimary={state.isPrimary}
                isVisible={state.isVisible}
                key={entry.id}
                onJump={onJump}
                entryId={entry.id}
              />
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
});
