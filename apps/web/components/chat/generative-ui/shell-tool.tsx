"use client";

import { cn } from "@workspace/ui/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, ChevronUp, Copy, Terminal } from "lucide-react";
import { useState } from "react";
import { useTheme } from "@/components/theme/theme-provider";
import { getToolUIConfig } from "@/lib/tool-config";
import { ModernSpinner, ShimmerText, ToolStatusBadge } from "./loading-effects";

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
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "overflow-hidden rounded-xl border shadow-2xl",
        isLight
          ? "border-border bg-card/95"
          : "border-slate-800/50 bg-slate-950/90"
      )}
      initial={{ opacity: 0, y: 10 }}
    >
      {/* Terminal Header */}
      <div
        className={cn(
          "flex items-center justify-between border-b px-4 py-2.5",
          isLight
            ? "border-border bg-muted/80"
            : "border-slate-800/50 bg-slate-900/80"
        )}
      >
        <div className="flex items-center gap-3">
          <div className={cn("rounded-lg p-1.5", config.icon.bgColor)}>
            <Terminal className={cn("h-4 w-4", config.icon.color)} />
          </div>
          <span
            className={cn(
              "font-medium text-sm",
              isLight ? "text-foreground" : "text-slate-200"
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
                isLight ? "text-muted-foreground" : "text-slate-500"
              )}
            >
              {executionTime}s
            </span>
          )}
          <div className="flex gap-1.5">
            <div className="h-3 w-3 rounded-full bg-red-500/80" />
            <div className="h-3 w-3 rounded-full bg-amber-500/80" />
            <div className="h-3 w-3 rounded-full bg-emerald-500/80" />
          </div>
        </div>
      </div>

      {/* Command Section */}
      <div
        className={cn(
          "border-b",
          isLight ? "border-border" : "border-slate-800/50"
        )}
      >
        <button
          className={cn(
            "flex w-full items-center justify-between px-4 py-2.5 text-xs transition-colors",
            isLight
              ? "text-muted-foreground hover:text-foreground"
              : "text-slate-400 hover:text-slate-300"
          )}
          onClick={() => setShowArgs(!showArgs)}
        >
          <span className="font-medium uppercase tracking-wider">Command</span>
          {showArgs ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>

        <AnimatePresence>
          {showArgs && (
            <motion.div
              animate={{ height: "auto", opacity: 1 }}
              className="overflow-hidden"
              exit={{ height: 0, opacity: 0 }}
              initial={{ height: 0, opacity: 0 }}
            >
              <div className="px-4 pb-3">
                <div className="group relative">
                  <code
                    className={cn(
                      "block rounded-lg border p-3 font-mono text-sm",
                      isLight
                        ? "border-border bg-muted/50 text-emerald-600"
                        : "border-slate-800/50 bg-slate-900/50 text-emerald-400"
                    )}
                  >
                    <span
                      className={cn(
                        isLight ? "text-muted-foreground" : "text-slate-500"
                      )}
                    >
                      $
                    </span>{" "}
                    {args.command || args.cmd || JSON.stringify(args)}
                  </code>
                  <button
                    className={cn(
                      "absolute top-2 right-2 rounded-md p-1.5 opacity-0 transition-opacity group-hover:opacity-100",
                      isLight
                        ? "bg-muted text-muted-foreground hover:text-foreground"
                        : "bg-slate-800/50 text-slate-400 hover:text-slate-200"
                    )}
                    onClick={() =>
                      handleCopy(
                        args.command || args.cmd || JSON.stringify(args)
                      )
                    }
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
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
            className={cn(
              "flex w-full items-center justify-between px-4 py-2.5 text-xs transition-colors",
              isLight
                ? "text-muted-foreground hover:text-foreground"
                : "text-slate-400 hover:text-slate-300"
            )}
            onClick={() => setShowResult(!showResult)}
          >
            <span className="font-medium uppercase tracking-wider">
              {error ? "Error" : "Output"}
            </span>
            {showResult ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>

          <AnimatePresence>
            {showResult && (
              <motion.div
                animate={{ height: "auto", opacity: 1 }}
                className="overflow-hidden"
                exit={{ height: 0, opacity: 0 }}
                initial={{ height: 0, opacity: 0 }}
              >
                <div className="px-4 pb-4">
                  {isLoading && !result && !error ? (
                    <div className="flex items-center gap-3 p-4">
                      <ModernSpinner size="sm" />
                      <ShimmerText
                        className={cn(
                          "text-sm",
                          isLight ? "text-muted-foreground" : "text-slate-400"
                        )}
                        text="Executing command..."
                      />
                    </div>
                  ) : error ? (
                    <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3">
                      <code className="whitespace-pre-wrap font-mono text-destructive text-sm">
                        {error}
                      </code>
                    </div>
                  ) : (
                    <div className="group relative">
                      <pre
                        className={cn(
                          "overflow-auto rounded-lg border p-3 font-mono text-sm",
                          isLight
                            ? "border-border bg-muted/50 text-foreground"
                            : "border-slate-800/50 bg-slate-900/50 text-slate-300",
                          config.metadata?.maxResultHeight &&
                            `max-h-[${config.metadata.maxResultHeight}]`
                        )}
                      >
                        <code className="whitespace-pre-wrap">{result}</code>
                      </pre>
                      <button
                        className={cn(
                          "absolute top-2 right-2 rounded-md p-1.5 opacity-0 transition-opacity group-hover:opacity-100",
                          isLight
                            ? "bg-muted text-muted-foreground hover:text-foreground"
                            : "bg-slate-800/50 text-slate-400 hover:text-slate-200"
                        )}
                        onClick={() => result && handleCopy(result)}
                      >
                        {copied ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
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
