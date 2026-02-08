"use client";

import React, { useState, useCallback } from "react";
import { Copy, Pencil, Bot, User } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip";
import { cn } from "@workspace/ui/lib/utils";
import MarkdownView from "@/components/markdown-view";
import type { Message } from "./chat-interface";
import { useTheme } from "@/components/theme/theme-provider";
import { FileBadge } from "./file-badge";

import { Textarea } from "@workspace/ui/components/textarea";

interface ChatBubbleProps {
  message: Message;
  onEdit?: (messageId: string, content: string) => void;
  onDelete?: (messageId: string) => void;
  showAvatar?: boolean;
  showActions?: boolean;
}

export const ChatBubble = React.memo(
  ({
    message,
    onEdit,
    onDelete,
    showAvatar = true,
    showActions = true,
  }: ChatBubbleProps) => {
    const isUser = message.role === "user";
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(message.content);
    const { themeMode } = useTheme();
    const isLightTheme = themeMode === "light";

    const handleCreateBranch = useCallback(() => {
      if (onEdit && editContent.trim() !== message.content) {
        onEdit(message.id, editContent);
        setIsEditing(false);
      } else {
        setIsEditing(false);
      }
    }, [onEdit, editContent, message.id, message.content]);

    const handleCancelEdit = useCallback(() => {
      setEditContent(message.content);
      setIsEditing(false);
    }, [message.content]);

    const handleCopy = useCallback(() => {
      navigator.clipboard.writeText(message.content);
    }, [message.content]);

    return (
      <div
        className={cn(
          "flex gap-4 group animate-slide-up",
          isUser ? "flex-row-reverse" : "flex-row",
          isEditing && "w-full",
        )}
      >
        <div
          className={cn(
            "size-10 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 hover:scale-110 self-start",
            isUser
              ? "bg-gradient-to-br from-[var(--primary)] to-[var(--accent)]"
              : "glass border border-border",
            !showAvatar && !isUser && "invisible",
            isEditing && "mt-2",
          )}
        >
          {isUser ? (
            <User className="size-5 text-[var(--foreground)]" />
          ) : (
            <Bot className="size-5 text-primary" />
          )}
        </div>

        <div
          className={cn(
            "flex flex-col gap-2 max-w-[85%]",
            isUser ? "items-end" : "items-start",
            isEditing && "w-full max-w-full",
          )}
        >
          {message.attachments &&
            message.attachments.length > 0 &&
            !isEditing && (
              <div
                className={cn(
                  "flex flex-wrap gap-2 mb-1",
                  isUser ? "justify-end" : "justify-start",
                )}
              >
                {message.attachments.map((file) => (
                  <FileBadge
                    key={file.id}
                    name={file.name}
                    size={file.size}
                    type={file.type}
                    url={file.url}
                  />
                ))}
              </div>
            )}

          {isEditing ? (
            <div
              className={cn(
                "w-full rounded-xl p-4 space-y-3 border",
                isLightTheme
                  ? "bg-white border-slate-200"
                  : "bg-muted/30 border-border",
              )}
            >
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="min-h-[100px] resize-y bg-transparent border-0 focus-visible:ring-0 p-0 text-base leading-relaxed"
                placeholder="Enter your message..."
                autoFocus
              />
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCancelEdit}
                  className="h-8"
                >
                  Cancel
                </Button>
                <Button size="sm" onClick={handleCreateBranch} className="h-8">
                  Send
                </Button>
              </div>
            </div>
          ) : (
            <div
              className={cn(
                "rounded-xl p-4 relative wrap-break-word font-body leading-relaxed",
                isUser
                  ? cn(
                      isLightTheme
                        ? "glass-user-bubble-light"
                        : "glass-user-bubble",
                      "text-foreground",
                    )
                  : "w-full text-foreground",
              )}
            >
              {message.reasoning && (
                <div className="mb-4">
                  <div className="text-xs font-medium text-amber-400/80 mb-2">
                    Reasoning
                  </div>
                  <div className="bg-amber-950/50 border border-amber-500/20 rounded-2xl px-4 py-3">
                    <div className="text-sm text-amber-100/90 whitespace-pre-wrap">
                      {message.reasoning}
                    </div>
                  </div>
                </div>
              )}

              <MarkdownView text={message.content} />
            </div>
          )}

          {!isEditing && showActions && isUser && (
            <div className="flex items-center gap-2 transition-all duration-300 opacity-0 group-hover:opacity-100">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setIsEditing(true)}
                      className="size-8 bg-background/50 hover:bg-background/80 transition-all duration-200 hover:scale-110"
                    >
                      <Pencil className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="animate-scale-in">
                    <p>Edit</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={handleCopy}
                      className="size-8 bg-background/50 hover:bg-background/80 transition-all duration-200 hover:scale-110"
                    >
                      <Copy className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="animate-scale-in">
                    <p>Copy</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
        </div>
      </div>
    );
  },
);

ChatBubble.displayName = "ChatBubble";
