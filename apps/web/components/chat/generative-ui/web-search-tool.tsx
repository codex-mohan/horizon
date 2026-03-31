"use client";

import { cn } from "@horizon/ui/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ChevronDown,
  Clock,
  ExternalLink,
  Globe,
  Search,
  Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTheme } from "@/components/theme/theme-provider";
import { ModernSpinner } from "./loading-effects";

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

interface SearchSummary {
  resultIndex: number;
  url: string;
  title: string;
  content: string | null;
}

interface ParsedSearchResponse {
  query: string;
  results: SearchResult[];
  totalResults: number;
  error?: string;
  summaries?: SearchSummary[];
}

interface WebSearchToolProps {
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
 * Resolve the real destination URL from a DuckDuckGo redirect URL.
 * DDG returns protocol-relative redirect URLs like:
 *   //duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com&...
 * We extract the `uddg` param (the real URL). Otherwise return as-is.
 */
function resolveUrl(url: string): string {
  try {
    // Handle protocol-relative URLs (//duckduckgo.com/l/?uddg=...)
    const normalized = url.startsWith("//") ? `https:${url}` : url;
    const parsed = new URL(normalized);
    // DuckDuckGo redirect: extract the actual destination from `uddg` param
    if (parsed.hostname.includes("duckduckgo.com") && parsed.searchParams.has("uddg")) {
      const real = parsed.searchParams.get("uddg");
      if (real) return decodeURIComponent(real);
    }
    return normalized;
  } catch {
    return url;
  }
}

function getFaviconUrl(url: string): string {
  try {
    const resolved = resolveUrl(url);
    const hostname = new URL(resolved).hostname;
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
  } catch {
    return "";
  }
}

function getDomainName(url: string): string {
  try {
    const resolved = resolveUrl(url);
    const hostname = new URL(resolved).hostname;
    return hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function parseSearchResponse(result: string): ParsedSearchResponse | null {
  if (!result) return null;
  const trimmed = result.trim();

  if (trimmed.startsWith("#") || trimmed.startsWith("Done") || trimmed.startsWith("##")) {
    const markdownResults: SearchResult[] = [];

    const linkPattern = /#+\s*\d*\.?\s*\[([^\]]+)\]\(([^)]+)\)\s*>?\s*([^\n#-]*)/g;
    let match: RegExpExecArray | null = linkPattern.exec(trimmed);
    while (match !== null) {
      const [, title, url, snippet] = match;
      if (title && url && !title.includes("Search results")) {
        markdownResults.push({
          title: title.trim(),
          url: url.trim(),
          snippet: snippet?.trim().replace(/^>\s*/, "").replace(/\*+/g, "") || "",
        });
      }
      match = linkPattern.exec(trimmed);
    }

    if (markdownResults.length > 0) {
      const queryMatch = trimmed.match(/Search results? for ['"]([^'"]+)['"]/);
      return {
        query: queryMatch ? queryMatch[1] : "",
        results: markdownResults,
        totalResults: markdownResults.length,
      };
    }
    return null;
  }

  const jsonStart = trimmed.indexOf("{");
  const jsonEnd = trimmed.lastIndexOf("}");

  if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
    const jsonStr = trimmed.slice(jsonStart, jsonEnd + 1);
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed.results && Array.isArray(parsed.results)) {
        return parsed;
      }
    } catch {
      // invalid json
    }
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed.results && Array.isArray(parsed.results)) {
      return parsed;
    }
  } catch {
    // not json
  }

  return null;
}

