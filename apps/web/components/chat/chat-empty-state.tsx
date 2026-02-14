"use client";

import { Badge } from "@workspace/ui/components/badge";
import {
  ChatInput,
  type AttachedFile as ChatInputAttachedFile,
} from "./chat-input";
import type { AttachedFile } from "./chat-interface";
import { FileBadge } from "./file-badge";
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
    <div className="w-full max-w-3xl animate-slide-up space-y-8">
      <div className="space-y-4 text-center">
        <div className="animate-pulse bg-linear-to-r from-(--gradient-from) via-(--gradient-via) to-(--gradient-to) bg-clip-text font-bold font-display text-6xl text-transparent tracking-tight">
          Horizon
        </div>
        <div className="text-muted-foreground text-sm">by Singularity.ai</div>
        <p className="text-muted-foreground text-xl">
          Experience the event horizon of AI conversations
        </p>
      </div>

      <div className="glass-strong space-y-3 rounded-xl p-4">
        {attachedFiles.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
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
          isLightTheme={isLightTheme}
          isLoading={isLoading}
          onAttachedFilesChange={onAttachedFilesChange}
          onSettingsOpen={onSettingsOpen}
          onStop={onStop}
          onSubmit={onSubmit}
          onToggleToolCalls={onToggleToolCalls}
          showToolCalls={showToolCalls}
        />
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {suggestedPrompts.map((prompt, i) => (
          <Badge
            className="glass-badge cursor-pointer transition-transform hover:scale-105"
            key={i}
            onClick={() => onSubmit(prompt, [])}
            variant="outline"
          >
            {prompt}
          </Badge>
        ))}
      </div>
    </div>
  );
}
