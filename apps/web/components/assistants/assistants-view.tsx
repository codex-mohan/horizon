"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import {
  Plus,
  Grid3X3,
  List,
  Star,
  MoreHorizontal,
  MessageSquare,
  Settings,
  Trash2,
  Copy,
  Brain,
  Loader2,
} from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar";
import { Badge } from "@workspace/ui/components/badge";
import { ScrollArea } from "@workspace/ui/components/scroll-area";
import { cn } from "@workspace/ui/lib/utils";
import { useAssistantsStore, type Assistant } from "@/lib/stores/assistants";
import { useAuthStore } from "@/lib/stores/auth";

interface AssistantsViewProps {
  onSelectAssistant?: (assistant: Assistant) => void;
  onClose?: () => void;
}

export function AssistantsView({
  onSelectAssistant,
  onClose,
}: AssistantsViewProps) {
  const { user } = useAuthStore();
  const apiUrl =
    process.env.NEXT_PUBLIC_LANGGRAPH_API_URL || "http://localhost:2024";

  const {
    assistants,
    viewMode,
    sortBy,
    isLoading,
    fetchAssistants,
    deleteAssistant,
    setDefaultAssistant,
    setViewMode,
    setSortBy,
  } = useAssistantsStore();

  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchAssistants(apiUrl, user.id);
    }
  }, [user, apiUrl, fetchAssistants]);

  const sortedAssistants = [...assistants].sort((a, b) => {
    switch (sortBy) {
      case "name":
        return a.name.localeCompare(b.name);
      case "date":
        return (
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        );
      case "usage":
        // Placeholder for usage sorting
        return 0;
      default:
        return 0;
    }
  });

  const handleDelete = async (id: string) => {
    if (!user) return;
    setDeletingId(id);
    try {
      await deleteAssistant(apiUrl, user.id, id);
    } finally {
      setDeletingId(null);
    }
  };

  const handleSetDefault = async (id: string) => {
    if (!user) return;
    await setDefaultAssistant(apiUrl, user.id, id);
  };

  const handleSelect = (assistant: Assistant) => {
    onSelectAssistant?.(assistant);
    onClose?.();
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 pb-2 shrink-0 space-y-3">
        <Button
          className="w-full justify-center gap-2 bg-gradient-to-r from-[var(--gradient-from)] via-[var(--gradient-via)] to-[var(--gradient-to)] text-white hover:opacity-90 hover:shadow-lg hover:shadow-primary/25 transition-all duration-300 border-0"
          onClick={() => {
            /* Open create dialog */
          }}
        >
          <Plus className="size-4" />
          Create Assistant
        </Button>

        {/* View Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setViewMode("grid")}
              className={cn(
                "relative p-2 rounded-md transition-colors",
                viewMode === "grid"
                  ? "text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {viewMode === "grid" && (
                <motion.div
                  layoutId="viewMode"
                  className="absolute inset-0 bg-background rounded-md shadow-sm"
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
              <Grid3X3 className="size-4 relative z-10" />
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setViewMode("list")}
              className={cn(
                "relative p-2 rounded-md transition-colors",
                viewMode === "list"
                  ? "text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {viewMode === "list" && (
                <motion.div
                  layoutId="viewMode"
                  className="absolute inset-0 bg-background rounded-md shadow-sm"
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
              <List className="size-4 relative z-10" />
            </motion.button>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                Sort by {sortBy}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setSortBy("name")}>
                Name
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy("date")}>
                Date
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy("usage")}>
                Usage
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 px-4 pb-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : assistants.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No assistants yet. Create your first one!
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {viewMode === "grid" ? (
              <GridView
                assistants={sortedAssistants}
                onSelect={handleSelect}
                onDelete={handleDelete}
                onSetDefault={handleSetDefault}
                deletingId={deletingId}
              />
            ) : (
              <ListView
                assistants={sortedAssistants}
                onSelect={handleSelect}
                onDelete={handleDelete}
                onSetDefault={handleSetDefault}
                deletingId={deletingId}
              />
            )}
          </AnimatePresence>
        )}
      </ScrollArea>
    </div>
  );
}

// Grid View Component
function GridView({
  assistants,
  onSelect,
  onDelete,
  onSetDefault,
  deletingId,
}: {
  assistants: Assistant[];
  onSelect: (assistant: Assistant) => void;
  onDelete: (id: string) => void;
  onSetDefault: (id: string) => void;
  deletingId: string | null;
}) {
  return (
    <motion.div layout className="grid grid-cols-2 gap-3">
      <AnimatePresence mode="popLayout">
        {assistants.map((assistant, index) => (
          <motion.div
            key={assistant.id}
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 25,
              delay: index * 0.05,
            }}
            whileHover={{ scale: 1.03, y: -4 }}
            className="group relative aspect-square glass rounded-xl overflow-hidden cursor-pointer"
            onClick={() => onSelect(assistant)}
          >
            {/* Background Gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            {/* Avatar */}
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                whileHover={{ scale: 1.1, rotate: 2 }}
                transition={{ type: "spring", stiffness: 200 }}
              >
                <Avatar className="size-20 ring-4 ring-background/50 group-hover:ring-primary/30 transition-all duration-500">
                  <AvatarImage src={assistant.avatar_url} />
                  <AvatarFallback className="text-3xl bg-gradient-to-br from-primary to-accent text-primary-foreground">
                    {assistant.name[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                {assistant.is_default && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-2 -right-2 bg-primary text-primary-foreground rounded-full p-1.5 shadow-lg"
                  >
                    <Star className="size-3 fill-current" />
                  </motion.div>
                )}
              </motion.div>
            </div>

            {/* Info Overlay */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileHover={{ opacity: 1, y: 0 }}
              className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-background/95 via-background/80 to-transparent"
            >
              <h3 className="font-semibold text-sm truncate">
                {assistant.name}
              </h3>
              <p className="text-xs text-muted-foreground line-clamp-1">
                {assistant.description || "No description"}
              </p>

              {/* Quick Actions */}
              <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  size="sm"
                  className="flex-1 h-7 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(assistant);
                  }}
                >
                  <MessageSquare className="size-3 mr-1" />
                  Chat
                </Button>
              </div>
            </motion.div>

            {/* Top Right Actions */}
            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {assistant.memory_enabled && (
                <div className="p-1.5 bg-background/80 rounded-md backdrop-blur-sm">
                  <Brain className="size-3 text-primary" />
                </div>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger
                  asChild
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 bg-background/80 backdrop-blur-sm"
                  >
                    <MoreHorizontal className="size-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onSetDefault(assistant.id);
                    }}
                  >
                    <Star className="size-4 mr-2" />
                    Set as Default
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                    <Settings className="size-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                    <Copy className="size-4 mr-2" />
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(assistant.id);
                    }}
                    disabled={deletingId === assistant.id}
                  >
                    {deletingId === assistant.id ? (
                      <Loader2 className="size-4 mr-2 animate-spin" />
                    ) : (
                      <Trash2 className="size-4 mr-2" />
                    )}
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
}

