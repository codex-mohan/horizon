"use client";

import { cn } from "@workspace/ui/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronUp, ExternalLink, FileText, Globe } from "lucide-react";
import { useState } from "react";
import { useTheme } from "@/components/theme/theme-provider";
import { getToolUIConfig } from "@/lib/tool-config";
import { ModernSpinner, ShimmerText, ToolStatusBadge } from "./loading-effects";

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
 * Compact card: header is the expand/collapse toggle.
 * URL + page content are shown together in the expandable body.
 */
export function FetchUrlTool({
  toolName,
  status,
  args,
  result,
  error,
  isLoading,
}: FetchUrlToolProps) {
  const [expanded, setExpanded] = useState(false);
  const [isContentExpanded, setIsContentExpanded] = useState(false);
  const config = getToolUIConfig(toolName);
  const { themeMode } = useTheme();
  const isLight = themeMode === "light";

  const url = args.url || args.link || args.href || "";

  // Truncate result for preview
  const previewLength = 300;
  const shouldTruncate = result && result.length > previewLength;
  const displayResult =
    shouldTruncate && !isContentExpanded ? `${result.slice(0, previewLength)}...` : result;

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "overflow-hidden rounded-xl border shadow-xl",
        isLight
          ? "border-border bg-gradient-to-br from-cyan-500/5 to-blue-500/5"
          : "border-cyan-500/20 bg-gradient-to-br from-cyan-950/30 to-blue-950/30"
      )}
      initial={{ opacity: 0, y: 10 }}
    >
      {/* Header — click to expand/collapse */}
      <button
        className={cn(
          "flex w-full items-center justify-between px-4 py-3 text-left transition-colors",
          isLight ? "hover:bg-muted/20" : "hover:bg-white/5"
        )}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className={cn("rounded-xl p-2", config.icon.bgColor)}>
            <Globe className={cn("h-5 w-5", config.icon.color)} />
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
            {url && (
              <p
                className={cn(
                  "max-w-[240px] truncate text-xs",
                  isLight ? "text-muted-foreground" : "text-slate-500"
                )}
              >
                {url}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ToolStatusBadge status={status} />
          {expanded ? (
            <ChevronUp className={cn("h-3.5 w-3.5", isLight ? "text-muted-foreground" : "text-slate-500")} />
          ) : (
            <ChevronDown className={cn("h-3.5 w-3.5", isLight ? "text-muted-foreground" : "text-slate-500")} />
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
                isLight ? "border-border/50" : "border-cyan-500/10"
              )}
            >
              {/* URL link */}
              {url && (
                <a
                  className={cn(
                    "group flex items-center gap-2 rounded-lg border p-2.5 transition-colors",
                    isLight
                      ? "border-primary/20 bg-primary/5 hover:bg-primary/10"
                      : "border-cyan-500/20 bg-cyan-950/20 hover:bg-cyan-950/30"
                  )}
                  href={url}
                  onClick={(e) => e.stopPropagation()}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <Globe className={cn("h-4 w-4 flex-shrink-0", isLight ? "text-primary" : "text-cyan-400")} />
                  <span
                    className={cn(
                      "flex-1 truncate text-sm",
                      isLight ? "text-primary" : "text-cyan-300"
                    )}
                  >
                    {url}
                  </span>
                  <ExternalLink
                    className={cn(
                      "h-4 w-4 flex-shrink-0 transition-colors",
                      isLight
                        ? "text-primary/50 group-hover:text-primary"
                        : "text-cyan-400/50 group-hover:text-cyan-400"
                    )}
                  />
                </a>
              )}

              {/* Content */}
              {isLoading && !result && !error ? (
                <div className="flex flex-col items-center justify-center gap-3 py-6">
                  <ModernSpinner size="md" />
                  <ShimmerText
                    className={cn("text-sm", isLight ? "text-foreground" : "")}
                    text="Fetching content..."
                  />
                </div>
              ) : error ? (
                <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3">
                  <div className="mb-1.5 flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-destructive" />
                    <span className="font-medium text-destructive text-sm">Failed to fetch</span>
                  </div>
                  <p className="text-destructive/80 text-xs">{error}</p>
                </div>
              ) : result ? (
                <div>
                  <div className="mb-2 flex items-center gap-1.5">
                    <FileText className={cn("h-3.5 w-3.5", isLight ? "text-primary" : "text-cyan-400")} />
                    <span
                      className={cn(
                        "text-xs font-medium uppercase tracking-wider",
                        isLight ? "text-muted-foreground" : "text-slate-500"
                      )}
                    >
                      Content
                    </span>
                  </div>
                  <div
                    className={cn(
                      "relative rounded-lg border p-3",
                      isLight ? "border-border bg-muted/30" : "border-slate-700/30 bg-slate-900/30",
                      !isContentExpanded && shouldTruncate && "max-h-48 overflow-hidden"
                    )}
                  >
                    <pre
                      className={cn(
                        "whitespace-pre-wrap font-sans text-xs leading-relaxed",
                        isLight ? "text-foreground" : "text-slate-300"
                      )}
                    >
                      {displayResult}
                    </pre>
                    {!isContentExpanded && shouldTruncate && (
                      <div
                        className={cn(
                          "absolute right-0 bottom-0 left-0 h-12",
                          isLight
                            ? "bg-gradient-to-t from-muted/80 to-transparent"
                            : "bg-gradient-to-t from-slate-900/80 to-transparent"
                        )}
                      />
                    )}
                  </div>
                  {shouldTruncate && (
                    <button
                      className={cn(
                        "mt-1.5 flex items-center gap-1 text-xs transition-colors",
                        isLight
                          ? "text-primary hover:text-primary/80"
                          : "text-cyan-400 hover:text-cyan-300"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsContentExpanded(!isContentExpanded);
                      }}
                    >
                      {isContentExpanded ? (
                        <>
                          <ChevronUp className="h-3.5 w-3.5" />
                          Show less
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3.5 w-3.5" />
                          Show more ({result.length - previewLength} characters)
                        </>
                      )}
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
