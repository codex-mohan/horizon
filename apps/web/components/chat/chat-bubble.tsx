"use client";

import React, { useState, useCallback } from "react";
import {
  Copy,
  Pencil,
  Bot,
  User,
  RotateCcw,
  Volume2,
  FileText,
  MoreHorizontal,
  Forklift as Fork,
  Share,
  MessageSquare,
  Trash2,
} from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { cn } from "@workspace/ui/lib/utils";
import MarkdownView from "@/components/markdown-view";
import type { Message } from "./chat-interface";
import { useTheme } from "@/components/theme/theme-provider";
import { FileBadge } from "./file-badge";
import { BranchSwitcher } from "./branch-switcher";

import { Textarea } from "@workspace/ui/components/textarea";

interface ChatBubbleProps {
  message: Message;
  onEdit?: (messageId: string, content: string) => void;
  onRetry?: (messageId: string, content: string) => void;
  onFork?: (messageId: string, content: string) => void;
  onSpeak?: (messageId: string, content: string) => void;
  onSummarize?: (messageId: string, content: string) => void;
  onShare?: (messageId: string, content: string) => void;
  onDelete?: (messageId: string) => void;
  showAvatar?: boolean;
  showActions?: boolean;
  // Branching props
  branch?: string;
  branchOptions?: string[];
  onBranchSelect?: (branch: string) => void;
}

export const ChatBubble = React.memo(({
  message,
  onEdit,
  onRetry,
  onFork,
  onSpeak,
  onSummarize,
  onShare,
  onDelete,
  showAvatar = true,
  showActions = true,
  branch,
  branchOptions,
  onBranchSelect,
}: ChatBubbleProps) => {
  const isUser = message.role === "user";
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const { themeMode } = useTheme();
  const isLightTheme = themeMode === "light";

  if (process.env.NODE_ENV === 'development') {
    console.log(`[ChatBubble] ${message.id.slice(0, 8)} branch=${branch} options=${branchOptions?.length}`);
  }

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(message.content);
  }, [message.content]);

  const handleSpeak = useCallback(() => {
    if ("speechSynthesis" in window) {
      if (isSpeaking) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
      } else {
        const utterance = new SpeechSynthesisUtterance(message.content);
        utterance.onend = () => setIsSpeaking(false);
        window.speechSynthesis.speak(utterance);
        setIsSpeaking(true);
      }
    }
  }, [message.content, isSpeaking]);

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

  // Branch Switcher Logic
  const showSwitcher = branch && branchOptions && branchOptions.length > 1;

  return (
    <div
      className={cn(
        "flex gap-4 group animate-slide-up",
        isUser ? "flex-row-reverse" : "flex-row",
        isEditing && "w-full"
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "size-10 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 hover:scale-110 self-start",
          isUser
            ? "bg-gradient-to-br from-[var(--primary)] to-[var(--accent)]"
            : "glass border border-border",
          !showAvatar && !isUser && "invisible", // Hide avatar but keep space
          isEditing && "mt-2"
        )}
      >
        {isUser ? (
          <User className="size-5 text-[var(--foreground)]" />
        ) : (
          <Bot className="size-5 text-primary" />
        )}
      </div>

      {/* Message Group Container: Holds Bubble + Actions */}
      <div
        className={cn(
          "flex flex-col gap-2 max-w-[85%]",
          isUser ? "items-end" : "items-start",
          isEditing && "w-full max-w-full"
        )}
      >
        {/* Attachments - Outside the bubble */}
        {message.attachments && message.attachments.length > 0 && !isEditing && (
          <div className={cn("flex flex-wrap gap-2 mb-1", isUser ? "justify-end" : "justify-start")}>
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

        {/* Message Content (The Bubble) */}
        {isEditing ? (
          <div className={cn(
            "w-full rounded-xl p-4 space-y-3 border",
            isLightTheme ? "bg-white border-slate-200" : "bg-muted/30 border-border"
          )}>
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
                onClick={handleCreateBranch}
                className="h-8"
              >
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
            {/* Message Content */}
            <MarkdownView text={message.content} />
          </div>
        )}

        {/* Action Buttons (Outside the Bubble) */}
        {!isEditing && (showActions || showSwitcher) && (
          <div className="flex items-center gap-2 transition-all duration-300">
            {/* Branch Switcher - Always Visible if multiple branches exist */}
            {showSwitcher && onBranchSelect && (
              <BranchSwitcher
                branch={branch}
                branchOptions={branchOptions}
                onSelect={onBranchSelect}
                className="mr-1"
              />
            )}

            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
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
                  <TooltipContent className="animate-scale-in">
                    <p>Copy</p>
                  </TooltipContent>
                </Tooltip>

                {/* Assistant-specific actions */}
                {!isUser && (
                  <>
                    {/* Retry */}
                    {onRetry && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => onRetry(message.id, message.content)}
                            className="size-8 bg-background/50 hover:bg-background/80 transition-all duration-200 hover:scale-110"
                          >
                            <RotateCcw className="size-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="animate-scale-in">
                          <p>Retry</p>
                        </TooltipContent>
                      </Tooltip>
                    )}

                    {/* Speaker */}
                    {onSpeak && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={handleSpeak}
                            className={cn(
                              "size-8 bg-background/50 hover:bg-background/80 transition-all duration-200 hover:scale-110",
                              isSpeaking && "text-primary",
                            )}
                          >
                            <Volume2
                              className={cn(
                                "size-4",
                                isSpeaking && "animate-pulse",
                              )}
                            />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="animate-scale-in">
                          <p>{isSpeaking ? "Stop" : "Speak"}</p>
                        </TooltipContent>
                      </Tooltip>
                    )}

                    {/* Summarize */}
                    {onSummarize && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() =>
                              onSummarize(message.id, message.content)
                            }
                            className="size-8 bg-background/50 hover:bg-background/80 transition-all duration-200 hover:scale-110"
                          >
                            <FileText className="size-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="animate-scale-in">
                          <p>Summarize</p>
                        </TooltipContent>
                      </Tooltip>
                    )}

                    {/* Fork */}
                    {onFork && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => onFork(message.id, message.content)}
                            className="size-8 bg-background/50 hover:bg-background/80 transition-all duration-200 hover:scale-110"
                          >
                            <Fork className="size-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="animate-scale-in">
                          <p>Fork to new conversation</p>
                        </TooltipContent>
                      </Tooltip>
                    )}

                    {/* More Options Dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="size-8 bg-background/50 hover:bg-background/80 transition-all duration-200 hover:scale-110"
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="z-[100] animate-scale-in glass border border-border"
                      >
                        {onShare && (
                          <DropdownMenuItem
                            onClick={() => onShare(message.id, message.content)}
                          >
                            <Share className="size-4 mr-2" />
                            Share
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleCopy}>
                          <Copy className="size-4 mr-2" />
                          Copy text
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            navigator.clipboard.writeText(message.content)
                          }
                        >
                          <FileText className="size-4 mr-2" />
                          Copy as markdown
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {onDelete && (
                          <DropdownMenuItem
                            onClick={() => onDelete(message.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="size-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                )}

                {/* User-specific actions */}
                {isUser && (
                  <>
                    {onEdit && (
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
                    )}
                  </>
                )}
              </TooltipProvider>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

ChatBubble.displayName = "ChatBubble";
