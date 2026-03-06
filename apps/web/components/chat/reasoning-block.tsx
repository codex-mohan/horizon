"use client";

import { cn } from "@horizon/ui/lib/utils";
import { ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import React, { useState } from "react";

interface ReasoningBlockProps {
  reasoning: string;
  isStreaming?: boolean;
  className?: string;
}

/**
 * A collapsible reasoning block component styled like Claude's interface.
 * Shows reasoning/thinking content that can be expanded/collapsed.
 */
export const ReasoningBlock = React.memo(function ReasoningBlock({
  reasoning,
  isStreaming = false,
  className,
}: ReasoningBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Get preview text (first line or first 100 chars)
  const previewText = reasoning.split("\n")[0]?.slice(0, 100)?.trim();

  return (
    <div
      className={cn(
        "w-full rounded-lg border border-border/50 bg-muted/30 overflow-hidden",
        className
      )}
    >
      {/* Header - Always visible, clickable to toggle */}
      <button
        className={cn(
          "w-full flex items-center gap-2 px-3 py-2 text-left",
          "hover:bg-muted/50 transition-colors duration-200",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        )}
        onClick={() => setIsExpanded(!isExpanded)}
        type="button"
      >
        <Sparkles
          className={cn(
            "size-4 shrink-0",
            isStreaming ? "text-primary animate-pulse" : "text-muted-foreground"
          )}
        />
        <span className="flex-1 text-sm font-medium text-muted-foreground">
          {isStreaming ? "Thinking..." : "Thought Process"}
        </span>
        {isStreaming && <span className="sr-only">Thinking in progress</span>}
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground/70">{isExpanded ? "Hide" : "Show"}</span>
          {isExpanded ? (
            <ChevronUp className="size-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Content */}
      <div
        className={cn(
          "overflow-hidden transition-all duration-200 ease-in-out",
          isExpanded ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="px-3 pb-3 pt-0">
          <div className="border-t border-border/30 pt-2">
            <div className="text-sm text-muted-foreground/90 whitespace-pre-wrap leading-relaxed">
              {reasoning}
            </div>
          </div>
        </div>
      </div>

      {/* Preview when collapsed (shows first line) */}
      {!isExpanded && (
        <div className="px-3 pb-2 pt-0">
          <div className="border-t border-border/30 pt-2">
            <div className="text-sm text-muted-foreground/60 whitespace-pre-wrap line-clamp-1 leading-relaxed">
              {previewText}
              {reasoning.length > previewText.length && "..."}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

ReasoningBlock.displayName = "ReasoningBlock";
