"use client";

import React from "react";
import { Badge } from "@workspace/ui/components/badge";
import { FileBadge } from "./file-badge";
import {
    ChatInput,
    type AttachedFile as ChatInputAttachedFile,
} from "./chat-input";
import type { AttachedFile } from "./chat-interface";
import { suggestedPrompts } from "./message-grouping";

interface ChatEmptyStateProps {
    attachedFiles: AttachedFile[];
    onSubmit: (text: string, files: ChatInputAttachedFile[]) => void;
    onStop: () => void;
    isLoading: boolean;
    onSettingsOpen: () => void;
    showToolCalls: boolean;
    onToggleToolCalls: () => void;
    isLightTheme: boolean;
    onAttachedFilesChange: (files: AttachedFile[]) => void;
    onRemoveFile: (fileId: string) => void;
}

/**
 * ChatEmptyState - Empty state component displayed when no messages exist
 *
 * Features:
 * - Welcome message with branding
 * - Suggested prompts for quick actions
 * - File attachment display
 * - Chat input for starting conversation
 */
export function ChatEmptyState({
    attachedFiles,
    onSubmit,
    onStop,
    isLoading,
    onSettingsOpen,
    showToolCalls,
    onToggleToolCalls,
    isLightTheme,
    onAttachedFilesChange,
    onRemoveFile,
}: ChatEmptyStateProps) {
    return (
        <div className="max-w-3xl w-full space-y-8 animate-slide-up">
            <div className="text-center space-y-4">
                <div className="text-6xl font-bold bg-linear-to-r from-(--gradient-from) via-(--gradient-via) to-(--gradient-to) bg-clip-text text-transparent animate-pulse font-display tracking-tight">
                    Horizon
                </div>
                <div className="text-sm text-muted-foreground">
                    by Singularity.ai
                </div>
                <p className="text-xl text-muted-foreground">
                    Experience the event horizon of AI conversations
                </p>
            </div>

            <div className="glass-strong rounded-xl p-4 space-y-3">
                {attachedFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                        {attachedFiles.map((file) => (
                            <FileBadge
                                key={file.id}
                                name={file.name}
                                size={file.size}
                                type={file.type}
                                url={file.url}
                                onRemove={() => onRemoveFile(file.id)}
                            />
                        ))}
                    </div>
                )}

                <ChatInput
                    onSubmit={onSubmit}
                    onStop={onStop}
                    isLoading={isLoading}
                    onSettingsOpen={onSettingsOpen}
                    showToolCalls={showToolCalls}
                    onToggleToolCalls={onToggleToolCalls}
                    isLightTheme={isLightTheme}
                    attachedFiles={attachedFiles}
                    onAttachedFilesChange={onAttachedFilesChange}
                />
            </div>

            <div className="flex flex-wrap gap-2 justify-center">
                {suggestedPrompts.map((prompt, i) => (
                    <Badge
                        key={i}
                        variant="outline"
                        className="cursor-pointer hover:scale-105 transition-transform glass-badge"
                        onClick={() => onSubmit(prompt, [])}
                    >
                        {prompt}
                    </Badge>
                ))}
            </div>
        </div>
    );
}
