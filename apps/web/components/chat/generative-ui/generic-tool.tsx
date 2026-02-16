"use client";

import { cn } from "@workspace/ui/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, ChevronUp, Code, Copy } from "lucide-react";
import { useState } from "react";
import { useTheme } from "@/components/theme/theme-provider";
import { getToolIcon, getToolUIConfig } from "@/lib/tool-config";
import { ModernSpinner, ShimmerText, ToolStatusBadge } from "./loading-effects";

interface GenericToolProps {
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
 * Generic Tool Component
 * Default UI for tools without custom components
 * Features expandable JSON viewer with syntax highlighting
 * Theme-aware - works in both light and dark modes
 */
export function GenericTool({
  toolName,
  status,
  args,
  result,
  startedAt,
  completedAt,
  error,
  isLoading,
}: GenericToolProps) {
  const [showArgs, setShowArgs] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [copied, setCopied] = useState(false);
  const config = getToolUIConfig(toolName);
  const Icon = getToolIcon(toolName);
  const { themeMode } = useTheme();
  const isLight = themeMode === "light";

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatJSON = (obj: any) => JSON.stringify(obj, null, 2);

  const executionTime =
    startedAt && completedAt ? Math.round((completedAt - startedAt) / 10) / 100 : null;

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "overflow-hidden rounded-xl border shadow-lg",
        isLight ? "border-border bg-card/95" : "border-slate-700/50 bg-slate-900/60"
      )}
      initial={{ opacity: 0, y: 10 }}
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-center justify-between border-b px-4 py-3",
          isLight ? "border-border" : "border-slate-700/50"
        )}
      >
        <div className="flex items-center gap-3">
          <div className={cn("rounded-xl p-2", config.icon.bgColor)}>
            <Icon className={cn("h-5 w-5", config.icon.color)} />
          </div>
          <div>
            <span
              className={cn(
                "font-semibold text-sm",
                isLight ? "text-foreground" : "text-slate-200"
              )}
            >
              {config.displayName}
            </span>
            {executionTime && (
              <p className={cn("text-xs", isLight ? "text-muted-foreground" : "text-slate-500")}>
                {executionTime}s
              </p>
            )}
          </div>
        </div>
        <ToolStatusBadge status={status} />
      </div>

      {/* Arguments Section */}
      <div className={cn("border-b", isLight ? "border-border/50" : "border-slate-700/30")}>
        <button
          className={cn(
            "flex w-full items-center justify-between px-4 py-2.5 text-xs transition-colors",
            isLight
              ? "text-muted-foreground hover:text-foreground"
              : "text-slate-400 hover:text-slate-300"
          )}
          onClick={() => setShowArgs(!showArgs)}
        >
          <div className="flex items-center gap-2">
            <Code className="h-3.5 w-3.5" />
            <span className="font-medium uppercase tracking-wider">Arguments</span>
          </div>
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
                  <pre
                    className={cn(
                      "max-h-40 overflow-auto rounded-lg border p-3 font-mono text-xs",
                      isLight
                        ? "border-border bg-muted/50 text-foreground"
                        : "border-slate-800/50 bg-slate-950/50 text-slate-300"
                    )}
                  >
                    <code>{formatJSON(args)}</code>
                  </pre>
                  <button
                    className={cn(
                      "absolute top-2 right-2 rounded-md p-1.5 opacity-0 transition-opacity group-hover:opacity-100",
                      isLight
                        ? "bg-muted text-muted-foreground hover:text-foreground"
                        : "bg-slate-800/50 text-slate-400 hover:text-slate-200"
                    )}
                    onClick={() => handleCopy(formatJSON(args))}
                  >
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
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
              {error ? "Error" : "Result"}
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
                        text="Processing..."
                      />
                    </div>
                  ) : error ? (
                    <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3">
                      <code className="whitespace-pre-wrap font-mono text-destructive text-xs">
                        {error}
                      </code>
                    </div>
                  ) : (
                    <div className="group relative">
                      <pre
                        className={cn(
                          "max-h-64 overflow-auto rounded-lg border p-3 font-mono text-xs",
                          isLight
                            ? "border-border bg-muted/50 text-foreground"
                            : "border-slate-800/50 bg-slate-950/50 text-slate-300"
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
