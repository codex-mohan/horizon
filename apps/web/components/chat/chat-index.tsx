"use client";

import { cn } from "@workspace/ui/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useCallback } from "react";

interface ChatIndexProps {
  entries: Array<{ id: string; role: "user" | "assistant" }>;
  visibleIds: Set<string>;
  onJump: (id: string) => void;
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
}

export function ChatIndex({ entries, visibleIds, onJump, scrollContainerRef }: ChatIndexProps) {
  const scrollUp = useCallback(() => {
    scrollContainerRef?.current?.scrollBy({ top: -300, behavior: "smooth" });
  }, [scrollContainerRef]);

  const scrollDown = useCallback(() => {
    scrollContainerRef?.current?.scrollBy({ top: 300, behavior: "smooth" });
  }, [scrollContainerRef]);

  if (entries.length === 0) return null;

  return (
    <div
      aria-label="Chat message index"
      className="group pointer-events-none absolute right-3 top-1/2 z-20 -translate-y-1/2"
    >
      <div className="flex flex-col items-center gap-1">
        <button
          onClick={scrollUp}
          className="pointer-events-auto -me-2 h-8 w-8 translate-y-1 cursor-pointer rounded-full border border-transparent px-1.5 py-1.5 text-muted-foreground opacity-0 transition-all duration-200 hover:bg-accent hover:text-accent-foreground group-hover:translate-y-0 group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent"
          title="Navigate to previous message"
          type="button"
        >
          <ChevronUp className="size-4" />
        </button>

        <div className="group/timeline flex flex-col items-end gap-0">
          {entries.map((entry) => {
            const isVisible = visibleIds.has(entry.id);
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
                    isVisible
                      ? isAssistant
                        ? "w-4 bg-foreground opacity-100 group-hover/timeline-tick:!bg-foreground"
                        : "w-3 bg-foreground/80 opacity-100 group-hover/timeline-tick:!bg-foreground"
                      : isAssistant
                        ? "w-3 bg-foreground/40 opacity-100 hover:bg-foreground/70"
                        : "w-1.5 bg-foreground/40 opacity-100 hover:w-3 hover:bg-foreground/70"
                  )}
                />
              </button>
            );
          })}
        </div>

        <button
          onClick={scrollDown}
          className="pointer-events-auto -me-2 h-8 w-8 -translate-y-1 cursor-pointer rounded-full border border-transparent px-1.5 py-1.5 text-muted-foreground opacity-0 transition-all duration-200 hover:bg-accent hover:text-accent-foreground group-hover:translate-y-0 group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent"
          title="Navigate to next message"
          type="button"
        >
          <ChevronDown className="size-4" />
        </button>
      </div>
    </div>
  );
}
