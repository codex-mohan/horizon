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
  CheckSquare,
  Clock,
  Loader2,
  MoreHorizontal,
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
import { ConversationSearch } from "./conversation-search";

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
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Bulk selection state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedThreadIds, setSelectedThreadIds] = useState<Set<string>>(new Set());
  const [isDeletingMultiple, setIsDeletingMultiple] = useState(false);

  const router = useRouter();
  const { currentThreadId, setCurrentThreadId, threadRefreshVersion } = useConversationStore();
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
  }, [fetchThreads, threadRefreshVersion]);

  const handleDeleteThread = async (threadId: string) => {
    setDeletingId(threadId);
    try {
      await threadsClient.deleteThread(threadId);
      setThreads((prev) => prev.filter((t) => t.thread_id !== threadId));
      toast.success("Conversation deleted");

      // If we deleted the current conversation, redirect to new chat
      if (currentThreadId === threadId) {
        setCurrentThreadId(null);
        router.push("/chat/new");
      }

      // Also remove from selection if it was selected
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

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 space-y-2 p-4 pb-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Button
              className="w-full justify-start bg-background/50 text-muted-foreground hover:bg-background/80"
              onClick={() => setIsSearchOpen(true)}
              variant="outline"
            >
              <Search className="mr-2 h-4 w-4" />
              Search conversations...
              <kbd className="pointer-events-none absolute top-2 right-2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-medium font-mono text-[10px] opacity-100 sm:flex">
                <span className="text-xs">⌘</span>K
              </kbd>
            </Button>
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
          ) : threads.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              No conversations yet
            </div>
          ) : (
            threads.map((thread, i) => (
              <div
                className={cn(
                  "glass hover-lift stagger-item group flex w-full items-center gap-3 rounded-lg p-3 text-left transition-all duration-200 hover:bg-primary/20",
                  currentThreadId === thread.thread_id &&
                    !isSelectionMode &&
                    "bg-primary/30 ring-1 ring-primary/50",
                  isSelectionMode && "cursor-pointer",
                  selectedThreadIds.has(thread.thread_id) && "bg-primary/10 ring-1 ring-primary/30"
                )}
                key={thread.thread_id}
                onClick={() => isSelectionMode && toggleThreadSelection(thread.thread_id)}
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

                <div
                  className="min-w-0 flex-1 cursor-pointer"
                  onClick={(e) => {
                    if (!isSelectionMode) {
                      e.stopPropagation();
                      handleSelectThread(thread.thread_id);
                    }
                  }}
                >
                  <div className="truncate font-display font-medium text-sm">
                    {(thread.metadata?.title as string) || `Conversation ${i + 1}`}
                  </div>
                  <div className="mt-1 flex items-center gap-1 text-muted-foreground text-xs">
                    <Clock className="size-3" />
                    {formatTimeAgo(thread.updated_at)}
                  </div>
                </div>

                {!isSelectionMode && (
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
                        className="text-destructive focus:text-destructive"
                        disabled={deletingId === thread.thread_id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteThread(thread.thread_id);
                        }}
                      >
                        {deletingId === thread.thread_id ? (
                          <Loader2 className="mr-2 size-4 animate-spin" />
                        ) : (
                          <Trash2 className="mr-2 size-4" />
                        )}
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            ))
          )
        ) : (
          <div className="py-8 text-center text-muted-foreground text-sm">
            Sign in to view your conversations
          </div>
        )}
      </div>

      <ConversationSearch
        onOpenChange={setIsSearchOpen}
        onSelect={(threadId) => {
          setCurrentThreadId(threadId);
          router.push(`/chat/${threadId}`);
          onClose();
        }}
        open={isSearchOpen}
        threads={threads}
      />
    </div>
  );
}