function SearchResultCard({
  result,
  index,
  isLight,
}: {
  result: SearchResult;
  index: number;
  isLight: boolean;
}) {
  const [imageError, setImageError] = useState(false);
  const [snippetOpen, setSnippetOpen] = useState(false);
  // Resolve the real destination URL once (strips DDG redirect wrappers)
  const resolvedUrl = resolveUrl(result.url);
  const domain = getDomainName(result.url);
  const hasSnippet = Boolean(result.snippet);
  const faviconSrc = getFaviconUrl(result.url);

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-lg border transition-colors duration-200",
        isLight
          ? "border-border/40 bg-background/30 hover:bg-background/60"
          : "border-white/5 bg-white/2 hover:bg-white/5"
      )}
      initial={{ opacity: 0, y: 8 }}
      transition={{ delay: index * 0.04, duration: 0.25 }}
    >
      {/* Compact main row */}
      <div className="flex min-w-0 items-center gap-2 px-3 py-2">
        {/* Favicon */}
        <div className="shrink-0">
          {faviconSrc && !imageError ? (
            <img
              alt=""
              className="h-4 w-4 rounded-sm object-contain"
              loading="lazy"
              src={faviconSrc}
              onError={() => setImageError(true)}
            />
          ) : (
            <Globe className="h-4 w-4 text-muted-foreground" />
          )}
        </div>

        {/* Title */}
        <a
          className={cn(
            "min-w-0 flex-1 truncate text-xs font-medium leading-none transition-colors duration-150",
            "hover:text-violet-400",
            "text-foreground"
          )}
          href={resolvedUrl}
          rel="noopener noreferrer"
          target="_blank"
          title={result.title}
        >
          {result.title}
        </a>

        {/* Domain */}
        <span
          className="shrink-0 max-w-[120px] truncate text-[10px] text-violet-400/70"
          title={resolvedUrl}
        >
          {domain}
        </span>

        {/* External link icon */}
        <a
          className="shrink-0 text-muted-foreground/40 hover:text-violet-400 transition-colors duration-150"
          href={resolvedUrl}
          rel="noopener noreferrer"
          target="_blank"
          aria-label="Open link"
        >
          <ExternalLink className="h-3 w-3" />
        </a>

        {/* Snippet chevron — only if snippet exists */}
        {hasSnippet && (
          <button
            type="button"
            aria-label="Toggle snippet"
            className="shrink-0 text-muted-foreground/40 hover:text-violet-400 transition-colors duration-150"
            onClick={() => setSnippetOpen((v) => !v)}
          >
            <motion.div animate={{ rotate: snippetOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDown className="h-3 w-3" />
            </motion.div>
          </button>
        )}
      </div>

      {/* Collapsible snippet */}
      <AnimatePresence initial={false}>
        {snippetOpen && hasSnippet && (
          <motion.div
            animate={{ height: "auto", opacity: 1 }}
            className="overflow-hidden"
            exit={{ height: 0, opacity: 0 }}
            initial={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
          >
            <p
              className={cn(
                "border-t px-3 py-2 text-[11px] leading-relaxed",
                isLight
                  ? "border-border/30 text-muted-foreground"
                  : "border-white/5 text-muted-foreground"
              )}
            >
              {result.snippet}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function WebSearchTool({
  toolName,
  status,
  args,
  result,
  error,
  isLoading,
}: WebSearchToolProps) {
  const [expanded, setExpanded] = useState(false);
  const { themeMode } = useTheme();
  const isLight = themeMode === "light";

  const query = String(args?.query || args?.q || args?.search || "");

  const searchData = useMemo((): ParsedSearchResponse | null => {
    if (!result) return null;
    return parseSearchResponse(result);
  }, [result]);

  const hasResults = searchData && searchData.results.length > 0;
  const isSearching = (isLoading || status === "executing") && !result && !error;

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className={cn("overflow-hidden rounded-2xl", "glass")}
      initial={{ opacity: 0, y: 10 }}
    >
      <button
        className={cn("group relative w-full overflow-hidden text-left", "cursor-pointer")}
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setExpanded(!expanded);
          }
        }}
        type="button"
      >
        <motion.div
          className={cn(
            "absolute inset-0 bg-linear-to-r from-violet-500/10 via-purple-500/5 to-transparent",
            "opacity-0 transition-opacity duration-300",
            "group-hover:opacity-100"
          )}
        />

        <div className="relative z-10 flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ rotate: isSearching ? [0, 15, -15, 0] : 0 }}
              transition={{
                rotate: { duration: 0.5, repeat: isSearching ? Number.POSITIVE_INFINITY : 0 },
              }}
              className={cn(
                "relative flex h-10 w-10 items-center justify-center rounded-xl",
                "bg-linear-to-br from-violet-500/20 to-purple-500/20",
                "border border-violet-500/20 shadow-lg shadow-violet-500/10"
              )}
            >
              <Search className={cn("h-5 w-5 text-violet-400")} />
              {isSearching && (
                <motion.div
                  animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                  className="absolute inset-0 rounded-xl bg-violet-400/20"
                  transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY }}
                />
              )}
            </motion.div>

            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">
                  {query
                    ? `"${query.slice(0, 40)}${query.length > 40 ? "..." : ""}"`
                    : "Web Search"}
                </span>
                {hasResults && status === "completed" && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className={cn(
                      "flex items-center gap-1 rounded-full px-2.5 py-0.5",
                      "bg-linear-to-r from-violet-500/20 to-purple-500/20",
                      "border border-violet-500/30"
                    )}
                  >
                    <Sparkles className="h-3 w-3 text-violet-400" />
                    <span className="text-xs font-semibold text-violet-400">
                      {searchData.totalResults || searchData.results.length} results
                    </span>
                  </motion.div>
                )}
              </div>
              {query && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Globe className="h-3 w-3" />
                  <span>via DuckDuckGo</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.3 }}>
              <ChevronDown
                className={cn(
                  "h-5 w-5 transition-colors duration-200",
                  isLight ? "text-muted-foreground" : "text-primary-foreground/60",
                  "group-hover:text-violet-400"
                )}
              />
            </motion.div>
          </div>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            animate={{ height: "auto", opacity: 1 }}
            className="overflow-hidden"
            exit={{ height: 0, opacity: 0 }}
            initial={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <div
              className={cn("border-t px-4 py-4", isLight ? "border-border/50" : "border-white/5")}
            >
              {isSearching && (
                <div className="flex flex-col items-center justify-center gap-4 py-8">
                  <div className="relative">
                    <ModernSpinner size="lg" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Search className="h-4 w-4 text-violet-400" />
                    </div>
                  </div>
                  <div className="text-center">
                    <p
                      className={cn(
                        "text-sm font-medium",
                        isLight ? "text-foreground" : "text-primary-foreground"
                      )}
                    >
                      Searching the web...
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Looking for the best results
                    </p>
                  </div>
                </div>
              )}

              {error && (
                <motion.div
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border border-red-500/20",
                    "bg-red-500/10 p-4"
                  )}
                  initial={{ opacity: 0, y: -10 }}
                >
                  <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />
                  <div>
                    <p className="text-sm font-medium text-red-400">Search failed</p>
                    <p className="text-xs text-red-400/70">{error}</p>
                  </div>
                </motion.div>
              )}

              {hasResults && (
                <div className="space-y-3">
                  <div className="mb-4 flex items-center gap-2">
                    <div className="h-px flex-1 bg-linear-to-r from-transparent via-violet-500/20 to-transparent" />
                    <span className="text-xs text-muted-foreground">
                      {searchData.results.length} results found
                    </span>
                    <div className="h-px flex-1 bg-linear-to-r from-transparent via-violet-500/20 to-transparent" />
                  </div>

                  {searchData.results.map((item: SearchResult, index: number) => (
                    <SearchResultCard
                      key={`${item.url}-${index}`}
                      index={index}
                      isLight={isLight}
                      result={item}
                    />
                  ))}
                </div>
              )}

              {!isSearching && !error && !hasResults && searchData?.error && (
                <div className="flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
                  <AlertCircle className="h-5 w-5 shrink-0 text-amber-400" />
                  <div>
                    <p className="text-sm font-medium text-amber-400">No results found</p>
                    <p className="text-xs text-amber-400/70">{searchData.error}</p>
                  </div>
                </div>
              )}

              {!isSearching && !error && !hasResults && !searchData && result && (
                <div
                  className="rounded-xl border p-4"
                  style={
                    isLight
                      ? { borderColor: "var(--border)", backgroundColor: "var(--muted)" }
                      : {
                          borderColor: "rgba(255,255,255,0.05)",
                          backgroundColor: "rgba(255,255,255,0.02)",
                        }
                  }
                >
                  <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>Raw response</span>
                  </div>
                  <pre
                    className={cn(
                      "whitespace-pre-wrap text-xs leading-relaxed",
                      isLight ? "text-foreground" : "text-primary-foreground/80"
                    )}
                  >
                    {result}
                  </pre>
                </div>
              )}

              {!isSearching && !error && !hasResults && !result && status === "completed" && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Search className="h-8 w-8 text-muted-foreground/50" />
                  <p className="mt-2 text-sm text-muted-foreground">No results found</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
