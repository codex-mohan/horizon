"use client";

import { cn } from "@workspace/ui/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Terminal,
  AlertCircle,
  Clock,
  FolderOpen,
  AlertTriangle,
} from "lucide-react";
import { useState, useMemo } from "react";
import { ModernSpinner, ShimmerText } from "./loading-effects";

/**
 * Shell execution result structure from backend
 */
interface ShellResult {
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  success: boolean;
  duration: number;
  cwd: string;
  truncated: boolean;
}

interface ShellToolProps {
  toolName: string;
  status: "pending" | "executing" | "completed" | "failed";
  args: Record<string, unknown>;
  result?: string;
  startedAt?: number;
  completedAt?: number;
  error?: string;
  isLoading?: boolean;
}

/**
 * ANSI color code to CSS class mapping
 */
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

/**
 * Parse ANSI color codes and convert to styled spans
 */
function parseAnsiColors(text: string): React.ReactNode[] {
  const ansiRegex = /\x1b\[([0-9;]+)m/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  // Reset tracking
  const resetAll = "\x1b[0m";

  // Split by ANSI codes
  const tokens: Array<{ text: string; codes: string[] }> = [];
  let currentCodes: string[] = [];
  let currentPosition = 0;

  while (currentPosition < text.length) {
    const match = text.slice(currentPosition).match(ansiRegex);

    if (!match || match.index === undefined) {
      // No more ANSI codes, add remaining text
      if (currentPosition < text.length) {
        tokens.push({
          text: text.slice(currentPosition),
          codes: [...currentCodes],
        });
      }
      break;
    }

    // Add text before this code
    if (match.index > 0) {
      tokens.push({
        text: text.slice(currentPosition, currentPosition + match.index),
        codes: [...currentCodes],
      });
    }

    // Update current codes
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
          // Replace any existing color
          currentCodes = currentCodes.filter((c) => !ANSI_COLORS[c.replace("text-", "").replace("-500", "").replace("-400", "")]);
          currentCodes.push(ANSI_COLORS[code]);
        }
      }
    }

    currentPosition += match.index + match[0].length;
  }

  // Convert tokens to React nodes
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

/**
 * Format duration in human-readable form
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const seconds = ms / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
}

/**
 * Truncate working directory for display
 */
function truncateCwd(cwd: string, maxLength = 40): string {
  if (cwd.length <= maxLength) return cwd;

  // Try to show last meaningful parts
  const parts = cwd.split(/[/\\]/);
  if (parts.length <= 2) return cwd;

  // Show first letter of early parts + last 2-3 parts
  const lastParts = parts.slice(-3);
  const firstParts = parts.slice(0, -3);

  if (firstParts.length > 0) {
    const shortened = firstParts.map((p) => (p ? p[0] : "")).join("/");
    return `${shortened}/.../${lastParts.join("/")}`;
  }

  return `.../${lastParts.join("/")}`;
}

/**
 * Parse result string into ShellResult object
 */
function parseResult(result?: string): ShellResult | null {
  if (!result) return null;

  try {
    const parsed = JSON.parse(result);
    if (
      typeof parsed.command === "string" &&
      typeof parsed.exitCode === "number"
    ) {
      return parsed as ShellResult;
    }
  } catch {
    // Not JSON, return null to use legacy parsing
  }

  return null;
}

/**
 * Shell Tool Component
 * Compact, glassmorphic design matching web search and weather tools
 */
