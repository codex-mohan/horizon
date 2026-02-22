"use client";

import { Button } from "@workspace/ui/components/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip";
import { cn } from "@workspace/ui/lib/utils";
import { Bot, Copy, CornerDownRight, RefreshCw } from "lucide-react";
import type { ToolStep } from "@/lib/message-grouping";
import { hasCustomUI } from "@/lib/tool-config";
import { BranchSwitcher } from "./branch-switcher";
import { ChatBubble } from "./chat-bubble";
import type { Message } from "./chat-interface";
import { GenerativeUIRenderer } from "./generative-ui-renderer";
import type { ToolApprovalData } from "./tool-approval-banner";
import { ToolApprovalBanner } from "./tool-approval-banner";
import { type ToolCall, ToolCallMessage } from "./tool-call-message";

interface MessageGroupProps {
  id: string;
  userMessage: Message | null;
  /** Ordered list of tool-call rounds inside this group */
  toolSteps: ToolStep[];
  /** The final AI text response (no tool_calls) */
  assistantMessage: Message | null;
  /** ID of the first AI message in this group - used for regeneration */
  firstAssistantMessageId?: string;
  isLastGroup: boolean;
  branch?: string;
  branchOptions?: string[];
  isLoading: boolean;
  hasPendingTasks?: boolean;
  showToolCalls: boolean;
  onEdit: (messageId: string, content: string, isLastGroup: boolean) => void;
  onDelete: (id: string) => void;
  onRegenerate: (messageId: string, isLastGroup: boolean) => void;
  onContinue?: (messageId: string) => void;
  onBranchChange: (branch: string) => void;
  /** When set, renders a ToolApprovalBanner inline at the bottom of the assistant section */
  interrupt?: {
    data: ToolApprovalData;
    onApprove: () => void;
    onReject: () => void;
    isLoading: boolean;
  };
}

/**
 * MessageGroup - Renders a single conversation turn (user + assistant pair).
 *
 * Owns ALL action controls for the group:
 * - User message: edit button (rendered by ChatBubble internally, but edit callback is passed here)
 * - Assistant: copy, regenerate, branch switcher (rendered in this component's actions bar)
 * - Tool approval banner (inline, when interrupt prop is set)
 *
 * Chat bubble is purely a content renderer — it no longer owns assistant-side controls.
 */
export function MessageGroup({
  id,
  userMessage,
  toolSteps,
  assistantMessage,
  firstAssistantMessageId,
  isLastGroup,
  branch,
  branchOptions,
  isLoading,
  hasPendingTasks,
  showToolCalls,
  onEdit,
  onDelete,
  onRegenerate,
  onContinue,
  onBranchChange,
  interrupt,
}: MessageGroupProps) {
  const hasAssistantContent = !!(assistantMessage || toolSteps.length > 0);

  // The message to use as the copy/regenerate reference
  // Prefer final response, fall back to intro message, then to last tool step
  const controlsMessage =
    assistantMessage ??
    toolSteps.at(-1)?.introMessage ??
    (toolSteps.length > 0
      ? { id: `${id}-tool`, role: "assistant" as const, content: "", timestamp: new Date() }
      : null);

  return (
    <div className="space-y-3" data-group-id={id}>
      {/* User Message */}
      {userMessage && (
        <ChatBubble
          isLastGroup={isLastGroup}
          isLoading={isLoading}
          message={userMessage}
          onDelete={onDelete}
          onEdit={onEdit}
        />
      )}

      {/* Assistant Section */}
      {hasAssistantContent && (
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
            {/* Tool Rounds - Rendered in order */}
            {showToolCalls &&
              toolSteps.map((step, stepIdx) => (
                <div className="space-y-2" key={`step-${stepIdx}`}>
                  {/* Intro text for this round (if any) */}
                  {step.introMessage && step.introMessage.content && (
                    <ChatBubble
                      isLastGroup={isLastGroup}
                      isLoading={false}
                      message={step.introMessage}
                      showActions={false}
                    />
                  )}

                  {/* Tool call cards for this round */}
                  {step.toolCalls.length > 0 && (
                    <div className="space-y-2">
                      {/* Custom Tool UIs for THIS step only — keeps order intact */}
                      {step.toolCalls.some((tc) => hasCustomUI(tc.name)) && (
                        <GenerativeUIRenderer
                          isLoading={step.toolCalls.some((tc) => tc.status === "loading")}
                          toolCalls={step.toolCalls.filter((tc) => hasCustomUI(tc.name))}
                        />
                      )}

                      {/* Standard Tool Display for THIS step */}
                      {step.toolCalls.some((tc) => !hasCustomUI(tc.name)) && (
                        <ToolCallMessage
                          isLoading={step.toolCalls.some((tc) => tc.status === "loading")}
                          toolCalls={step.toolCalls.filter((tc) => !hasCustomUI(tc.name))}
                        />
                      )}

                      {/* Inline approval banner - appears after the relevant tool round */}
                      {interrupt && stepIdx === toolSteps.length - 1 && (
                        <ToolApprovalBanner
                          data={interrupt.data}
                          isLoading={interrupt.isLoading}
                          onApprove={interrupt.onApprove}
                          onReject={interrupt.onReject}
                        />
                      )}
                    </div>
                  )}
                </div>
              ))}

            {/* If there are no tool steps but there IS an interrupt (edge case: interrupt fired
                before any tool step was committed to the message list) */}
            {interrupt && toolSteps.length === 0 && (
              <ToolApprovalBanner
                data={interrupt.data}
                isLoading={interrupt.isLoading}
                onApprove={interrupt.onApprove}
                onReject={interrupt.onReject}
              />
            )}

            {/* Final Assistant Text Message */}
            {assistantMessage && (assistantMessage.content || assistantMessage.reasoning) && (
              <ChatBubble
                isLastGroup={isLastGroup}
                isLoading={isLoading}
                message={assistantMessage}
                showActions={false}
              />
            )}

            {/* Group-level Actions Bar */}
            {controlsMessage && (
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
                          onRegenerate(firstAssistantMessageId ?? controlsMessage.id, isLastGroup)
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

                {/* Continue Button - Only on last group when not loading and there's assistant content */}
                {isLastGroup &&
                  !isLoading &&
                  onContinue &&
                  (assistantMessage || toolSteps.length > 0) && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            className="transition-all duration-200 hover:scale-110"
                            onClick={() =>
                              onContinue(assistantMessage?.id ?? firstAssistantMessageId ?? "")
                            }
                            size="icon-sm"
                            variant="ghost"
                          >
                            <CornerDownRight className="size-4 text-foreground" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Continue generating</p>
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
                        onClick={() => navigator.clipboard.writeText(controlsMessage.content)}
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
