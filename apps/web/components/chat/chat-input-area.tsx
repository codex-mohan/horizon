"use client";

import { ChatInput, type AttachedFile as ChatInputAttachedFile } from "./chat-input";
import type { AttachedFile } from "./chat-interface";
import { FileBadge } from "./file-badge";

interface ChatInputAreaProps {
  attachedFiles: AttachedFile[];
  onSubmit: (text: string, files: ChatInputAttachedFile[]) => void;
  onStop: () => void;
  isLoading: boolean;
  onSettingsOpen: () => void;
  showToolCalls: boolean;
  onToggleToolCalls: () => void;
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
  onAttachedFilesChange,
  onRemoveFile,
}: ChatInputAreaProps) {
  return (
    <div className="border-border/50 border-t px-4 py-2.5">
      <div className="glass-strong mx-auto max-w-2xl rounded-xl px-4 py-3">
        {attachedFiles.length > 0 && (
          <div className="mb-2.5 flex flex-wrap gap-2">
            {attachedFiles.map((file) => (
              <FileBadge
                key={file.id}
                name={file.name}
                onRemove={() => onRemoveFile(file.id)}
                size={file.size}
                type={file.type}
                url={file.url}
              />
            ))}
          </div>
        )}

        <ChatInput
          attachedFiles={attachedFiles}
          isLoading={isLoading}
          onAttachedFilesChange={onAttachedFilesChange}
          onSettingsOpen={onSettingsOpen}
          onStop={onStop}
          onSubmit={onSubmit}
          onToggleToolCalls={onToggleToolCalls}
          showToolCalls={showToolCalls}
        />
      </div>
    </div>
  );
}
