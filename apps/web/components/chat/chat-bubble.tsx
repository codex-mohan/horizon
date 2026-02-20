"use client";

import { Button } from "@workspace/ui/components/button";
import { Textarea } from "@workspace/ui/components/textarea";
import { cn } from "@workspace/ui/lib/utils";
import { ChevronDown, ChevronUp, Pencil, User } from "lucide-react";
import React, { useCallback, useState } from "react";
import MarkdownView from "@/components/markdown-view";
import { useTheme } from "@/components/theme/theme-provider";
import type { Message } from "./chat-interface";
import { FileBadge } from "./file-badge";

interface ChatBubbleProps {
  message: Message;
  onEdit?: (messageId: string, content: string, isLastGroup: boolean) => void;
  onDelete?: (messageId: string) => void;
  /** Whether to show the user-message action bar (edit button). Ignored for assistant messages. */
  showActions?: boolean;
  isLoading?: boolean;
  isLastGroup?: boolean;
}

/**
 * ChatBubble - Pure content renderer for a single chat message.
 *
 * For USER messages:
 *   - Shows avatar, bubble, file attachments
 *   - Shows an edit button in the hover action bar (if showActions and onEdit are set)
 *
 * For ASSISTANT messages:
 *   - Shows content / reasoning only (no avatar — avatar is managed by MessageGroup)
 *   - NO copy/regenerate/branch controls — those live in MessageGroup's grouped actions bar
 *
 * This keeps the component focused and avoids duplicated control logic.
 */
export const ChatBubble = React.memo(
  ({
    message,
    onEdit,
    onDelete,
    showActions = true,
    isLoading = false,
    isLastGroup = false,
  }: ChatBubbleProps) => {
    const isUser = message.role === "user";
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(message.content);
    const { themeMode } = useTheme();
    const isLightTheme = themeMode === "light";

    const isLongMessage =
      isUser && (message.content.length > 1000 || message.content.split("\n").length > 15);
    const [isExpanded, setIsExpanded] = useState(false);

    const handleSaveEdit = useCallback(() => {
      if (onEdit && editContent.trim() !== message.content) {
        onEdit(message.id, editContent, isLastGroup);
      }
      setIsEditing(false);
    }, [onEdit, editContent, message.id, message.content, isLastGroup]);

    const handleCancelEdit = useCallback(() => {
      setEditContent(message.content);
      setIsEditing(false);
    }, [message.content]);

    const handleEditClick = useCallback(() => {
      setIsEditing(true);
      setEditContent(message.content);
    }, [message.content]);

    return (
      <div
        className={cn(
          "group flex animate-slide-up",
          isUser ? "flex-row-reverse gap-4" : "flex-row gap-0",
          isEditing && "w-full"
        )}
      >
        {/* Avatar (user messages only — assistant avatar is owned by MessageGroup) */}
        {isUser && (
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center self-start rounded-lg transition-transform duration-200 hover:scale-110",
              "bg-linear-to-br from-primary to-accent",
              isEditing && "mt-2"
            )}
          >
            <User className="size-5 text-foreground" />
          </div>
        )}

        {/* Message Content */}
        <div
          className={cn(
            "flex flex-col gap-2",
            isUser ? "items-end max-w-[70%]" : "items-center max-w-[90%]",
            isEditing ? "w-full max-w-full" : ""
          )}
        >
          {/* File Attachments */}
          {message.attachments && message.attachments.length > 0 && !isEditing && (
            <div
              className={cn("mb-1 flex flex-wrap gap-2", isUser ? "justify-end" : "justify-start")}
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

          {/* Inline Editing Mode (user messages only) */}
          {isEditing && isUser ? (
            <div
              className={cn(
                "w-full space-y-3 rounded-xl border p-4",
                isLightTheme ? "border-slate-200 bg-white" : "border-border bg-muted/30"
              )}
            >
              <Textarea
                autoFocus
                className="min-h-[100px] resize-y border-0 bg-transparent p-0 text-base leading-relaxed focus-visible:ring-0"
                onChange={(e) => setEditContent(e.target.value)}
                placeholder="Enter your message..."
                value={editContent}
              />
              <div className="flex items-center justify-end gap-2 border-border/50 border-t pt-2">
                <Button className="h-8" onClick={handleCancelEdit} size="sm" variant="ghost">
                  Cancel
                </Button>
                <Button
                  className="h-8"
                  disabled={!editContent.trim() || editContent.trim() === message.content}
                  onClick={handleSaveEdit}
                  size="sm"
                >
                  Save & Branch
                </Button>
              </div>
            </div>
          ) : (
            /* Normal Message Display */
            <>
              <div
                className={cn(
                  "relative wrap-break-word rounded-xl px-4 py-2 font-body leading-relaxed",
                  isUser
                    ? cn(
                      isLightTheme ? "glass-user-bubble-light" : "glass-user-bubble",
                      "text-foreground"
                    )
                    : "w-full min-w-[120px] text-foreground"
                )}
              >
                {/* Reasoning Block (assistant only) */}
                {message.reasoning && (
                  <div className="mb-4">
                    <div className="mb-2 font-medium text-amber-400/80 text-xs">Reasoning</div>
                    <div className="rounded-2xl border border-amber-500/20 bg-amber-950/50 px-4 py-3">
                      <div className="whitespace-pre-wrap text-amber-100/90 text-sm">
                        {message.reasoning}
                      </div>
                    </div>
                  </div>
                )}

                {/* Message Content */}
                <div
                  className={cn(
                    isLongMessage &&
                    !isExpanded &&
                    "max-h-[300px] overflow-hidden [mask-image:linear-gradient(to_bottom,black_80%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_bottom,black_80%,transparent_100%)]"
                  )}
                >
                  {isUser ? (
                    <div className="whitespace-pre-wrap">{message.content}</div>
                  ) : (
                    <MarkdownView text={message.content} />
                  )}
                </div>

                {isLongMessage && (
                  <div className="mt-2 flex justify-center border-t border-foreground/10 pt-2">
                    <button
                      onClick={() => setIsExpanded(!isExpanded)}
                      className="flex items-center gap-1.5 text-xs text-foreground/70 hover:text-foreground transition-colors font-medium cursor-pointer"
                    >
                      {isExpanded ? "Show less" : "Show more"}
                      {isExpanded ? (
                        <ChevronUp className="size-3.5" />
                      ) : (
                        <ChevronDown className="size-3.5" />
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* User message action bar — edit only */}
              {isUser && showActions && onEdit && (
                <div
                  className={cn(
                    "flex items-center gap-1 transition-opacity duration-200",
                    "opacity-0 group-hover:opacity-100",
                    "flex-row-reverse"
                  )}
                >
                  <Button
                    className="transition-all duration-200 hover:scale-110"
                    disabled={isLoading}
                    onClick={handleEditClick}
                    size="icon-sm"
                    variant="ghost"
                    title={
                      isLastGroup
                        ? "Edit message (creates new branch)"
                        : "Edit message (replaces conversation from here)"
                    }
                  >
                    <Pencil className="size-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }
);

ChatBubble.displayName = "ChatBubble";
