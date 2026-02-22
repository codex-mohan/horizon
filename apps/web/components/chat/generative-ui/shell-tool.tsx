"use client";

import { cn } from "@workspace/ui/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Check, ChevronDown, ChevronUp, Copy, Terminal, Wrench } from "lucide-react";
import { useMemo, useState } from "react";
import { useTheme } from "@/components/theme/theme-provider";
import { getToolUIConfig } from "@/lib/tool-config";
import { ModernSpinner, ShimmerText, ToolStatusBadge } from "./loading-effects";

interface ShellResult {
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  success: boolean;
  duration: number;
  truncated: boolean;
}

interface ShellToolProps {
  toolName: string;
  status: "pending" | "executing" | "completed" | "failed";
  args: Record<string, unknown>;
  result?: string;
  error?: string;
  isLoading?: boolean;
}

const ANSI_COLORS: Record<string, string> = {
  "30": "text-gray-800",
  "31": "text-red-500",
  "32": "text-green-500",
  "33": "text-yellow-500",
  "34": "text-blue-500",
  "35": "text-purple-500",
  "36": "text-cyan-500",
  "37": "text-white",
  "90": "text-gray-500",
  "91": "text-red-400",
  "92": "text-green-400",
  "93": "text-yellow-400",
  "94": "text-blue-400",
  "95": "text-purple-400",
  "96": "text-cyan-400",
  "97": "text-gray-100",
};

