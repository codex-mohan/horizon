"use client";

import { Button } from "@workspace/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { cn } from "@workspace/ui/lib/utils";
import { formatDistanceToNow } from "date-fns";
import {
  Check,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/stores/auth";
import { useConversationStore } from "@/lib/stores/conversation";
import { createThreadsClient, type Thread } from "@/lib/threads";

interface ConversationSearchProps {
  open: boolean;
  onOpenChange: React.Dispatch<React.SetStateAction<boolean>>;
  onSelect: (threadId: string) => void;
}

export function ConversationSearch({ open, onOpenChange, onSelect }: ConversationSearchProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [threads, setThreads] = useState<Thread[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const { user } = useAuthStore();
  const { currentThreadId, setCurrentThreadId } = useConversationStore();
  const apiUrl = process.env.NEXT_PUBLIC_LANGGRAPH_API_URL || "http://localhost:2024";
  const threadsClient = useMemo(() => createThreadsClient(apiUrl), [apiUrl]);

  useEffect(() => {
    const fetchThreads = async () => {
      if (!user) return;
      try {
        const fetchedThreads = await threadsClient.listThreads(user.id);
        setThreads(fetchedThreads);
      } catch (error) {
        console.error("[ConversationSearch] Failed to fetch threads:", error);
      }
    };

    if (open) {
      fetchThreads();
    }
  }, [open, user, threadsClient]);

  const handleDeleteThread = async (threadId: string) => {
    setDeletingId(threadId);
    try {
      await threadsClient.deleteThread(threadId);
      setThreads((prev) => prev.filter((t) => t.thread_id !== threadId));
      toast.success("Conversation deleted");

      if (currentThreadId === threadId) {
        setCurrentThreadId(null);
      }
    } catch (error) {
      console.error("Failed to delete thread:", error);
      toast.error("Failed to delete conversation");
    } finally {
      setDeletingId(null);
      setPendingDeleteId(null);
    }
  };

  const handleRenameThread = async (threadId: string, newTitle: string) => {
    if (!newTitle.trim()) {
      toast.error("Title cannot be empty");
      return;
    }

    setIsRenaming(true);
    try {
      await threadsClient.updateThread(threadId, { title: newTitle });
      setThreads((prev) =>
        prev.map((t) =>
          t.thread_id === threadId ? { ...t, metadata: { ...t.metadata, title: newTitle } } : t
        )
      );
      toast.success("Conversation renamed");
      setRenamingId(null);
      setRenameValue("");
    } catch (error) {
      console.error("Failed to rename thread:", error);
      toast.error("Failed to rename conversation");
    } finally {
      setIsRenaming(false);
    }
  };

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
        if (thread && !renamingId && !pendingDeleteId) {
          onSelect(thread.thread_id);
          onOpenChange(false);
        }
        return;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, filteredThreads, selectedIndex, onSelect, onOpenChange, renamingId, pendingDeleteId]);

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
                <ul className="space-y-1">
                  {filteredThreads.map((thread, index) => {
                    const title = (thread.metadata?.title as string) || "Untitled Conversation";
                    const isRenamingThis = renamingId === thread.thread_id;
                    const isPendingDelete = pendingDeleteId === thread.thread_id;
                    const isDeletingThis = deletingId === thread.thread_id;

                    return (
                      <li
                        className={cn(
                          "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                          index === selectedIndex
                            ? "bg-primary/10 text-primary"
                            : "hover:bg-muted/50"
                        )}
                        key={thread.thread_id}
                        onMouseEnter={() => setSelectedIndex(index)}
                      >
                        <button
                          className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
                          disabled={isRenamingThis || isPendingDelete}
                          onClick={() => {
                            if (!isRenamingThis && !isPendingDelete) {
                              onSelect(thread.thread_id);
                              onOpenChange(false);
                            }
                          }}
                          type="button"
                        >
                          <MessageSquare className="size-4 shrink-0 opacity-70" />
                          {isRenamingThis ? (
                            <input
                              className="w-full rounded border border-primary/50 bg-background/80 px-2 py-1 text-sm outline-none focus:border-primary"
                              onChange={(e) => setRenameValue(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e) => {
                                e.stopPropagation();
                                if (e.key === "Enter") {
                                  handleRenameThread(thread.thread_id, renameValue);
                                } else if (e.key === "Escape") {
                                  setRenamingId(null);
                                  setRenameValue("");
                                }
                              }}
                              type="text"
                              value={renameValue}
                            />
                          ) : (
                            <div className="min-w-0 flex-1">
                              <div className="truncate font-medium">{title}</div>
                              <div className="text-muted-foreground text-xs">
                                {formatDistanceToNow(new Date(thread.updated_at), {
                                  addSuffix: true,
                                })}
                              </div>
                            </div>
                          )}
                        </button>

                        <div className="flex items-center gap-1">
                          {isRenamingThis ? (
                            <>
                              <Button
                                className="size-6"
                                disabled={isRenaming || !renameValue.trim()}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRenameThread(thread.thread_id, renameValue);
                                }}
                                size="icon"
                                variant="ghost"
                              >
                                {isRenaming ? (
                                  <Loader2 className="size-3 animate-spin text-primary" />
                                ) : (
                                  <Check className="size-3 text-primary" />
                                )}
                              </Button>
                              <Button
                                className="size-6"
                                disabled={isRenaming}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRenamingId(null);
                                  setRenameValue("");
                                }}
                                size="icon"
                                variant="ghost"
                              >
                                <X className="size-3 text-destructive" />
                              </Button>
                            </>
                          ) : isPendingDelete ? (
                            <>
                              <Button
                                className="size-6"
                                disabled={isDeletingThis}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteThread(thread.thread_id);
                                }}
                                size="icon"
                                variant="ghost"
                              >
                                {isDeletingThis ? (
                                  <Loader2 className="size-3 animate-spin text-primary" />
                                ) : (
                                  <Check className="size-3 text-primary" />
                                )}
                              </Button>
                              <Button
                                className="size-6"
                                disabled={isDeletingThis}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPendingDeleteId(null);
                                }}
                                size="icon"
                                variant="ghost"
                              >
                                <X className="size-3 text-destructive" />
                              </Button>
                            </>
                          ) : (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  className="opacity-0 transition-opacity group-hover:opacity-100"
                                  onClick={(e) => e.stopPropagation()}
                                  size="icon-sm"
                                  variant="ghost"
                                >
                                  <MoreHorizontal className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                className="animate-scale-in"
                                style={{ zIndex: 100000 }}
                              >
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRenamingId(thread.thread_id);
                                    setRenameValue((thread.metadata?.title as string) || "");
                                  }}
                                >
                                  <Pencil className="mr-2 size-4" />
                                  Rename
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPendingDeleteId(thread.thread_id);
                                  }}
                                >
                                  <Trash2 className="mr-2 size-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
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
