"use client";

import { Button } from "@workspace/ui/components/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip";
import { cn } from "@workspace/ui/lib/utils";
import { Bot, Copy, RefreshCw } from "lucide-react";
import { hasCustomUI } from "@/lib/tool-config";
import { BranchSwitcher } from "./branch-switcher";
import { ChatBubble } from "./chat-bubble";
import type { Message } from "./chat-interface";
import { GenerativeUIRenderer } from "./generative-ui-renderer";
import { type ToolCall, ToolCallMessage } from "./tool-call-message";

interface MessageGroupProps {
  id: string;
  userMessage: Message | null;
  /** AI message content that came BEFORE tool calls (intro text) */
  preToolMessage: Message | null;
  assistantMessage: Message | null;
  /** ID of the first AI message in this group - used for regeneration */
  firstAssistantMessageId?: string;
  toolCalls: ToolCall[];
  isLastGroup: boolean;
  branch?: string;
  branchOptions?: string[];
  isLoading: boolean;
  showToolCalls: boolean;
  onEdit: (messageId: string, content: string, isLastGroup: boolean) => void;
  onDelete: (id: string) => void;
  onRegenerate: (messageId: string, isLastGroup: boolean) => void;
  onBranchChange: (branch: string) => void;
}

/**
 * MessageGroup - Renders a single message group (user + assistant pair)
 *
 * Features:
 * - User message with edit/delete actions
 * - Assistant message with regenerate/copy actions
 * - Tool calls display with custom UI support
 * - Branch switcher for navigation
 */
export function MessageGroup({
  id,
  userMessage,
  preToolMessage,
  assistantMessage,
  firstAssistantMessageId,
  toolCalls,
  isLastGroup,
  branch,
  branchOptions,
  isLoading,
  showToolCalls,
  onEdit,
  onDelete,
  onRegenerate,
  onBranchChange,
}: MessageGroupProps) {
  return (
    <div className="space-y-3">
      {/* User Message */}
      {userMessage && (
        <ChatBubble
          branch={branch}
          branchOptions={branchOptions}
          isLastGroup={isLastGroup}
          isLastInGroup={true}
          isLastMessage={isLastGroup}
          isLoading={isLoading}
          message={userMessage}
          onDelete={onDelete}
          onEdit={onEdit}
          showActions={true}
          showAvatar={false}
        />
      )}

      {/* Assistant Group */}
      {(assistantMessage || preToolMessage || toolCalls.length > 0) && (
        <div className="group flex items-start gap-4">
          {/* Assistant Avatar - Always at top of group, before all content */}
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center self-start rounded-lg transition-transform duration-200 hover:scale-110",
              "glass border border-border"
            )}
          >
            <Bot className="size-5 text-primary" />
          </div>

          <div className="flex-1 min-w-0 space-y-2">
            {/* Pre-Tool Message - Intro text before tool calls */}
            {preToolMessage && preToolMessage.content && (
              <ChatBubble
                isLastGroup={isLastGroup}
                isLastInGroup={false}
                isLastMessage={false}
                isLoading={false}
                message={preToolMessage}
                showActions={false}
                showAvatar={false}
              />
            )}

            {/* Tool Calls - Render after pre-tool message */}
            {toolCalls.length > 0 && showToolCalls && (
              <div className="space-y-2">
                {/* Custom Tool UIs */}
                <GenerativeUIRenderer
                  isLoading={toolCalls.some((tc) => tc.status === "loading")}
                  toolCalls={toolCalls.filter((tc) => hasCustomUI(tc.name))}
                />

                {/* Standard Tool Display */}
                {toolCalls.some((tc) => !hasCustomUI(tc.name)) && (
                  <ToolCallMessage
                    isLoading={toolCalls.some((tc) => tc.status === "loading")}
                    toolCalls={toolCalls.filter((tc) => !hasCustomUI(tc.name))}
                  />
                )}
              </div>
            )}

            {/* Assistant Text Message - Final response after tools */}
            {assistantMessage && (assistantMessage.content || assistantMessage.reasoning) && (
              <ChatBubble
                isLastGroup={isLastGroup}
                isLastInGroup={true}
                isLastMessage={isLastGroup}
                isLoading={isLoading}
                message={assistantMessage}
                showActions={false}
                showAvatar={false}
              />
            )}

            {/* Actions Bar */}
            {assistantMessage && (
              <div className="flex items-center gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                {/* Branch Switcher - Only on last group */}
                {isLastGroup && branchOptions && branchOptions.length > 1 && (
                  <BranchSwitcher
                    branch={branch}
                    branchOptions={branchOptions}
                    onSelect={onBranchChange}
                  />
                )}

                {/* Regenerate Button */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        className="transition-all duration-200 hover:scale-110"
                        disabled={isLoading}
                        onClick={() =>
                          onRegenerate(firstAssistantMessageId ?? assistantMessage.id, isLastGroup)
                        }
                        size="icon-sm"
                        variant="ghost"
                      >
                        <RefreshCw
                          className={cn("size-4 text-foreground", isLoading && "animate-spin")}
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

                {/* Copy Button */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        className="transition-all duration-200 hover:scale-110"
                        onClick={() => navigator.clipboard.writeText(assistantMessage.content)}
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
          </div>
        </div>
      )}
    </div>
  );
}