function parseAnsiColors(text: string): React.ReactNode[] {
  const ansiRegex = /\x1b\[([0-9;]+)m/g;
  const tokens: Array<{ text: string; codes: string[] }> = [];
  let currentCodes: string[] = [];
  let currentPosition = 0;

  while (currentPosition < text.length) {
    const match = text.slice(currentPosition).match(ansiRegex);

    if (!match || match.index === undefined) {
      if (currentPosition < text.length) {
        tokens.push({
          text: text.slice(currentPosition),
          codes: [...currentCodes],
        });
      }
      break;
    }

    if (match.index > 0) {
      tokens.push({
        text: text.slice(currentPosition, currentPosition + match.index),
        codes: [...currentCodes],
      });
    }

    const codeStr = match[1];
    if (codeStr === "0") {
      currentCodes = [];
    } else {
      const newCodes = codeStr.split(";");
      for (const code of newCodes) {
        if (code === "0") {
          currentCodes = [];
        } else if (code === "1") {
          currentCodes.push("font-bold");
        } else if (ANSI_COLORS[code]) {
          currentCodes = currentCodes.filter(
            (c) => !ANSI_COLORS[c.replace("text-", "").replace("-500", "").replace("-400", "")]
          );
          currentCodes.push(ANSI_COLORS[code]);
        }
      }
    }

    currentPosition += match.index + match[0].length;
  }

  return tokens.map((token, i) => {
    if (token.codes.length === 0) {
      return <span key={i}>{token.text}</span>;
    }
    return (
      <span key={i} className={cn(...token.codes)}>
        {token.text}
      </span>
    );
  });
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
}

function parseResult(result?: string): ShellResult | null {
  if (!result) return null;

  try {
    const parsed = JSON.parse(result);
    if (typeof parsed.command === "string" && typeof parsed.exitCode === "number") {
      return parsed as ShellResult;
    }
  } catch {
    // Not JSON
  }

  return null;
}

export function ShellTool({ toolName, status, args, result, error, isLoading }: ShellToolProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const config = getToolUIConfig(toolName);
  const { themeMode } = useTheme();
  const isLight = themeMode === "light";

  const shellResult = useMemo(() => parseResult(result), [result]);

  const command = useMemo(() => {
    if (shellResult?.command) return shellResult.command;
    return (args.command as string) || (args.cmd as string) || "";
  }, [args, shellResult]);

  const duration = useMemo(() => shellResult?.duration || 0, [shellResult]);

  const isSuccess = useMemo(() => {
    if (shellResult) return shellResult.success;
    if (error) return false;
    if (status === "completed") return true;
    return false;
  }, [shellResult, error, status]);

  const stdout = shellResult?.stdout || "";
  const stderr = shellResult?.stderr || error || "";
  const isTruncated = shellResult?.truncated || false;

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isExecuting = (isLoading || status === "executing") && !result && !error;

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className={cn("overflow-hidden rounded-xl", "glass")}
      initial={{ opacity: 0, y: 10 }}
    >
      {/* Compact Header */}
      <div
        className={cn(
          "flex cursor-pointer items-center justify-between px-3 py-2",
          "hover:bg-primary/5 transition-colors"
        )}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <div className={cn("rounded-lg p-1.5", config.icon.bgColor)}>
            <Wrench className={cn("h-4 w-4", config.icon.color)} />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">
              {command ? `"${command.slice(0, 25)}${command.length > 25 ? "..." : ""}"` : "Shell"}
            </span>
            {shellResult && (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-medium",
                  isSuccess
                    ? isLight
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-emerald-500/20 text-emerald-400"
                    : isLight
                      ? "bg-red-100 text-red-700"
                      : "bg-red-500/20 text-red-400"
                )}
              >
                Exit {shellResult.exitCode}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {duration > 0 && (
            <span className="text-xs text-muted-foreground">{formatDuration(duration)}</span>
          )}
          <ToolStatusBadge status={status} />
        </div>
      </div>

      {/* Expandable Content */}
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
                "border-t px-3 py-2",
                isLight ? "border-border/50" : "border-primary/10"
              )}
            >
              {/* Loading State */}
              {isExecuting && (
                <div className="flex items-center justify-center gap-3 py-4">
                  <ModernSpinner size="sm" />
                  <ShimmerText
                    className={cn("text-sm", isLight ? "text-foreground" : "")}
                    text="Executing..."
                  />
                </div>
              )}

              {/* Error State */}
              {error && !shellResult && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-2">
                  <p className="text-destructive text-xs">{error}</p>
                </div>
              )}

              {/* Command */}
              {command && !isExecuting && (
                <div className="group relative mb-2">
                  <div className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground">
                    <Terminal className="h-3 w-3" />
                    Command
                  </div>
                  <code
                    className={cn(
                      "block rounded-lg p-2 font-mono text-sm",
                      isLight ? "bg-muted/50" : "bg-black/30"
                    )}
                  >
                    <span className="text-muted-foreground">$ </span>
                    <span className={isLight ? "text-emerald-600" : "text-emerald-400"}>
                      {command}
                    </span>
                  </code>
                  <button
                    className="absolute right-2 top-6 rounded bg-background/80 p-1.5 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopy(command);
                    }}
                  >
                    {copied ? (
                      <Check className="h-3 w-3 text-emerald-500" />
                    ) : (
                      <Copy className="h-3 w-3 text-muted-foreground" />
                    )}
                  </button>
                </div>
              )}

              {/* Truncation Warning */}
              {isTruncated && (
                <div className="mb-2 flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-xs text-amber-600 dark:text-amber-400">
                    Output was truncated (too large)
                  </span>
                </div>
              )}

              {/* Stderr */}
              {stderr && (
                <div className="mb-2 rounded-lg border border-red-500/20 bg-red-500/10 p-2">
                  <div className="mb-1 flex items-center gap-1 text-xs font-medium text-red-500">
                    <AlertTriangle className="h-3 w-3" />
                    stderr
                  </div>
                  <pre className="overflow-auto font-mono text-xs text-red-400">
                    {parseAnsiColors(stderr)}
                  </pre>
                </div>
              )}

              {/* Stdout */}
              {stdout && (
                <div className="group relative">
                  <pre
                    className={cn(
                      "max-h-64 overflow-auto rounded-lg p-2 font-mono text-xs",
                      isLight ? "bg-muted/50 text-foreground" : "bg-black/30 text-white/80"
                    )}
                  >
                    {parseAnsiColors(stdout)}
                  </pre>
                  <button
                    className="absolute right-2 top-2 rounded bg-background/80 p-1.5 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopy(stdout);
                    }}
                  >
                    {copied ? (
                      <Check className="h-3 w-3 text-emerald-500" />
                    ) : (
                      <Copy className="h-3 w-3 text-muted-foreground" />
                    )}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