// List View Component
function ListView({
  assistants,
  onSelect,
  onDelete,
  onSetDefault,
  deletingId,
}: {
  assistants: Assistant[];
  onSelect: (assistant: Assistant) => void;
  onDelete: (id: string) => void;
  onSetDefault: (id: string) => void;
  deletingId: string | null;
}) {
  return (
    <motion.div layout className="space-y-2">
      <AnimatePresence mode="popLayout">
        {assistants.map((assistant, index) => (
          <motion.div
            key={assistant.id}
            layout
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ delay: index * 0.05 }}
            className={cn(
              "flex items-center gap-3 p-3 rounded-lg glass hover:bg-primary/10 transition-all duration-300 group cursor-pointer",
            )}
            onClick={() => onSelect(assistant)}
          >
            {/* Avatar */}
            <div className="relative shrink-0">
              <Avatar className="size-10 ring-2 ring-primary/20 group-hover:ring-primary/50 transition-all">
                <AvatarImage src={assistant.avatar_url} />
                <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground">
                  {assistant.name[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {assistant.is_default && (
                <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                  <Star className="size-2.5 fill-current" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-sm truncate">
                  {assistant.name}
                </h3>
                {assistant.memory_enabled && (
                  <Brain className="size-3 text-primary" />
                )}
                {assistant.is_public && (
                  <Badge
                    variant="secondary"
                    className="text-[10px] px-1.5 py-0 h-4"
                  >
                    Public
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {assistant.description || "No description"}
              </p>
              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                <span>{assistant.model_name}</span>
                <span>•</span>
                <span>{assistant.tools.length} tools</span>
              </div>
            </div>

            {/* Actions */}
            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(assistant);
                }}
              >
                <MessageSquare className="size-4" />
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger
                  asChild
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button variant="ghost" size="icon-sm">
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onSetDefault(assistant.id);
                    }}
                  >
                    <Star className="size-4 mr-2" />
                    Set as Default
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                    <Settings className="size-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                    <Copy className="size-4 mr-2" />
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(assistant.id);
                    }}
                    disabled={deletingId === assistant.id}
                  >
                    {deletingId === assistant.id ? (
                      <Loader2 className="size-4 mr-2 animate-spin" />
                    ) : (
                      <Trash2 className="size-4 mr-2" />
                    )}
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
}
