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
  error?: string;
  isLoading?: boolean;
}

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

  const previewLength = 300;
  const shouldTruncate = result && result.length > previewLength;
  const displayResult =
    shouldTruncate && !isContentExpanded ? `${result.slice(0, previewLength)}...` : result;

  const isFetching = (isLoading || status === "executing") && !result && !error;

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
            <Globe className={cn("h-4 w-4", config.icon.color)} />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">
              {url
                ? `${url.replace(/^https?:\/\//, "").slice(0, 25)}${url.length > 40 ? "..." : ""}`
                : "Fetch URL"}
            </span>
            {result && status === "completed" && (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs",
                  isLight ? "bg-primary/10 text-primary" : "bg-primary/20 text-primary-foreground"
                )}
              >
                {result.length.toLocaleString()} chars
              </span>
            )}
          </div>
        </div>
        <ToolStatusBadge status={status} />
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
              {isFetching && (
                <div className="flex items-center justify-center gap-3 py-4">
                  <ModernSpinner size="sm" />
                  <ShimmerText
                    className={cn("text-sm", isLight ? "text-foreground" : "")}
                    text="Fetching content..."
                  />
                </div>
              )}

              {/* Error State */}
              {error && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-2">
                  <p className="text-destructive text-xs">{error}</p>
                </div>
              )}

              {/* URL Link */}
              {url && !isFetching && (
                <a
                  className={cn(
                    "group mb-2 flex items-center gap-2 rounded-lg border p-2 transition-colors",
                    isLight
                      ? "border-border bg-muted/30 hover:bg-muted/50"
                      : "border-primary/10 bg-background/30 hover:bg-background/50"
                  )}
                  href={url}
                  onClick={(e) => e.stopPropagation()}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <Globe className="h-4 w-4 flex-shrink-0 text-primary" />
                  <span className="flex-1 truncate text-sm text-primary">{url}</span>
                  <ExternalLink className="h-4 w-4 flex-shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
                </a>
              )}

              {/* Content */}
              {result && !isFetching && (
                <div>
                  <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <FileText className="h-3 w-3" />
                    Content
                  </div>
                  <div
                    className={cn(
                      "relative rounded-lg border p-3",
                      isLight ? "border-border bg-muted/30" : "border-primary/10 bg-background/30",
                      !isContentExpanded && shouldTruncate && "max-h-48 overflow-hidden"
                    )}
                  >
                    <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-foreground">
                      {displayResult}
                    </pre>
                    {!isContentExpanded && shouldTruncate && (
                      <div
                        className={cn(
                          "absolute right-0 bottom-0 left-0 h-12",
                          isLight
                            ? "bg-gradient-to-t from-muted to-transparent"
                            : "bg-gradient-to-t from-background to-transparent"
                        )}
                      />
                    )}
                  </div>
                  {shouldTruncate && (
                    <button
                      className={cn(
                        "mt-1.5 flex items-center gap-1 text-xs transition-colors",
                        "text-primary hover:text-primary/80"
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
                          Show more ({(result.length - previewLength).toLocaleString()} characters)
                        </>
                      )}
                    </button>
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
