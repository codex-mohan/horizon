"use client";

import { cn } from "@workspace/ui/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Globe,
  Search,
} from "lucide-react";
import { useState } from "react";
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
 * Web Search Tool Component
 * Displays search results in a modern card-based layout
 * Theme-aware - works in both light and dark modes
 */
export function WebSearchTool({
  toolName,
  status,
  args,
  result,
  startedAt,
  completedAt,
  error,
  isLoading,
}: WebSearchToolProps) {
  const [showArgs, setShowArgs] = useState(true);
  const [expandedResults, setExpandedResults] = useState<Set<number>>(
    new Set()
  );
  const config = getToolUIConfig(toolName);
  const { themeMode } = useTheme();
  const isLight = themeMode === "light";

  // Parse search results from the result string
  const searchResults: SearchResult[] = (() => {
    if (!result) {
      return [];
    }
    try {
      // Try to parse as JSON first
      const parsed = JSON.parse(result);
      if (Array.isArray(parsed)) {
        return parsed;
      }
      if (parsed.results) {
        return parsed.results;
      }
      return [];
    } catch {
      // Fallback: parse text format
      const lines = result.split("\n").filter(Boolean);
      return lines.slice(0, 5).map((line, i) => ({
        title: `Result ${i + 1}`,
        url: "#",
        snippet: line,
      }));
    }
  })();

  const toggleResult = (index: number) => {
    const newExpanded = new Set(expandedResults);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedResults(newExpanded);
  };

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "overflow-hidden rounded-xl border shadow-xl",
        isLight
          ? "border-border bg-gradient-to-br from-primary/5 to-accent/5"
          : "border-violet-500/20 bg-gradient-to-br from-violet-950/30 to-purple-950/30"
      )}
      initial={{ opacity: 0, y: 10 }}
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-center justify-between border-b px-4 py-3",
          isLight ? "border-border" : "border-violet-500/20"
        )}
      >
        <div className="flex items-center gap-3">
          <div className={cn("rounded-xl p-2", config.icon.bgColor)}>
            <Search className={cn("h-5 w-5", config.icon.color)} />
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
            <p
              className={cn(
                "text-xs",
                isLight ? "text-muted-foreground" : "text-slate-500"
              )}
            >
              Web search results
            </p>
          </div>
        </div>
        <ToolStatusBadge status={status} />
      </div>

      {/* Query Section */}
      <div
        className={cn(
          "border-b",
          isLight ? "border-border/50" : "border-violet-500/10"
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
          <span className="font-medium uppercase tracking-wider">Query</span>
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
                <div
                  className={cn(
                    "flex items-center gap-2 rounded-lg border p-3",
                    isLight
                      ? "border-primary/20 bg-primary/5"
                      : "border-violet-500/20 bg-violet-950/20"
                  )}
                >
                  <Search
                    className={cn(
                      "h-4 w-4",
                      isLight ? "text-primary" : "text-violet-400"
                    )}
                  />
                  <span
                    className={cn(
                      "text-sm",
                      isLight ? "text-foreground" : "text-slate-300"
                    )}
                  >
                    {args.query ||
                      args.q ||
                      args.search ||
                      JSON.stringify(args)}
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Results Section */}
      <div className="p-4">
        {isLoading && !result && !error ? (
          <div className="flex flex-col items-center justify-center gap-4 py-8">
            <ModernSpinner size="md" />
            <div className="text-center">
              <ShimmerText
                className={cn("text-sm", isLight ? "text-foreground" : "")}
                text="Searching the web..."
              />
              <p
                className={cn(
                  "mt-1 text-xs",
                  isLight ? "text-muted-foreground" : "text-slate-500"
                )}
              >
                Query:{" "}
                {args.query || args.q || args.search || JSON.stringify(args)}
              </p>
            </div>
          </div>
        ) : error ? (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4">
            <p className="text-destructive text-sm">{error}</p>
          </div>
        ) : searchResults.length > 0 ? (
          <div className="space-y-3">
            <p
              className={cn(
                "font-medium text-xs uppercase tracking-wider",
                isLight ? "text-muted-foreground" : "text-slate-500"
              )}
            >
              {searchResults.length} results found
            </p>
            {searchResults.map((result, index) => (
              <motion.div
                animate={{ opacity: 1, x: 0 }}
                className={cn(
                  "group cursor-pointer rounded-lg border p-3 transition-all",
                  isLight
                    ? "border-border bg-muted/30 hover:border-primary/30 hover:bg-muted/50"
                    : "border-slate-700/30 bg-slate-900/30 hover:border-violet-500/30 hover:bg-slate-900/50"
                )}
                initial={{ opacity: 0, x: -10 }}
                key={index}
                onClick={() => toggleResult(index)}
                transition={{ delay: index * 0.1 }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg",
                      isLight ? "bg-primary/10" : "bg-violet-500/10"
                    )}
                  >
                    <Globe
                      className={cn(
                        "h-4 w-4",
                        isLight ? "text-primary" : "text-violet-400"
                      )}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4
                      className={cn(
                        "line-clamp-1 font-medium text-sm transition-colors",
                        isLight
                          ? "text-foreground group-hover:text-primary"
                          : "text-slate-200 group-hover:text-violet-300"
                      )}
                    >
                      {result.title}
                    </h4>
                    <a
                      className={cn(
                        "mt-0.5 flex items-center gap-1 text-xs",
                        isLight
                          ? "text-primary/70 hover:text-primary"
                          : "text-violet-400/70 hover:text-violet-400"
                      )}
                      href={result.url}
                      onClick={(e) => e.stopPropagation()}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {result.url.replace(/^https?:\/\//, "").substring(0, 40)}
                      {result.url.length > 40 && "..."}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    <AnimatePresence>
                      {(expandedResults.has(index) || index === 0) && (
                        <motion.p
                          animate={{ height: "auto", opacity: 1 }}
                          className={cn(
                            "mt-2 line-clamp-3 text-xs",
                            isLight ? "text-muted-foreground" : "text-slate-400"
                          )}
                          exit={{ height: 0, opacity: 0 }}
                          initial={{ height: 0, opacity: 0 }}
                        >
                          {result.snippet}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform",
                      isLight ? "text-muted-foreground" : "text-slate-500",
                      expandedResults.has(index) && "rotate-180"
                    )}
                  />
                </div>
              </motion.div>
            ))}
          </div>
        ) : result ? (
          <div
            className={cn(
              "rounded-lg border p-3",
              isLight
                ? "border-border bg-muted/30"
                : "border-slate-700/30 bg-slate-900/30"
            )}
          >
            <pre
              className={cn(
                "whitespace-pre-wrap text-xs",
                isLight ? "text-muted-foreground" : "text-slate-400"
              )}
            >
              {result}
            </pre>
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}
