"use client";

import { useState } from "react";
import { cn } from "@workspace/ui/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  FileText,
} from "lucide-react";
import { ToolStatusBadge, ModernSpinner, ShimmerText } from "./loading-effects";
import { getToolUIConfig } from "@/lib/tool-config";
import { useTheme } from "@/components/theme/theme-provider";

interface FetchUrlToolProps {
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
 * Fetch URL Tool Component
 * Displays fetched web content in a reader-friendly format
 * Theme-aware - works in both light and dark modes
 */
export function FetchUrlTool({
  toolName,
  status,
  args,
  result,
  startedAt,
  completedAt,
  error,
  isLoading,
}: FetchUrlToolProps) {
  const [showArgs, setShowArgs] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const config = getToolUIConfig(toolName);
  const { themeMode } = useTheme();
  const isLight = themeMode === "light";

  // Truncate result for preview
  const previewLength = 300;
  const shouldTruncate = result && result.length > previewLength;
  const displayResult =
    shouldTruncate && !isExpanded
      ? result.slice(0, previewLength) + "..."
      : result;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-xl overflow-hidden border shadow-xl",
        isLight
          ? "bg-gradient-to-br from-cyan-500/5 to-blue-500/5 border-border"
          : "bg-gradient-to-br from-cyan-950/30 to-blue-950/30 border-cyan-500/20",
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-center justify-between px-4 py-3 border-b",
          isLight ? "border-border" : "border-cyan-500/20",
        )}
      >
        <div className="flex items-center gap-3">
          <div className={cn("p-2 rounded-xl", config.icon.bgColor)}>
            <Globe className={cn("w-5 h-5", config.icon.color)} />
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
            <p
              className={cn(
                "text-xs",
                isLight ? "text-muted-foreground" : "text-slate-500",
              )}
            >
              Web page content
            </p>
          </div>
        </div>
        <ToolStatusBadge status={status} />
      </div>

      {/* URL Section */}
      <div
        className={cn(
          "border-b",
          isLight ? "border-border/50" : "border-cyan-500/10",
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
          <span className="font-medium uppercase tracking-wider">Source</span>
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
                <a
                  href={args.url || args.link || args.href || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "flex items-center gap-2 p-3 rounded-lg border transition-colors group",
                    isLight
                      ? "bg-primary/5 border-primary/20 hover:bg-primary/10"
                      : "bg-cyan-950/20 border-cyan-500/20 hover:bg-cyan-950/30",
                  )}
                >
                  <Globe
                    className={cn(
                      "w-4 h-4",
                      isLight ? "text-primary" : "text-cyan-400",
                    )}
                  />
                  <span
                    className={cn(
                      "text-sm truncate flex-1",
                      isLight ? "text-primary" : "text-cyan-300",
                    )}
                  >
                    {args.url || args.link || args.href || JSON.stringify(args)}
                  </span>
                  <ExternalLink
                    className={cn(
                      "w-4 h-4 transition-colors",
                      isLight
                        ? "text-primary/50 group-hover:text-primary"
                        : "text-cyan-400/50 group-hover:text-cyan-400",
                    )}
                  />
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Content Section */}
      <div className="p-4">
        {isLoading && !result && !error ? (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <ModernSpinner size="md" />
            <div className="text-center">
              <ShimmerText
                text="Fetching content..."
                className={cn("text-sm", isLight ? "text-foreground" : "")}
              />
              <p
                className={cn(
                  "text-xs mt-1",
                  isLight ? "text-muted-foreground" : "text-slate-500",
                )}
              >
                Loading page
              </p>
            </div>
          </div>
        ) : error ? (
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-destructive" />
              <span className="text-sm font-medium text-destructive">
                Failed to fetch
              </span>
            </div>
            <p className="text-xs text-destructive/80">{error}</p>
          </div>
        ) : result ? (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <FileText
                className={cn(
                  "w-4 h-4",
                  isLight ? "text-primary" : "text-cyan-400",
                )}
              />
              <span
                className={cn(
                  "text-xs uppercase tracking-wider font-medium",
                  isLight ? "text-muted-foreground" : "text-slate-500",
                )}
              >
                Content
              </span>
            </div>
            <div
              className={cn(
                "relative p-4 rounded-lg border",
                isLight
                  ? "bg-muted/30 border-border"
                  : "bg-slate-900/30 border-slate-700/30",
                !isExpanded && shouldTruncate && "max-h-48 overflow-hidden",
              )}
            >
              <pre
                className={cn(
                  "text-xs whitespace-pre-wrap font-sans leading-relaxed",
                  isLight ? "text-foreground" : "text-slate-300",
                )}
              >
                {displayResult}
              </pre>
              {!isExpanded && shouldTruncate && (
                <div
                  className={cn(
                    "absolute bottom-0 left-0 right-0 h-16",
                    isLight
                      ? "bg-gradient-to-t from-muted/80 to-transparent"
                      : "bg-gradient-to-t from-slate-900/80 to-transparent",
                  )}
                />
              )}
            </div>
            {shouldTruncate && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className={cn(
                  "mt-2 text-xs flex items-center gap-1 transition-colors",
                  isLight
                    ? "text-primary hover:text-primary/80"
                    : "text-cyan-400 hover:text-cyan-300",
                )}
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5" />
                    Show less
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" />
                    Show more ({result.length - previewLength} characters)
                  </>
                )}
              </button>
            )}
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}
