"use client";

import { Button } from "@workspace/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { cn } from "@workspace/ui/lib/utils";
import {
  Check,
  CheckSquare,
  Clock,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/stores/auth";
import { useConversationStore } from "@/lib/stores/conversation";
import { createThreadsClient, type Thread } from "@/lib/threads";

interface ConversationsPanelProps {
  onClose: () => void;
}

/**
 * ConversationsPanel - Panel for managing conversation threads
 *
 * Features:
 * - List all user conversations
 * - Search conversations
 * - Bulk selection and deletion
 * - Create new conversation
 */
export function ConversationsPanel({ onClose }: ConversationsPanelProps) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Bulk selection state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedThreadIds, setSelectedThreadIds] = useState<Set<string>>(new Set());
  const [isDeletingMultiple, setIsDeletingMultiple] = useState(false);

  const router = useRouter();
  const { currentThreadId, setCurrentThreadId } = useConversationStore();
  const { user } = useAuthStore();
  const apiUrl = process.env.NEXT_PUBLIC_LANGGRAPH_API_URL || "http://localhost:2024";
  const threadsClient = useMemo(() => createThreadsClient(apiUrl), [apiUrl]);

  const fetchThreads = useCallback(async () => {
    console.log("[ConversationsPanel] Fetching threads...", { user });
    if (!user) {
      console.log("[ConversationsPanel] No user logged in, skipping fetch");
      return;
    }

    setIsLoading(true);
    try {
      // DEBUG: First fetch ALL threads without filtering to see what exists
      const allThreads = await threadsClient.listThreads();
      console.log("[ConversationsPanel] ALL threads (no filter):", allThreads);

      console.log("[ConversationsPanel] Calling listThreads for user:", user.id);
      // Filter threads by current user's ID
      const fetchedThreads = await threadsClient.listThreads(user.id);
      console.log("[ConversationsPanel] User-filtered threads:", fetchedThreads);

      // For now, show all threads if user-filtered is empty but all threads exist
      // This handles legacy threads created without user_id metadata
      if (fetchedThreads.length === 0 && allThreads.length > 0) {
        console.log("[ConversationsPanel] Using all threads (legacy threads without user_id)");
        setThreads(allThreads);
      } else {
        setThreads(fetchedThreads);
      }
    } catch (error) {
      console.error("[ConversationsPanel] Failed to fetch threads:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user, threadsClient]);

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  const handleDeleteThread = async (threadId: string) => {
    setDeletingId(threadId);
    try {
      await threadsClient.deleteThread(threadId);
      setThreads((prev) => prev.filter((t) => t.thread_id !== threadId));
      toast.success("Conversation deleted");

      if (currentThreadId === threadId) {
        setCurrentThreadId(null);
        router.push("/chat/new");
      }

      if (selectedThreadIds.has(threadId)) {
        const next = new Set(selectedThreadIds);
        next.delete(threadId);
        setSelectedThreadIds(next);
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

  const handleBulkDelete = async () => {
    if (selectedThreadIds.size === 0) {
      return;
    }

    setIsDeletingMultiple(true);
    const idsToDelete = Array.from(selectedThreadIds);
    let successCount = 0;

    try {
      // Delete sequentially to avoid overwhelming server or hitting rate limits
      for (const id of idsToDelete) {
        try {
          await threadsClient.deleteThread(id);
          successCount++;
          // Update local state immediately for better UX
          setThreads((prev) => prev.filter((t) => t.thread_id !== id));
        } catch (e) {
          console.error(`Failed to delete thread ${id}`, e);
        }
      }

      toast.success(`Deleted ${successCount} conversation${successCount !== 1 ? "s" : ""}`);

      // If current thread was deleted, redirect
      if (currentThreadId && selectedThreadIds.has(currentThreadId)) {
        setCurrentThreadId(null);
        router.push("/chat/new");
      }

      // Reset selection mode
      setIsSelectionMode(false);
      setSelectedThreadIds(new Set());
    } catch (error) {
      console.error("Bulk delete error:", error);
      toast.error("Failed to delete some conversations");
    } finally {
      setIsDeletingMultiple(false);
    }
  };

  const toggleThreadSelection = (threadId: string) => {
    const next = new Set(selectedThreadIds);
    if (next.has(threadId)) {
      next.delete(threadId);
    } else {
      next.add(threadId);
    }
    setSelectedThreadIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedThreadIds.size === threads.length) {
      setSelectedThreadIds(new Set());
    } else {
      const allIds = new Set(threads.map((t) => t.thread_id));
      setSelectedThreadIds(allIds);
    }
  };

  const handleSelectThread = (threadId: string) => {
    if (isSelectionMode) {
      toggleThreadSelection(threadId);
      return;
    }

    setCurrentThreadId(threadId);
    router.push(`/chat/${threadId}`);
    onClose();
  };

  const handleNewConversation = () => {
    setCurrentThreadId(null);
    router.push("/chat/new");
    onClose(); // Close sidebar to show the new chat
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60_000);
    const diffHours = Math.floor(diffMs / 3_600_000);
    const diffDays = Math.floor(diffMs / 86_400_000);

    if (diffMins < 1) {
      return "Just now";
    }
    if (diffMins < 60) {
      return `${diffMins}m ago`;
    }
    if (diffHours < 24) {
      return `${diffHours}h ago`;
    }
    return `${diffDays}d ago`;
  };

  const filteredThreads = threads.filter((thread) => {
    if (!searchQuery) return true;
    const title = (thread.metadata?.title as string) || "Untitled Conversation";
    return title.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 space-y-2 p-4 pb-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="w-full rounded-md border border-border/50 bg-background/50 py-2 pr-3 pl-9 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/50 focus:bg-background/80"
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              type="text"
              value={searchQuery}
            />
          </div>

          <Button
            className={cn("shrink-0", isSelectionMode && "bg-primary/20 text-primary")}
            onClick={() => {
              setIsSelectionMode(!isSelectionMode);
              if (isSelectionMode) {
                setSelectedThreadIds(new Set()); // Clear on exit
              }
            }}
            size="icon"
            title={isSelectionMode ? "Cancel selection" : "Select conversations"}
            variant={isSelectionMode ? "secondary" : "ghost"}
          >
            {isSelectionMode ? <X className="size-4" /> : <CheckSquare className="size-4" />}
          </Button>
        </div>

        {isSelectionMode ? (
          <div className="fade-in slide-in-from-top-2 flex animate-in items-center gap-2">
            <Button
              className="flex-1"
              disabled={selectedThreadIds.size === 0 || isDeletingMultiple}
              onClick={handleBulkDelete}
              size="sm"
              variant="destructive"
            >
              {isDeletingMultiple ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Delete ({selectedThreadIds.size})
            </Button>
            <Button onClick={toggleSelectAll} size="sm" variant="outline">
              {selectedThreadIds.size === threads.length ? "Deselect All" : "Select All"}
            </Button>
          </div>
        ) : (
          <Button
            className="w-full justify-center gap-2 border-0 bg-gradient-to-r from-[var(--gradient-from)] via-[var(--gradient-via)] to-[var(--gradient-to)] text-white transition-all duration-300 hover:opacity-90 hover:shadow-lg hover:shadow-primary/25"
            onClick={handleNewConversation}
          >
            <Plus className="size-4" />
            New Conversation
          </Button>
        )}
      </div>

      <div className="custom-scrollbar flex-1 space-y-2 overflow-y-auto px-4 pb-4">
        {user ? (
          isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredThreads.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              {searchQuery ? "No conversations found" : "No conversations yet"}
            </div>
          ) : (
            filteredThreads.map((thread, i) => {
              const isRenamingThis = renamingId === thread.thread_id;
              const isPendingDelete = pendingDeleteId === thread.thread_id;
              const isDeletingThis = deletingId === thread.thread_id;

              return (
                <article
                  className={cn(
                    "glass hover-lift stagger-item group flex w-full items-center gap-3 rounded-lg p-3 text-left transition-all duration-200 hover:bg-primary/20",
                    currentThreadId === thread.thread_id &&
                      !isSelectionMode &&
                      "bg-primary/30 ring-1 ring-primary/50",
                    isSelectionMode && "cursor-pointer",
                    selectedThreadIds.has(thread.thread_id) &&
                      "bg-primary/10 ring-1 ring-primary/30"
                  )}
                  key={thread.thread_id}
                  onClick={() => isSelectionMode && toggleThreadSelection(thread.thread_id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && isSelectionMode) {
                      toggleThreadSelection(thread.thread_id);
                    }
                  }}
                  role={isSelectionMode ? "button" : undefined}
                  tabIndex={isSelectionMode ? 0 : undefined}
                >
                  {isSelectionMode && (
                    <div className="shrink-0 text-primary">
                      {selectedThreadIds.has(thread.thread_id) ? (
                        <CheckSquare className="size-4" />
                      ) : (
                        <Square className="size-4 text-muted-foreground" />
                      )}
                    </div>
                  )}

                  <button
                    className="min-w-0 flex-1 cursor-pointer text-left"
                    onClick={(e) => {
                      if (!isSelectionMode && !isRenamingThis) {
                        e.stopPropagation();
                        handleSelectThread(thread.thread_id);
                      }
                    }}
                    type="button"
                  >
                    {isRenamingThis ? (
                      <input
                        className="w-full rounded border border-primary/50 bg-background/80 px-2 py-1 text-sm outline-none focus:border-primary"
                        onChange={(e) => setRenameValue(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
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
                      <>
                        <div className="truncate font-display font-medium text-sm">
                          {(thread.metadata?.title as string) || `Conversation ${i + 1}`}
                        </div>
                        <div className="mt-1 flex items-center gap-1 text-muted-foreground text-xs">
                          <Clock className="size-3" />
                          {formatTimeAgo(thread.updated_at)}
                        </div>
                      </>
                    )}
                  </button>

                  {!isSelectionMode && (
                    <div className="flex items-center gap-1">
                      {isRenamingThis ? (
                        <>
                          <Button
                            className="size-7"
                            disabled={isRenaming || !renameValue.trim()}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRenameThread(thread.thread_id, renameValue);
                            }}
                            size="icon"
                            variant="ghost"
                          >
                            {isRenaming ? (
                              <Loader2 className="size-4 animate-spin text-primary" />
                            ) : (
                              <Check className="size-4 text-primary" />
                            )}
                          </Button>
                          <Button
                            className="size-7"
                            disabled={isRenaming}
                            onClick={(e) => {
                              e.stopPropagation();
                              setRenamingId(null);
                              setRenameValue("");
                            }}
                            size="icon"
                            variant="ghost"
                          >
                            <X className="size-4 text-destructive" />
                          </Button>
                        </>
                      ) : isPendingDelete ? (
                        <>
                          <Button
                            className="size-7"
                            disabled={isDeletingThis}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteThread(thread.thread_id);
                            }}
                            size="icon"
                            variant="ghost"
                          >
                            {isDeletingThis ? (
                              <Loader2 className="size-4 animate-spin text-primary" />
                            ) : (
                              <Check className="size-4 text-primary" />
                            )}
                          </Button>
                          <Button
                            className="size-7"
                            disabled={isDeletingThis}
                            onClick={(e) => {
                              e.stopPropagation();
                              setPendingDeleteId(null);
                            }}
                            size="icon"
                            variant="ghost"
                          >
                            <X className="size-4 text-destructive" />
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
                          <DropdownMenuContent align="end" className="animate-scale-in">
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
                  )}
                </article>
              );
            })
          )
        ) : (
          <div className="py-8 text-center text-muted-foreground text-sm">
            Sign in to view your conversations
          </div>
        )}
      </div>
    </div>
  );
}
