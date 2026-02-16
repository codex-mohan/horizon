"use client";

import { cn } from "@workspace/ui/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { ExternalLink, Globe, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useTheme } from "@/components/theme/theme-provider";
import { getToolUIConfig } from "@/lib/tool-config";
import { ModernSpinner, ShimmerText, ToolStatusBadge } from "./loading-effects";

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

interface WebSearchToolProps {
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
 * Parse markdown-formatted search results from the tool
 * Format:
 * ## Search results for 'query'
 *
 * ### 1. [Title](URL)
 * snippet text
 *
 * ### 2. [Title](URL)
 * snippet text
 */
function parseMarkdownResults(result: string): SearchResult[] {
  const results: SearchResult[] = [];

  // Match pattern: ### N. [Title](URL)\nsnippet
  const resultPattern = /###\s*\d+\.\s*\[([^\]]+)\]\(([^)]+)\)\s*\n([^\n#]+)/g;
  let match;

  while ((match = resultPattern.exec(result)) !== null) {
    const [, title, url, snippet] = match;
    if (title && url) {
      results.push({
        title: title.trim(),
        url: url.trim(),
        snippet: snippet?.trim() || "",
      });
    }
  }

  return results;
}

/**
 * Web Search Tool Component
 * Compact, ergonomic design with real-time status updates
 * Uses glassmorphic styling from globals.css
 */
export function WebSearchTool({
  toolName,
  status,
  args,
  result,
  error,
  isLoading,
}: WebSearchToolProps) {
  const [expanded, setExpanded] = useState(true);
  const config = getToolUIConfig(toolName);
  const { themeMode } = useTheme();
  const isLight = themeMode === "light";

  // Get the search query
  const query = args?.query || args?.q || args?.search || "";

  // Parse search results from markdown format
  const searchResults = useMemo(() => {
    if (!result) return [];

    // Try parsing markdown format first
    const markdownResults = parseMarkdownResults(result);
    if (markdownResults.length > 0) {
      return markdownResults;
    }

    // Fallback: try JSON parse
    try {
      const parsed = JSON.parse(result);
      if (Array.isArray(parsed)) return parsed;
      if (parsed.results) return parsed.results;
    } catch {
      // Not JSON, return empty - will show raw result
    }

    return [];
  }, [result]);

  // Determine if we have actual results to show
  const hasResults = searchResults.length > 0;
  const isSearching = (isLoading || status === "executing") && !result && !error;

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "overflow-hidden rounded-xl",
        "glass" // Use glassmorphic class from globals.css
      )}
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
            <Search className={cn("h-4 w-4", config.icon.color)} />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">
              {query ? `"${query.slice(0, 30)}${query.length > 30 ? "..." : ""}"` : "Web Search"}
            </span>
            {hasResults && status === "completed" && (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs",
                  isLight ? "bg-primary/10 text-primary" : "bg-primary/20 text-primary-foreground"
                )}
              >
                {searchResults.length} results
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
              {isSearching && (
                <div className="flex items-center justify-center gap-3 py-4">
                  <ModernSpinner size="sm" />
                  <ShimmerText
                    className={cn("text-sm", isLight ? "text-foreground" : "")}
                    text="Searching..."
                  />
                </div>
              )}

              {/* Error State */}
              {error && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-2">
                  <p className="text-destructive text-xs">{error}</p>
                </div>
              )}

              {/* Results Grid - Compact */}
              {hasResults && (
                <div className="space-y-1.5">
                  {searchResults.map((item: SearchResult, index: number) => (
                    <motion.a
                      animate={{ opacity: 1, x: 0 }}
                      className={cn(
                        "group flex items-start gap-2 rounded-lg p-2 transition-all",
                        isLight
                          ? "bg-muted/30 hover:bg-muted/50"
                          : "bg-background/30 hover:bg-background/50"
                      )}
                      href={item.url}
                      initial={{ opacity: 0, x: -10 }}
                      key={`${item.url}-${index}`}
                      rel="noopener noreferrer"
                      target="_blank"
                      transition={{ delay: index * 0.05 }}
                    >
                      <Globe
                        className={cn(
                          "mt-0.5 h-4 w-4 flex-shrink-0",
                          isLight ? "text-primary" : "text-primary-foreground"
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <h4
                          className={cn(
                            "line-clamp-1 font-medium text-sm",
                            isLight
                              ? "text-foreground group-hover:text-primary"
                              : "text-foreground group-hover:text-primary-foreground"
                          )}
                        >
                          {item.title}
                        </h4>
                        <p
                          className={cn(
                            "line-clamp-2 text-xs",
                            isLight ? "text-muted-foreground" : "text-muted-foreground"
                          )}
                        >
                          {item.snippet}
                        </p>
                        <span
                          className={cn(
                            "mt-0.5 flex items-center gap-1 text-xs",
                            isLight
                              ? "text-primary/60 group-hover:text-primary"
                              : "text-primary-foreground/60 group-hover:text-primary-foreground"
                          )}
                        >
                          {(() => {
                            try {
                              return new URL(item.url).hostname;
                            } catch {
                              return item.url.replace(/^https?:\/\//, "").split("/")[0];
                            }
                          })()}
                          <ExternalLink className="h-2.5 w-2.5" />
                        </span>
                      </div>
                    </motion.a>
                  ))}
                </div>
              )}

              {/* Fallback: Raw result text (when no parsed results) */}
              {!isSearching && !error && !hasResults && result && (
                <div className={cn("rounded-lg p-2", isLight ? "bg-muted/30" : "bg-background/30")}>
                  <pre className="whitespace-pre-wrap font-mono text-xs">{result}</pre>
                </div>
              )}

              {/* No results message */}
              {!isSearching && !error && !hasResults && !result && status === "completed" && (
                <p
                  className={cn(
                    "py-2 text-center text-sm",
                    isLight ? "text-muted-foreground" : "text-muted-foreground"
                  )}
                >
                  No results found
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
