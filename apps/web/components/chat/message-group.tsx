"use client";

import React from "react";
import { Copy, RefreshCw } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@workspace/ui/components/tooltip";
import { cn } from "@workspace/ui/lib/utils";
import { ChatBubble } from "./chat-bubble";
import { ToolCallMessage, type ToolCall } from "./tool-call-message";
import { GenerativeUIRenderer } from "./generative-ui-renderer";
import { BranchSwitcher } from "./branch-switcher";
import { hasCustomUI } from "@/lib/tool-config";
import type { Message } from "./chat-interface";

interface MessageGroupProps {
    id: string;
    userMessage: Message | null;
    assistantMessage: Message | null;
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
    assistantMessage,
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
                    message={userMessage}
                    showAvatar={false}
                    showActions={true}
                    isLoading={isLoading}
                    isLastInGroup={true}
                    isLastGroup={isLastGroup}
                    isLastMessage={isLastGroup}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    branch={branch}
                    branchOptions={branchOptions}
                />
            )}

            {/* Assistant Group */}
            {assistantMessage && (
                <div className="space-y-2 group">
                    {/* Assistant Message (no actions inside bubble) */}
                    <ChatBubble
                        message={assistantMessage}
                        showAvatar={true}
                        showActions={false} // Actions are outside the bubble
                        isLoading={isLoading}
                        isLastInGroup={true}
                        isLastGroup={isLastGroup}
                        isLastMessage={isLastGroup}
                    />

                    {/* Tool Calls */}
                    {toolCalls.length > 0 && showToolCalls && (
                        <div className="ml-14 space-y-2">
                            {/* Custom Tool UIs */}
                            <GenerativeUIRenderer
                                toolCalls={toolCalls.filter((tc) =>
                                    hasCustomUI(tc.name),
                                )}
                                isLoading={toolCalls.some(
                                    (tc) => tc.status === "loading",
                                )}
                            />

                            {/* Standard Tool Display */}
                            {toolCalls.some(
                                (tc) => !hasCustomUI(tc.name),
                            ) && (
                                    <ToolCallMessage
                                        toolCalls={toolCalls.filter(
                                            (tc) => !hasCustomUI(tc.name),
                                        )}
                                        isLoading={toolCalls.some(
                                            (tc) => tc.status === "loading",
                                        )}
                                    />
                                )}
                        </div>
                    )}

                    {/* Actions Bar - OUTSIDE the bubble, at group level */}
                    <div className="ml-14 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        {/* Branch Switcher - Only on last group */}
                        {isLastGroup &&
                            branchOptions &&
                            branchOptions.length > 1 && (
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
                                        variant="ghost"
                                        size="icon-sm"
                                        onClick={() =>
                                            onRegenerate(
                                                assistantMessage.id,
                                                isLastGroup,
                                            )
                                        }
                                        disabled={isLoading}
                                        className="size-8 bg-background/50 hover:bg-background/80 transition-all duration-200 hover:scale-110"
                                    >
                                        <RefreshCw
                                            className={cn(
                                                "size-4 text-foreground",
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

                        {/* Copy Button */}
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        onClick={() =>
                                            navigator.clipboard.writeText(
                                                assistantMessage.content,
                                            )
                                        }
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
                </div>
            )}
        </div>
    );
}
