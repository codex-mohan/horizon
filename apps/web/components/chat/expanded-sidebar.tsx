"use client"

import { X, Clock, ImageIcon, FileText, Grid3x3, List, SortAsc, Trash2, MoreHorizontal, Plus, Loader2 } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@workspace/ui/components/dropdown-menu"
import { cn } from "@workspace/ui/lib/utils"
import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createThreadsClient, type Thread } from "@/lib/threads"
import { useConversationStore } from "@/lib/stores/conversation"
import { useAuthStore } from "@/lib/stores/auth"

interface ExpandedSidebarProps {
  section: "conversations" | "my-items" | "collections" | "assistants"
  onClose: () => void
}

export function ExpandedSidebar({ section, onClose }: ExpandedSidebarProps) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [sortBy, setSortBy] = useState<"name" | "date">("date")
  const [threads, setThreads] = useState<Thread[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const router = useRouter()
  const { currentThreadId, setCurrentThreadId } = useConversationStore()
  const { user } = useAuthStore()
  const apiUrl = process.env.NEXT_PUBLIC_LANGGRAPH_API_URL || "http://localhost:2024"
  const threadsClient = createThreadsClient(apiUrl)

  const fetchThreads = useCallback(async () => {
    if (!user) return // Don't fetch if not logged in

    setIsLoading(true)
    try {
      // Filter threads by current user's ID
      const fetchedThreads = await threadsClient.listThreads(user.id)
      setThreads(fetchedThreads)
    } catch (error) {
      console.error("Failed to fetch threads:", error)
    } finally {
      setIsLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (section === "conversations") {
      fetchThreads()
    }
  }, [section, fetchThreads])

  const handleDeleteThread = async (threadId: string) => {
    setDeletingId(threadId)
    try {
      await threadsClient.deleteThread(threadId)
      setThreads((prev) => prev.filter((t) => t.thread_id !== threadId))
      if (currentThreadId === threadId) {
        setCurrentThreadId(null)
      }
    } catch (error) {
      console.error("Failed to delete thread:", error)
    } finally {
      setDeletingId(null)
    }
  }

  const handleSelectThread = (threadId: string) => {
    setCurrentThreadId(threadId)
    router.push(`/chat/${threadId}`)
    onClose()
  }

  const handleNewConversation = () => {
    setCurrentThreadId(null)
    router.push("/chat/new")
    onClose()
  }

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return "Just now"
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return `${diffDays}d ago`
  }

  const renderContent = () => {
    switch (section) {
      case "conversations":
        return (
          <div className="h-full flex flex-col">
            <div className="p-4 pb-2 shrink-0">
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={handleNewConversation}
              >
                <Plus className="size-4" />
                New Conversation
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-4 space-y-2">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
              ) : threads.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No conversations yet
                </div>
              ) : (
                threads.map((thread, i) => (
                  <div
                    key={thread.thread_id}
                    className={cn(
                      "w-full text-left p-3 rounded-lg glass hover:bg-primary/20 transition-all duration-200 hover-lift stagger-item group flex items-center justify-between",
                      currentThreadId === thread.thread_id && "bg-primary/30 ring-1 ring-primary/50"
                    )}
                  >
                    <button
                      className="flex-1 text-left"
                      onClick={() => handleSelectThread(thread.thread_id)}
                    >
                      <div className="font-medium text-sm truncate">
                        {(thread.metadata?.title as string) || `Conversation ${i + 1}`}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <Clock className="size-3" />
                        {formatTimeAgo(thread.updated_at)}
                      </div>
                    </button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="animate-scale-in">
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleDeleteThread(thread.thread_id)}
                          disabled={deletingId === thread.thread_id}
                        >
                          {deletingId === thread.thread_id ? (
                            <Loader2 className="size-4 mr-2 animate-spin" />
                          ) : (
                            <Trash2 className="size-4 mr-2" />
                          )}
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))
              )}
            </div>
          </div>
        )

      case "my-items":
        return (
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="hover:scale-110 transition-transform duration-200"
                    >
                      {viewMode === "grid" ? <Grid3x3 className="size-4" /> : <List className="size-4" />}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="animate-scale-in">
                    <DropdownMenuItem onClick={() => setViewMode("grid")}>
                      <Grid3x3 className="size-4 mr-2" />
                      Grid View
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setViewMode("list")}>
                      <List className="size-4 mr-2" />
                      List View
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="hover:scale-110 transition-transform duration-200"
                    >
                      <SortAsc className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="animate-scale-in">
                    <DropdownMenuItem onClick={() => setSortBy("name")}>Sort by Name</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortBy("date")}>Sort by Date</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <Tabs defaultValue="uploaded" className="flex-1 flex flex-col">
              <TabsList className="w-full justify-start rounded-none border-b border-border bg-transparent px-4">
                <TabsTrigger value="uploaded">Uploaded</TabsTrigger>
                <TabsTrigger value="generated">Generated</TabsTrigger>
              </TabsList>

              <TabsContent value="uploaded" className="flex-1 mt-0">
                <ScrollArea className="h-full">
                  <div className={cn("p-4", viewMode === "grid" ? "grid grid-cols-2 gap-3" : "space-y-2")}>
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={cn(
                          "glass rounded-lg overflow-hidden hover:bg-primary/20 transition-all duration-200 cursor-pointer hover-lift stagger-item",
                          viewMode === "grid" ? "aspect-square hover-glow" : "p-3 flex items-center gap-3",
                        )}
                      >
                        {viewMode === "grid" ? (
                          <div className="w-full h-full flex items-center justify-center">
                            <FileText className="size-8 text-muted-foreground" />
                          </div>
                        ) : (
                          <>
                            <FileText className="size-6 text-muted-foreground" />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">Document {i}.pdf</div>
                              <div className="text-xs text-muted-foreground">2.4 MB</div>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="generated" className="flex-1 mt-0">
                <ScrollArea className="h-full">
                  <div className={cn("p-4", viewMode === "grid" ? "grid grid-cols-2 gap-3" : "space-y-2")}>
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={cn(
                          "glass rounded-lg overflow-hidden hover:bg-primary/20 transition-all duration-200 cursor-pointer hover-lift stagger-item",
                          viewMode === "grid" ? "aspect-square hover-glow" : "p-3 flex items-center gap-3",
                        )}
                      >
                        {viewMode === "grid" ? (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon className="size-8 text-muted-foreground" />
                          </div>
                        ) : (
                          <>
                            <ImageIcon className="size-6 text-muted-foreground" />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">Generated {i}.png</div>
                              <div className="text-xs text-muted-foreground">1.2 MB</div>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>
        )

      case "collections":
        return (
          <div className="space-y-2 p-4">
            {[1, 2, 3].map((i) => (
              <button
                key={i}
                className="w-full text-left p-3 rounded-lg glass hover:bg-primary/20 transition-all duration-200 hover-lift stagger-item"
              >
                <div className="font-medium text-sm">Collection {i}</div>
                <div className="text-xs text-muted-foreground mt-1">5 items</div>
              </button>
            ))}
          </div>
        )

      case "assistants":
        return (
          <div className="space-y-2 p-4">
            {[1, 2, 3].map((i) => (
              <button
                key={i}
                className="w-full text-left p-3 rounded-lg glass hover:bg-primary/20 transition-all duration-200 hover-lift stagger-item"
              >
                <div className="font-medium text-sm">Assistant {i}</div>
                <div className="text-xs text-muted-foreground mt-1">Custom assistant</div>
              </button>
            ))}
          </div>
        )
    }
  }

  const getSectionTitle = () => {
    switch (section) {
      case "conversations":
        return "Conversations"
      case "my-items":
        return "My Items"
      case "collections":
        return "Collections"
      case "assistants":
        return "Assistants"
    }
  }

  return (
    <div className="w-80 h-screen glass-strong border-l border-border flex flex-col animate-slide-in-right">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="font-semibold">{getSectionTitle()}</h2>
        <Button variant="ghost" size="icon-sm" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-hidden">{renderContent()}</div>
    </div>
  )
}
