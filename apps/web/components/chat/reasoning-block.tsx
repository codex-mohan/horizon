"use client";

import { cn } from "@horizon/ui/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Sparkles } from "lucide-react";
import React, { useState } from "react";

interface ReasoningBlockProps {
  reasoning: string;
  isStreaming?: boolean;
  className?: string;
}

export const ReasoningBlock = React.memo(function ReasoningBlock({
  reasoning,
  isStreaming = false,
  className,
}: ReasoningBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <motion.div
      className={cn(
        "w-full rounded-lg border border-border/50 bg-muted/30 overflow-hidden",
        className
      )}
      layout
    >
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
          className={cn("size-4 shrink-0", isStreaming ? "text-primary" : "text-muted-foreground")}
          style={
            isStreaming ? { animation: "pulse-dot-smooth 1.4s ease-in-out infinite" } : undefined
          }
        />
        <span className="flex-1 text-sm font-medium text-muted-foreground">
          {isStreaming ? "Thinking..." : "Thought Process"}
        </span>
        {isStreaming && <span className="sr-only">Thinking in progress</span>}
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground/70">{isExpanded ? "Hide" : "Show"}</span>
          <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown className="size-4 text-muted-foreground" />
          </motion.div>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.33, 1, 0.68, 1] }}
            style={{ overflow: "hidden" }}
          >
            <div className="px-3 pb-3 pt-0">
              <div className="border-t border-border/30 pt-2">
                <div className="text-sm text-muted-foreground/90 whitespace-pre-wrap leading-relaxed">
                  {reasoning}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

ReasoningBlock.displayName = "ReasoningBlock";
