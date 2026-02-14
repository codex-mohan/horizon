"use client";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { ScrollArea } from "@workspace/ui/components/scroll-area";
import { cn } from "@workspace/ui/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import {
  Brain,
  Copy,
  Grid3X3,
  List,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Settings,
  Star,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { type Assistant, useAssistantsStore } from "@/lib/stores/assistants";
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
    if (!user) {
      return;
    }
    setDeletingId(id);
    try {
      await deleteAssistant(apiUrl, user.id, id);
    } finally {
      setDeletingId(null);
    }
  };

  const handleSetDefault = async (id: string) => {
    if (!user) {
      return;
    }
    await setDefaultAssistant(apiUrl, user.id, id);
  };

  const handleSelect = (assistant: Assistant) => {
    onSelectAssistant?.(assistant);
    onClose?.();
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="shrink-0 space-y-3 p-4 pb-2">
        <Button
          className="w-full justify-center gap-2 border-0 bg-gradient-to-r from-[var(--gradient-from)] via-[var(--gradient-via)] to-[var(--gradient-to)] text-white transition-all duration-300 hover:opacity-90 hover:shadow-lg hover:shadow-primary/25"
          onClick={() => {
            /* Open create dialog */
          }}
        >
          <Plus className="size-4" />
          Create Assistant
        </Button>

        {/* View Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 rounded-lg bg-muted p-1">
            <motion.button
              className={cn(
                "relative rounded-md p-2 transition-colors",
                viewMode === "grid"
                  ? "text-foreground"
                  : "text-muted-foreground"
              )}
              onClick={() => setViewMode("grid")}
              whileTap={{ scale: 0.95 }}
            >
              {viewMode === "grid" && (
                <motion.div
                  className="absolute inset-0 rounded-md bg-background shadow-sm"
                  layoutId="viewMode"
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
              <Grid3X3 className="relative z-10 size-4" />
            </motion.button>
            <motion.button
              className={cn(
                "relative rounded-md p-2 transition-colors",
                viewMode === "list"
                  ? "text-foreground"
                  : "text-muted-foreground"
              )}
              onClick={() => setViewMode("list")}
              whileTap={{ scale: 0.95 }}
            >
              {viewMode === "list" && (
                <motion.div
                  className="absolute inset-0 rounded-md bg-background shadow-sm"
                  layoutId="viewMode"
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
              <List className="relative z-10 size-4" />
            </motion.button>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost">
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
          <div className="py-8 text-center text-muted-foreground">
            No assistants yet. Create your first one!
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {viewMode === "grid" ? (
              <GridView
                assistants={sortedAssistants}
                deletingId={deletingId}
                onDelete={handleDelete}
                onSelect={handleSelect}
                onSetDefault={handleSetDefault}
              />
            ) : (
              <ListView
                assistants={sortedAssistants}
                deletingId={deletingId}
                onDelete={handleDelete}
                onSelect={handleSelect}
                onSetDefault={handleSetDefault}
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
    <motion.div className="grid grid-cols-2 gap-3" layout>
      <AnimatePresence mode="popLayout">
        {assistants.map((assistant, index) => (
          <motion.div
            animate={{ opacity: 1, scale: 1 }}
            className="group glass relative aspect-square cursor-pointer overflow-hidden rounded-xl"
            exit={{ opacity: 0, scale: 0.9 }}
            initial={{ opacity: 0, scale: 0.9 }}
            key={assistant.id}
            layout
            onClick={() => onSelect(assistant)}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 25,
              delay: index * 0.05,
            }}
            whileHover={{ scale: 1.03, y: -4 }}
          >
            {/* Background Gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

            {/* Avatar */}
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                transition={{ type: "spring", stiffness: 200 }}
                whileHover={{ scale: 1.1, rotate: 2 }}
              >
                <Avatar className="size-20 ring-4 ring-background/50 transition-all duration-500 group-hover:ring-primary/30">
                  <AvatarImage src={assistant.avatar_url} />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-3xl text-primary-foreground">
                    {assistant.name[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                {assistant.is_default && (
                  <motion.div
                    animate={{ scale: 1 }}
                    className="absolute -top-2 -right-2 rounded-full bg-primary p-1.5 text-primary-foreground shadow-lg"
                    initial={{ scale: 0 }}
                  >
                    <Star className="size-3 fill-current" />
                  </motion.div>
                )}
              </motion.div>
            </div>

            {/* Info Overlay */}
            <motion.div
              className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/95 via-background/80 to-transparent p-3"
              initial={{ opacity: 0, y: 20 }}
              whileHover={{ opacity: 1, y: 0 }}
            >
              <h3 className="truncate font-semibold text-sm">
                {assistant.name}
              </h3>
              <p className="line-clamp-1 text-muted-foreground text-xs">
                {assistant.description || "No description"}
              </p>

              {/* Quick Actions */}
              <div className="mt-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <Button
                  className="h-7 flex-1 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(assistant);
                  }}
                  size="sm"
                >
                  <MessageSquare className="mr-1 size-3" />
                  Chat
                </Button>
              </div>
            </motion.div>

            {/* Top Right Actions */}
            <div className="absolute top-2 right-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              {assistant.memory_enabled && (
                <div className="rounded-md bg-background/80 p-1.5 backdrop-blur-sm">
                  <Brain className="size-3 text-primary" />
                </div>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger
                  asChild
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    className="h-7 w-7 bg-background/80 backdrop-blur-sm"
                    size="icon"
                    variant="ghost"
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
                    <Star className="mr-2 size-4" />
                    Set as Default
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                    <Settings className="mr-2 size-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                    <Copy className="mr-2 size-4" />
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    disabled={deletingId === assistant.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(assistant.id);
                    }}
                  >
                    {deletingId === assistant.id ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <Trash2 className="mr-2 size-4" />
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
    <motion.div className="space-y-2" layout>
      <AnimatePresence mode="popLayout">
        {assistants.map((assistant, index) => (
          <motion.div
            animate={{ opacity: 1, x: 0 }}
            className={cn(
              "glass group flex cursor-pointer items-center gap-3 rounded-lg p-3 transition-all duration-300 hover:bg-primary/10"
            )}
            exit={{ opacity: 0, x: 20 }}
            initial={{ opacity: 0, x: -20 }}
            key={assistant.id}
            layout
            onClick={() => onSelect(assistant)}
            transition={{ delay: index * 0.05 }}
          >
            {/* Avatar */}
            <div className="relative shrink-0">
              <Avatar className="size-10 ring-2 ring-primary/20 transition-all group-hover:ring-primary/50">
                <AvatarImage src={assistant.avatar_url} />
                <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground">
                  {assistant.name[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {assistant.is_default && (
                <div className="absolute -top-1 -right-1 rounded-full bg-primary p-0.5 text-primary-foreground">
                  <Star className="size-2.5 fill-current" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="truncate font-medium text-sm">
                  {assistant.name}
                </h3>
                {assistant.memory_enabled && (
                  <Brain className="size-3 text-primary" />
                )}
                {assistant.is_public && (
                  <Badge
                    className="h-4 px-1.5 py-0 text-[10px]"
                    variant="secondary"
                  >
                    Public
                  </Badge>
                )}
              </div>
              <p className="truncate text-muted-foreground text-xs">
                {assistant.description || "No description"}
              </p>
              <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                <span>{assistant.model_name}</span>
                <span>•</span>
                <span>{assistant.tools.length} tools</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(assistant);
                }}
                size="icon-sm"
                variant="ghost"
              >
                <MessageSquare className="size-4" />
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger
                  asChild
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button size="icon-sm" variant="ghost">
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
                    <Star className="mr-2 size-4" />
                    Set as Default
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                    <Settings className="mr-2 size-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                    <Copy className="mr-2 size-4" />
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    disabled={deletingId === assistant.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(assistant.id);
                    }}
                  >
                    {deletingId === assistant.id ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <Trash2 className="mr-2 size-4" />
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
