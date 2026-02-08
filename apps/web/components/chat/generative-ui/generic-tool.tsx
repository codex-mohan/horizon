"use client";

import { useState } from "react";
import { cn } from "@workspace/ui/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, Copy, Check, Code } from "lucide-react";
import { ToolStatusBadge, ModernSpinner, ShimmerText } from "./loading-effects";
import { getToolUIConfig, getToolIcon } from "@/lib/tool-config";
import { useTheme } from "@/components/theme/theme-provider";

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
    startedAt && completedAt
      ? Math.round((completedAt - startedAt) / 10) / 100
      : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-xl overflow-hidden border shadow-lg",
        isLight
          ? "bg-card/95 border-border"
          : "bg-slate-900/60 border-slate-700/50",
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-center justify-between px-4 py-3 border-b",
          isLight ? "border-border" : "border-slate-700/50",
        )}
      >
        <div className="flex items-center gap-3">
          <div className={cn("p-2 rounded-xl", config.icon.bgColor)}>
            <Icon className={cn("w-5 h-5", config.icon.color)} />
          </div>
          <div>
            <span
              className={cn(
                "text-sm font-semibold",
                isLight ? "text-foreground" : "text-slate-200",
              )}
            >
              {config.displayName}
            </span>
            {executionTime && (
              <p
                className={cn(
                  "text-xs",
                  isLight ? "text-muted-foreground" : "text-slate-500",
                )}
              >
                {executionTime}s
              </p>
            )}
          </div>
        </div>
        <ToolStatusBadge status={status} />
      </div>

      {/* Arguments Section */}
      <div
        className={cn(
          "border-b",
          isLight ? "border-border/50" : "border-slate-700/30",
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
          <div className="flex items-center gap-2">
            <Code className="w-3.5 h-3.5" />
            <span className="font-medium uppercase tracking-wider">
              Arguments
            </span>
          </div>
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
                  <pre
                    className={cn(
                      "p-3 rounded-lg text-xs font-mono border overflow-auto max-h-40",
                      isLight
                        ? "bg-muted/50 text-foreground border-border"
                        : "bg-slate-950/50 text-slate-300 border-slate-800/50",
                    )}
                  >
                    <code>{formatJSON(args)}</code>
                  </pre>
                  <button
                    onClick={() => handleCopy(formatJSON(args))}
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
              {error ? "Error" : "Result"}
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
                        text="Processing..."
                        className={cn(
                          "text-sm",
                          isLight ? "text-muted-foreground" : "text-slate-400",
                        )}
                      />
                    </div>
                  ) : error ? (
                    <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                      <code className="text-xs font-mono text-destructive whitespace-pre-wrap">
                        {error}
                      </code>
                    </div>
                  ) : (
                    <div className="relative group">
                      <pre
                        className={cn(
                          "p-3 rounded-lg text-xs font-mono border overflow-auto max-h-64",
                          isLight
                            ? "bg-muted/50 text-foreground border-border"
                            : "bg-slate-950/50 text-slate-300 border-slate-800/50",
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
