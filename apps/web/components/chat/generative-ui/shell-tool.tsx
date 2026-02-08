"use client";

import { useState } from "react";
import { cn } from "@workspace/ui/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Terminal, ChevronDown, ChevronUp, Copy, Check } from "lucide-react";
import { ToolStatusBadge, ModernSpinner, ShimmerText } from "./loading-effects";
import { getToolUIConfig } from "@/lib/tool-config";
import { useTheme } from "@/components/theme/theme-provider";

interface ShellToolProps {
  toolName: string;
  status: "pending" | "executing" | "completed" | "failed";
  args: Record<string, any>;
  result?: string;
  startedAt?: number;
  completedAt?: number;
  error?: string;
  isLoading?: boolean;
}

/**
 * Shell Tool Component
 * Styled like a modern terminal with syntax highlighting
 * Theme-aware - works in both light and dark modes
 */
export function ShellTool({
  toolName,
  status,
  args,
  result,
  startedAt,
  completedAt,
  error,
  isLoading,
}: ShellToolProps) {
  const [showArgs, setShowArgs] = useState(true);
  const [showResult, setShowResult] = useState(true);
  const [copied, setCopied] = useState(false);
  const config = getToolUIConfig(toolName);
  const { themeMode } = useTheme();
  const isLight = themeMode === "light";

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const executionTime =
    startedAt && completedAt
      ? Math.round(((completedAt - startedAt) / 1000) * 100) / 100
      : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-xl overflow-hidden border shadow-2xl",
        isLight
          ? "bg-card/95 border-border"
          : "bg-slate-950/90 border-slate-800/50",
      )}
    >
      {/* Terminal Header */}
      <div
        className={cn(
          "flex items-center justify-between px-4 py-2.5 border-b",
          isLight
            ? "bg-muted/80 border-border"
            : "bg-slate-900/80 border-slate-800/50",
        )}
      >
        <div className="flex items-center gap-3">
          <div className={cn("p-1.5 rounded-lg", config.icon.bgColor)}>
            <Terminal className={cn("w-4 h-4", config.icon.color)} />
          </div>
          <span
            className={cn(
              "text-sm font-medium",
              isLight ? "text-foreground" : "text-slate-200",
            )}
          >
            {config.displayName}
          </span>
          <ToolStatusBadge status={status} />
        </div>

        <div className="flex items-center gap-2">
          {executionTime && (
            <span
              className={cn(
                "text-xs",
                isLight ? "text-muted-foreground" : "text-slate-500",
              )}
            >
              {executionTime}s
            </span>
          )}
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-amber-500/80" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
          </div>
        </div>
      </div>

      {/* Command Section */}
      <div
        className={cn(
          "border-b",
          isLight ? "border-border" : "border-slate-800/50",
        )}
      >
        <button
          onClick={() => setShowArgs(!showArgs)}
          className={cn(
            "w-full flex items-center justify-between px-4 py-2.5 text-xs transition-colors",
            isLight
              ? "text-muted-foreground hover:text-foreground"
              : "text-slate-400 hover:text-slate-300",
          )}
        >
          <span className="font-medium uppercase tracking-wider">Command</span>
          {showArgs ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>

        <AnimatePresence>
          {showArgs && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-3">
                <div className="relative group">
                  <code
                    className={cn(
                      "block p-3 rounded-lg text-sm font-mono border",
                      isLight
                        ? "bg-muted/50 text-emerald-600 border-border"
                        : "bg-slate-900/50 text-emerald-400 border-slate-800/50",
                    )}
                  >
                    <span
                      className={cn(
                        isLight ? "text-muted-foreground" : "text-slate-500",
                      )}
                    >
                      $
                    </span>{" "}
                    {args.command || args.cmd || JSON.stringify(args)}
                  </code>
                  <button
                    onClick={() =>
                      handleCopy(
                        args.command || args.cmd || JSON.stringify(args),
                      )
                    }
                    className={cn(
                      "absolute top-2 right-2 p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity",
                      isLight
                        ? "bg-muted text-muted-foreground hover:text-foreground"
                        : "bg-slate-800/50 text-slate-400 hover:text-slate-200",
                    )}
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Result Section */}
      {(result || error || isLoading) && (
        <div>
          <button
            onClick={() => setShowResult(!showResult)}
            className={cn(
              "w-full flex items-center justify-between px-4 py-2.5 text-xs transition-colors",
              isLight
                ? "text-muted-foreground hover:text-foreground"
                : "text-slate-400 hover:text-slate-300",
            )}
          >
            <span className="font-medium uppercase tracking-wider">
              {error ? "Error" : "Output"}
            </span>
            {showResult ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          <AnimatePresence>
            {showResult && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4">
                  {isLoading && !result && !error ? (
                    <div className="flex items-center gap-3 p-4">
                      <ModernSpinner size="sm" />
                      <ShimmerText
                        text="Executing command..."
                        className={cn(
                          "text-sm",
                          isLight ? "text-muted-foreground" : "text-slate-400",
                        )}
                      />
                    </div>
                  ) : error ? (
                    <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                      <code className="text-sm font-mono text-destructive whitespace-pre-wrap">
                        {error}
                      </code>
                    </div>
                  ) : (
                    <div className="relative group">
                      <pre
                        className={cn(
                          "p-3 rounded-lg text-sm font-mono border overflow-auto",
                          isLight
                            ? "bg-muted/50 text-foreground border-border"
                            : "bg-slate-900/50 text-slate-300 border-slate-800/50",
                          config.metadata?.maxResultHeight &&
                            `max-h-[${config.metadata.maxResultHeight}]`,
                        )}
                      >
                        <code className="whitespace-pre-wrap">{result}</code>
                      </pre>
                      <button
                        onClick={() => result && handleCopy(result)}
                        className={cn(
                          "absolute top-2 right-2 p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity",
                          isLight
                            ? "bg-muted text-muted-foreground hover:text-foreground"
                            : "bg-slate-800/50 text-slate-400 hover:text-slate-200",
                        )}
                      >
                        {copied ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
