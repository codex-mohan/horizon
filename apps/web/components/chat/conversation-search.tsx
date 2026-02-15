"use client";

import { cn } from "@workspace/ui/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Thread } from "@/lib/threads";

interface ConversationSearchProps {
  open: boolean;
  onOpenChange: React.Dispatch<React.SetStateAction<boolean>>;
  threads: Thread[];
  onSelect: (threadId: string) => void;
}

export function ConversationSearch({
  open,
  onOpenChange,
  threads,
  onSelect,
}: ConversationSearchProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredThreads = threads.filter((thread) => {
    const title = (thread.metadata?.title as string) || "Untitled Conversation";
    return title.toLowerCase().includes(query.toLowerCase());
  });

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setSelectedIndex(0);
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [onOpenChange]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onOpenChange(false);
        return;
      }

      if (e.key === "ArrowDown" || (e.key === "j" && e.ctrlKey)) {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < filteredThreads.length - 1 ? prev + 1 : prev));
        return;
      }

      if (e.key === "ArrowUp" || (e.key === "k" && e.ctrlKey)) {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        return;
      }

      if (e.key === "Enter" && filteredThreads.length > 0) {
        e.preventDefault();
        const thread = filteredThreads[selectedIndex];
        if (thread) {
          onSelect(thread.thread_id);
          onOpenChange(false);
        }
        return;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, filteredThreads, selectedIndex, onSelect, onOpenChange]);

  if (!open) return null;

  return createPortal(
    <>
      <div
        aria-hidden="true"
        className="fade-in zoom-in fixed inset-0 animate-in bg-background/60 backdrop-blur-sm duration-200"
        onClick={() => onOpenChange(false)}
        style={{ zIndex: 99998 }}
      />

      <div
        className="fade-in zoom-in fixed top-1/2 left-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 animate-in duration-200"
        style={{ zIndex: 99999 }}
      >
        <div className="overflow-hidden rounded-xl border border-border/50 bg-card shadow-2xl">
          <div className="flex items-center gap-3 border-border/50 border-b px-4 py-3">
            <Search className="size-5 shrink-0 text-muted-foreground" />
            <input
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              className="flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Search conversations..."
              ref={inputRef}
              spellCheck={false}
              type="text"
              value={query}
            />
            <button
              className="rounded-md p-1 hover:bg-muted/50"
              onClick={() => onOpenChange(false)}
              type="button"
            >
              <X className="size-4 text-muted-foreground" />
            </button>
          </div>

          <div className="custom-scrollbar max-h-80 overflow-y-auto">
            {filteredThreads.length === 0 ? (
              <div className="px-4 py-8 text-center text-muted-foreground">No results found.</div>
            ) : (
              <div className="p-2">
                <div className="mb-2 px-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                  Conversations
                </div>
                {filteredThreads.map((thread, index) => {
                  const title = (thread.metadata?.title as string) || "Untitled Conversation";
                  return (
                    <button
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                        index === selectedIndex ? "bg-primary/10 text-primary" : "hover:bg-muted/50"
                      )}
                      key={thread.thread_id}
                      onClick={() => {
                        onSelect(thread.thread_id);
                        onOpenChange(false);
                      }}
                      onMouseEnter={() => setSelectedIndex(index)}
                      type="button"
                    >
                      <MessageSquare className="size-4 shrink-0 opacity-70" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{title}</div>
                        <div className="text-muted-foreground text-xs">
                          {formatDistanceToNow(new Date(thread.updated_at), {
                            addSuffix: true,
                          })}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-border/50 border-t px-4 py-2 text-muted-foreground text-xs">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">↑↓</kbd>
                navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">Enter</kbd>
                select
              </span>
            </div>
            <span className="flex items-center gap-1">
              <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">Esc</kbd>
              close
            </span>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
