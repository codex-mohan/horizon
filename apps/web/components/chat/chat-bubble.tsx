"use client";

import { useState } from "react";
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
import { FileAttachment } from "@workspace/ui/components/file-attachment";

interface ChatBubbleProps {
  message: Message;
  onEdit?: (messageId: string, content: string) => void;
  onRetry?: (messageId: string, content: string) => void;
  onFork?: (messageId: string, content: string) => void;
  onSpeak?: (messageId: string, content: string) => void;
  onSummarize?: (messageId: string, content: string) => void;
  onShare?: (messageId: string, content: string) => void;
  onDelete?: (messageId: string) => void;
}

export const ChatBubble = ({
  message,
  onEdit,
  onRetry,
  onFork,
  onSpeak,
  onSummarize,
  onShare,
  onDelete,
}: ChatBubbleProps) => {
  const isUser = message.role === "user";
  const [isSpeaking, setIsSpeaking] = useState(false);
  const { themeMode } = useTheme();
  const isLightTheme = themeMode === "light";

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
  };

  const handleSpeak = () => {
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
  };

  return (
    <div
      className={cn(
        "flex gap-4 group animate-slide-up",
        isUser ? "flex-row-reverse" : "flex-row",
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "size-10 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 hover:scale-110 self-start",
          isUser
            ? "bg-gradient-to-br from-[var(--primary)] to-[var(--accent)]"
            : "glass border border-border",
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
        )}
      >
        {/* Attachments - Outside the bubble */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {message.attachments.map((file) => (
              <FileAttachment
                key={file.id}
                file={file}
                size={file.size}
                variant="bubble"
              />
            ))}
          </div>
        )}

        {/* Message Content (The Bubble) */}
        <div
          className={cn(
            "rounded-xl p-4 relative text-base wrap-break-word whitespace-pre-wrap",
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

        {/* Action Buttons (Outside the Bubble) */}
        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300">
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
                        onClick={() => onSummarize(message.id, message.content)}
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
                        onClick={() => onEdit(message.id, message.content)}
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
    </div>
  );
};
