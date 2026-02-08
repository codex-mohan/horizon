"use client";

import { useState } from "react";
import { cn } from "@workspace/ui/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Globe,
} from "lucide-react";
import { ToolStatusBadge, ModernSpinner, ShimmerText } from "./loading-effects";
import { getToolUIConfig } from "@/lib/tool-config";
import { useTheme } from "@/components/theme/theme-provider";

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
    new Set(),
  );
  const config = getToolUIConfig(toolName);
  const { themeMode } = useTheme();
  const isLight = themeMode === "light";

  // Parse search results from the result string
  const searchResults: SearchResult[] = (() => {
    if (!result) return [];
    try {
      // Try to parse as JSON first
      const parsed = JSON.parse(result);
      if (Array.isArray(parsed)) return parsed;
      if (parsed.results) return parsed.results;
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
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-xl overflow-hidden border shadow-xl",
        isLight
          ? "bg-gradient-to-br from-primary/5 to-accent/5 border-border"
          : "bg-gradient-to-br from-violet-950/30 to-purple-950/30 border-violet-500/20",
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-center justify-between px-4 py-3 border-b",
          isLight ? "border-border" : "border-violet-500/20",
        )}
      >
        <div className="flex items-center gap-3">
          <div className={cn("p-2 rounded-xl", config.icon.bgColor)}>
            <Search className={cn("w-5 h-5", config.icon.color)} />
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
          isLight ? "border-border/50" : "border-violet-500/10",
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
          <span className="font-medium uppercase tracking-wider">Query</span>
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
                <div
                  className={cn(
                    "flex items-center gap-2 p-3 rounded-lg border",
                    isLight
                      ? "bg-primary/5 border-primary/20"
                      : "bg-violet-950/20 border-violet-500/20",
                  )}
                >
                  <Search
                    className={cn(
                      "w-4 h-4",
                      isLight ? "text-primary" : "text-violet-400",
                    )}
                  />
                  <span
                    className={cn(
                      "text-sm",
                      isLight ? "text-foreground" : "text-slate-300",
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
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <ModernSpinner size="md" />
            <div className="text-center">
              <ShimmerText
                text="Searching the web..."
                className={cn("text-sm", isLight ? "text-foreground" : "")}
              />
              <p
                className={cn(
                  "text-xs mt-1",
                  isLight ? "text-muted-foreground" : "text-slate-500",
                )}
              >
                Query:{" "}
                {args.query || args.q || args.search || JSON.stringify(args)}
              </p>
            </div>
          </div>
        ) : error ? (
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        ) : searchResults.length > 0 ? (
          <div className="space-y-3">
            <p
              className={cn(
                "text-xs uppercase tracking-wider font-medium",
                isLight ? "text-muted-foreground" : "text-slate-500",
              )}
            >
              {searchResults.length} results found
            </p>
            {searchResults.map((result, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={cn(
                  "group p-3 rounded-lg border transition-all cursor-pointer",
                  isLight
                    ? "bg-muted/30 border-border hover:border-primary/30 hover:bg-muted/50"
                    : "bg-slate-900/30 border-slate-700/30 hover:border-violet-500/30 hover:bg-slate-900/50",
                )}
                onClick={() => toggleResult(index)}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center",
                      isLight ? "bg-primary/10" : "bg-violet-500/10",
                    )}
                  >
                    <Globe
                      className={cn(
                        "w-4 h-4",
                        isLight ? "text-primary" : "text-violet-400",
                      )}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4
                      className={cn(
                        "text-sm font-medium transition-colors line-clamp-1",
                        isLight
                          ? "text-foreground group-hover:text-primary"
                          : "text-slate-200 group-hover:text-violet-300",
                      )}
                    >
                      {result.title}
                    </h4>
                    <a
                      href={result.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "text-xs flex items-center gap-1 mt-0.5",
                        isLight
                          ? "text-primary/70 hover:text-primary"
                          : "text-violet-400/70 hover:text-violet-400",
                      )}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {result.url.replace(/^https?:\/\//, "").substring(0, 40)}
                      {result.url.length > 40 && "..."}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <AnimatePresence>
                      {(expandedResults.has(index) || index === 0) && (
                        <motion.p
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className={cn(
                            "text-xs mt-2 line-clamp-3",
                            isLight
                              ? "text-muted-foreground"
                              : "text-slate-400",
                          )}
                        >
                          {result.snippet}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>
                  <ChevronDown
                    className={cn(
                      "w-4 h-4 transition-transform",
                      isLight ? "text-muted-foreground" : "text-slate-500",
                      expandedResults.has(index) && "rotate-180",
                    )}
                  />
                </div>
              </motion.div>
            ))}
          </div>
        ) : result ? (
          <div
            className={cn(
              "p-3 rounded-lg border",
              isLight
                ? "bg-muted/30 border-border"
                : "bg-slate-900/30 border-slate-700/30",
            )}
          >
            <pre
              className={cn(
                "text-xs whitespace-pre-wrap",
                isLight ? "text-muted-foreground" : "text-slate-400",
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
