"use client";

import { cn } from "@workspace/ui/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, ChevronUp, Copy } from "lucide-react";
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
 * Compact card with clickable header to expand args + result.
 * No separate "Arguments" / "Details" label row — the header IS the toggle.
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
  const [expanded, setExpanded] = useState(false);
  const [copiedArgs, setCopiedArgs] = useState(false);
  const [copiedResult, setCopiedResult] = useState(false);
  const config = getToolUIConfig(toolName);
  const Icon = getToolIcon(toolName);
  const { themeMode } = useTheme();
  const isLight = themeMode === "light";

  const handleCopyArgs = async () => {
    await navigator.clipboard.writeText(JSON.stringify(args, null, 2));
    setCopiedArgs(true);
    setTimeout(() => setCopiedArgs(false), 2000);
  };

  const handleCopyResult = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    setCopiedResult(true);
    setTimeout(() => setCopiedResult(false), 2000);
  };

  const formatJSON = (obj: any) => JSON.stringify(obj, null, 2);

  const executionTime =
    startedAt && completedAt ? Math.round((completedAt - startedAt) / 10) / 100 : null;

  const hasExpandable = !!(result || error || isLoading || Object.keys(args).length > 0);

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "overflow-hidden rounded-xl border shadow-lg",
        isLight ? "border-border bg-card/95" : "border-slate-700/50 bg-slate-900/60"
      )}
      initial={{ opacity: 0, y: 10 }}
    >
      {/* Header — click to expand/collapse */}
      <button
        className={cn(
          "flex w-full items-center justify-between px-4 py-3 text-left transition-colors",
          isLight ? "hover:bg-muted/30" : "hover:bg-white/5"
        )}
        onClick={() => hasExpandable && setExpanded(!expanded)}
        style={{ cursor: hasExpandable ? "pointer" : "default" }}
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

        <div className="flex items-center gap-2">
          <ToolStatusBadge status={status} />
          {hasExpandable && (
            expanded
              ? <ChevronUp className={cn("h-3.5 w-3.5", isLight ? "text-muted-foreground" : "text-slate-500")} />
              : <ChevronDown className={cn("h-3.5 w-3.5", isLight ? "text-muted-foreground" : "text-slate-500")} />
          )}
        </div>
      </button>

      {/* Expandable body */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            animate={{ height: "auto", opacity: 1 }}
            className="overflow-hidden"
            exit={{ height: 0, opacity: 0 }}
            initial={{ height: 0, opacity: 0 }}
          >
            <div
              className={cn(
                "space-y-3 border-t px-4 py-3",
                isLight ? "border-border/50" : "border-slate-700/30"
              )}
            >
              {/* Arguments */}
              {Object.keys(args).length > 0 && (
                <div>
                  <p className={cn("mb-1.5 text-xs font-medium uppercase tracking-wider", isLight ? "text-muted-foreground" : "text-slate-500")}>
                    Arguments
                  </p>
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
                      onClick={handleCopyArgs}
                    >
                      {copiedArgs ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Result / Error / Loading */}
              {(result || error || isLoading) && (
                <div>
                  <p className={cn("mb-1.5 text-xs font-medium uppercase tracking-wider", isLight ? "text-muted-foreground" : "text-slate-500")}>
                    {error ? "Error" : "Result"}
                  </p>
                  {isLoading && !result && !error ? (
                    <div className="flex items-center gap-3 p-3">
                      <ModernSpinner size="sm" />
                      <ShimmerText
                        className={cn("text-sm", isLight ? "text-muted-foreground" : "text-slate-400")}
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
                        onClick={handleCopyResult}
                      >
                        {copiedResult ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
