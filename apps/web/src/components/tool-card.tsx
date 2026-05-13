import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, Loader2, Check, X } from "lucide-react";
import type { ToolCall } from "@/stores/chat-store";

interface ToolCardProps {
  toolCall: ToolCall;
}

export function ToolCard({ toolCall }: ToolCardProps) {
  const [expanded, setExpanded] = useState(false);

  const statusIcon =
    toolCall.status === "pending" ? (
      <Loader2 size={12} className="animate-spin text-text-secondary" />
    ) : toolCall.status === "success" ? (
      <Check size={12} className="text-text-secondary" />
    ) : (
      <X size={12} className="text-text-muted" />
    );

  return (
    <div className="bg-bg-void border-l-2 border-l-white/20 border-border-subtle">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-bg-surface/50 transition-colors"
      >
        {statusIcon}
        <span className="text-xs font-mono text-text-secondary">{toolCall.name}</span>
        <span className="text-xs text-text-muted capitalize">({toolCall.status})</span>
        <span className="ml-auto">
          {expanded ? (
            <ChevronUp size={12} className="text-text-muted" />
          ) : (
            <ChevronDown size={12} className="text-text-muted" />
          )}
        </span>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-1 border-t border-border-subtle/50">
              <div className="text-xs font-mono text-text-muted mb-1">Arguments</div>
              <pre className="text-xs font-mono text-text-secondary bg-bg-surface p-2 overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(toolCall.arguments, null, 2)}
              </pre>
              {toolCall.result !== undefined && (
                <>
                  <div className="text-xs font-mono text-text-muted mt-2 mb-1">Result</div>
                  <pre className="text-xs font-mono text-text-secondary bg-bg-surface p-2 overflow-x-auto whitespace-pre-wrap">
                    {toolCall.result}
                  </pre>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
