"use client";

import { Button } from "@workspace/ui/components/button";
import { Textarea } from "@workspace/ui/components/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip";
import { cn } from "@workspace/ui/lib/utils";
import { Bot, Copy, Pencil, RefreshCw, User } from "lucide-react";
import React, { useCallback, useState } from "react";
import MarkdownView from "@/components/markdown-view";
import { useTheme } from "@/components/theme/theme-provider";
import { BranchSwitcher } from "./branch-switcher";
import type { Message } from "./chat-interface";
import { FileBadge } from "./file-badge";

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
      [onBranchChange, branch]
    );

    // Show branch switcher only if multiple branches exist
    const hasMultipleBranches = branchOptions && branchOptions.length > 1;

    return (
      <div
        className={cn(
          "group flex animate-slide-up",
          isUser ? "flex-row-reverse gap-4" : "flex-row",
          !isUser && !showAvatar && "gap-0",
          !isUser && showAvatar && "gap-4",
          isEditing && "w-full"
        )}
      >
        {/* Avatar */}
        {(showAvatar || isUser) && (
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center self-start rounded-lg transition-transform duration-200 hover:scale-110",
              isUser ? "bg-linear-to-br from-primary to-accent" : "glass border border-border",
              isEditing && "mt-2"
            )}
          >
            {isUser ? (
              <User className="size-5 text-foreground" />
            ) : (
              <Bot className="size-5 text-primary" />
            )}
          </div>
        )}

        {/* Message Content */}
        <div
          className={cn(
            "flex flex-col gap-2",
            isUser ? "items-end" : "items-start",
            isEditing ? "w-full max-w-full" : "max-w-[95%]"
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

          {/* Inline Editing Mode */}
          {isEditing ? (
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
                  "relative min-w-[120px] break-words rounded-xl p-4 font-body leading-relaxed",
                  isUser
                    ? cn(
                      isLightTheme ? "glass-user-bubble-light" : "glass-user-bubble",
                      "text-foreground"
                    )
                    : "w-full text-foreground"
                )}
              >
                {/* Reasoning Block */}
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
                <MarkdownView text={message.content} />
              </div>

              {/* Actions Bar */}
              {showActions && (
                <div
                  className={cn(
                    "flex items-center gap-1 transition-opacity duration-200",
                    "opacity-0 group-hover:opacity-100",
                    isUser ? "flex-row-reverse" : "flex-row"
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
                            className="transition-all duration-200 hover:scale-110"
                            disabled={isLoading}
                            onClick={handleEditClick}
                            size="icon-sm"
                            variant="ghost"
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
                            className="transition-all duration-200 hover:scale-110"
                            disabled={isLoading}
                            onClick={handleRegenerateClick}
                            size="icon-sm"
                            variant="ghost"
                          >
                            <RefreshCw className={cn("size-4", isLoading && "animate-spin")} />
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
                          className="transition-all duration-200 hover:scale-110"
                          onClick={handleCopy}
                          size="icon-sm"
                          variant="ghost"
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
  }
);

ChatBubble.displayName = "ChatBubble";
