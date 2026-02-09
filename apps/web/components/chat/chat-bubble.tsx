"use client";

import React, { useState, useCallback } from "react";
import { Copy, Pencil, Bot, User, RefreshCw } from "lucide-react";
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
import { BranchSwitcher } from "./branch-switcher";

interface ChatBubbleProps {
  message: Message;
  onEdit?: (messageId: string, content: string, isLastGroup: boolean) => void;
  onDelete?: (messageId: string) => void;
  onRegenerate?: (messageId: string, isLastGroup: boolean) => void;
  onBranchChange?: (branch: string) => void;
  showAvatar?: boolean;
  showActions?: boolean;
  isLoading?: boolean;
  isLastInGroup?: boolean; // Is this the last message in its group?
  isLastGroup?: boolean; // Is this message in the last group of the conversation?
  isLastMessage?: boolean; // Is this the absolute last message?
  branch?: string;
  branchOptions?: string[];
}

/**
 * ChatBubble - Individual chat message component with branching support
 *
 * Features:
 * - Displays user and assistant messages
 * - Supports inline editing for user messages
 * - Shows branch switcher when multiple branches exist
 * - Handles message regeneration for assistant messages
 */
export const ChatBubble = React.memo(
  ({
    message,
    onEdit,
    onDelete,
    onRegenerate,
    onBranchChange,
    showAvatar = true,
    showActions = true,
    isLoading = false,
    isLastInGroup = false,
    isLastGroup = false,
    isLastMessage = false,
    branch,
    branchOptions,
  }: ChatBubbleProps) => {
    const isUser = message.role === "user";
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(message.content);
    const { themeMode } = useTheme();
    const isLightTheme = themeMode === "light";

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

    const handleCopy = useCallback(() => {
      navigator.clipboard.writeText(message.content);
    }, [message.content]);

    const handleEditClick = useCallback(() => {
      setIsEditing(true);
      setEditContent(message.content);
    }, [message.content]);

    const handleRegenerateClick = useCallback(() => {
      if (onRegenerate && !isLoading) {
        onRegenerate(message.id, isLastGroup);
      }
    }, [onRegenerate, isLoading, message.id, isLastGroup]);

    const handleBranchSelect = useCallback(
      (newBranch: string) => {
        if (onBranchChange && newBranch !== branch) {
          onBranchChange(newBranch);
        }
      },
      [onBranchChange, branch],
    );

    // Show branch switcher only if multiple branches exist
    const hasMultipleBranches = branchOptions && branchOptions.length > 1;

    return (
      <div
        className={cn(
          "flex gap-4 group animate-slide-up",
          isUser ? "flex-row-reverse" : "flex-row",
          isEditing && "w-full",
        )}
      >
        {/* Avatar */}
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

        {/* Message Content */}
        <div
          className={cn(
            "flex flex-col gap-2",
            isUser ? "items-end" : "items-start",
            isEditing ? "w-full max-w-full" : "max-w-[85%]",
          )}
        >
          {/* File Attachments */}
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

          {/* Inline Editing Mode */}
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
                <Button
                  size="sm"
                  onClick={handleSaveEdit}
                  className="h-8"
                  disabled={
                    !editContent.trim() ||
                    editContent.trim() === message.content
                  }
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
                {/* Reasoning Block */}
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

                {/* Message Content */}
                <MarkdownView text={message.content} />
              </div>

              {/* Actions Bar */}
              {showActions && (
                <div
                  className={cn(
                    "flex items-center gap-1 transition-opacity duration-200",
                    "opacity-0 group-hover:opacity-100",
                    isUser ? "flex-row-reverse" : "flex-row",
                  )}
                >
                  {/* Branch Switcher - Only on absolute last message */}
                  {isLastMessage && hasMultipleBranches && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div>
                            <BranchSwitcher
                              branch={branch}
                              branchOptions={branchOptions}
                              onSelect={handleBranchSelect}
                            />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Navigate between branches</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}

                  {/* Edit Button (user messages only) */}
                  {isUser && onEdit && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={handleEditClick}
                            disabled={isLoading}
                            className="size-8 bg-background/50 hover:bg-background/80 transition-all duration-200 hover:scale-110"
                          >
                            <Pencil className="size-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>
                            {isLastGroup
                              ? "Edit message (creates new branch)"
                              : "Edit message (replaces conversation from here)"}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}

                  {/* Regenerate Button (assistant messages only) */}
                  {!isUser && onRegenerate && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={handleRegenerateClick}
                            disabled={isLoading}
                            className="size-8 bg-background/50 hover:bg-background/80 transition-all duration-200 hover:scale-110"
                          >
                            <RefreshCw
                              className={cn(
                                "size-4",
                                isLoading && "animate-spin",
                              )}
                            />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>
                            {isLastGroup
                              ? "Regenerate response (creates new branch)"
                              : "Regenerate response (replaces conversation from here)"}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}

                  {/* Copy Button */}
                  <TooltipProvider>
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
                      <TooltipContent>
                        <p>Copy message</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  },
);

ChatBubble.displayName = "ChatBubble";