export function ShellTool({
  toolName,
  status,
  args,
  result,
  error,
  isLoading,
}: ShellToolProps) {
  const [showOutput, setShowOutput] = useState(true);
  const [copied, setCopied] = useState(false);

  // Parse the result
  const shellResult = useMemo(() => parseResult(result), [result]);

  // Get command from args or result
  const command = useMemo(() => {
    if (shellResult?.command) return shellResult.command;
    return (args.command as string) || (args.cmd as string) || "";
  }, [args, shellResult]);

  // Get working directory
  const cwd = useMemo(() => {
    return shellResult?.cwd || process.cwd();
  }, [shellResult]);

  // Get duration
  const duration = useMemo(() => {
    return shellResult?.duration || 0;
  }, [shellResult]);

  // Determine if command succeeded
  const isSuccess = useMemo(() => {
    if (shellResult) return shellResult.success;
    if (error) return false;
    if (status === "completed") return true;
    return false;
  }, [shellResult, error, status]);

  // Get stdout and stderr
  const stdout = shellResult?.stdout || "";
  const stderr = shellResult?.stderr || error || "";
  const isTruncated = shellResult?.truncated || false;

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Loading state
  if (isLoading && !result) {
    return (
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="glass overflow-hidden rounded-xl border border-white/10 shadow-lg"
        initial={{ opacity: 0, y: 10 }}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="rounded-lg bg-slate-500/20 p-2">
            <Terminal className="h-4 w-4 text-slate-400" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white/90">
                Shell Execute
              </span>
              <ModernSpinner size="sm" />
            </div>
            <ShimmerText className="mt-1 text-xs text-white/50" text={command} />
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="glass overflow-hidden rounded-xl border border-white/10 shadow-lg"
      initial={{ opacity: 0, y: 10 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          {/* Icon with status color */}
          <div
            className={cn(
              "rounded-lg p-2",
              isSuccess
                ? "bg-emerald-500/20"
                : "bg-red-500/20"
            )}
          >
            {isSuccess ? (
              <Check className="h-4 w-4 text-emerald-400" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-400" />
            )}
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white/90">
                Shell Execute
              </span>
              {/* Exit code badge */}
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-medium",
                  isSuccess
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-red-500/20 text-red-400"
                )}
              >
                Exit {shellResult?.exitCode ?? (error ? 1 : 0)}
              </span>
            </div>
            {/* Working directory */}
            <div className="mt-0.5 flex items-center gap-1 text-xs text-white/50">
              <FolderOpen className="h-3 w-3" />
              <span className="font-mono">{truncateCwd(cwd)}</span>
            </div>
          </div>
        </div>

        {/* Duration */}
        {duration > 0 && (
          <div className="flex items-center gap-1 text-xs text-white/50">
            <Clock className="h-3 w-3" />
            <span>{formatDuration(duration)}</span>
          </div>
        )}
      </div>

      {/* Command */}
      <div className="border-t border-white/5 px-4 py-2">
        <div className="group relative">
          <code className="block rounded-lg bg-black/30 p-2 font-mono text-sm">
            <span className="text-white/40">$ </span>
            <span className="text-emerald-400">{command}</span>
          </code>
          <button
            className="absolute right-2 top-2 rounded bg-white/10 p-1.5 opacity-0 transition-opacity group-hover:opacity-100"
            onClick={() => handleCopy(command)}
          >
            {copied ? (
              <Check className="h-3 w-3 text-emerald-400" />
            ) : (
              <Copy className="h-3 w-3 text-white/60" />
            )}
          </button>
        </div>
      </div>

      {/* Truncation warning */}
      {isTruncated && (
        <div className="flex items-center gap-2 border-t border-white/5 bg-amber-500/10 px-4 py-2">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
          <span className="text-xs text-amber-400">
            Output was truncated (too large)
          </span>
        </div>
      )}

      {/* Output section */}
      {(stdout || stderr) && (
        <div className="border-t border-white/5">
          <button
            className="flex w-full items-center justify-between px-4 py-2 text-xs text-white/50 transition-colors hover:text-white/70"
            onClick={() => setShowOutput(!showOutput)}
          >
            <span className="font-medium uppercase tracking-wider">
              {stderr && !stdout ? "Error Output" : "Output"}
            </span>
            {showOutput ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>

          <AnimatePresence>
            {showOutput && (
              <motion.div
                animate={{ height: "auto", opacity: 1 }}
                className="overflow-hidden"
                exit={{ height: 0, opacity: 0 }}
                initial={{ height: 0, opacity: 0 }}
              >
                <div className="px-4 pb-3">
                  {/* Stderr (errors) */}
                  {stderr && (
                    <div className="mb-2 rounded-lg border border-red-500/20 bg-red-500/10 p-2">
                      <div className="mb-1 flex items-center gap-1 text-xs font-medium text-red-400">
                        <AlertCircle className="h-3 w-3" />
                        stderr
                      </div>
                      <pre className="overflow-auto font-mono text-xs text-red-300">
                        {parseAnsiColors(stderr)}
                      </pre>
                    </div>
                  )}

                  {/* Stdout */}
                  {stdout && (
                    <div className="group relative">
                      <pre className="max-h-64 overflow-auto rounded-lg bg-black/30 p-2 font-mono text-xs text-white/80">
                        {parseAnsiColors(stdout)}
                      </pre>
                      <button
                        className="absolute right-2 top-2 rounded bg-white/10 p-1.5 opacity-0 transition-opacity group-hover:opacity-100"
                        onClick={() => handleCopy(stdout)}
                      >
                        {copied ? (
                          <Check className="h-3 w-3 text-emerald-400" />
                        ) : (
                          <Copy className="h-3 w-3 text-white/60" />
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
