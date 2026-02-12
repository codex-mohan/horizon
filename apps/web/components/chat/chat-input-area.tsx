"use client";

import React from "react";
import { FileBadge } from "./file-badge";
import {
    ChatInput,
    type AttachedFile as ChatInputAttachedFile,
} from "./chat-input";
import type { AttachedFile } from "./chat-interface";

interface ChatInputAreaProps {
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
 * ChatInputArea - Input area component for the chat interface
 *
 * Features:
 * - File attachment display
 * - Chat input with all controls
 * - Used at the bottom of the chat when messages exist
 */
export function ChatInputArea({
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
}: ChatInputAreaProps) {
    return (
        <div className="border-t border-border p-4">
            <div className="max-w-4xl mx-auto glass-strong rounded-xl p-4">
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
        </div>
    );
}
