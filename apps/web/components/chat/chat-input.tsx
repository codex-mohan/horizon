"use client";

import { Button } from "@workspace/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { GradientButton } from "@workspace/ui/components/gradient-button";
import { Textarea } from "@workspace/ui/components/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip";
import { cn } from "@workspace/ui/lib/utils";
import {
  LinkIcon,
  Loader2,
  Mic,
  Paperclip,
  Plus,
  Send,
  SlidersHorizontal,
  Terminal,
  Wrench,
} from "lucide-react";
import type React from "react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useClipboardPaste } from "@/hooks/use-clipboard-paste";
import { type AttachedFile, processFiles } from "@/lib/file-processing";

// Re-export for backward compatibility
export type { AttachedFile };

// ============================================================================
// TYPES
// ============================================================================

export interface ChatInputProps {
  onSubmit: (text: string, files: AttachedFile[]) => void;
  onStop: () => void;
  isLoading: boolean;
  onSettingsOpen: () => void;
  showToolCalls: boolean;
  onToggleToolCalls: () => void;
  isLightTheme: boolean;
  attachedFiles: AttachedFile[];
  onAttachedFilesChange: (files: AttachedFile[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

// ============================================================================
// STATIC DATA
// ============================================================================

const modelGroups = {
  OpenAI: ["gpt-4", "gpt-4-turbo", "gpt-3.5-turbo"],
  Anthropic: ["claude-3-opus", "claude-3-sonnet", "claude-3-haiku"],
  Google: ["gemini-pro", "gemini-pro-vision"],
  Local: ["ollama/llama2", "vllm/mistral"],
} as const;

// ============================================================================
// CHAT INPUT COMPONENT
// ============================================================================

export const ChatInput = memo(function ChatInput({
  onSubmit,
  onStop,
  isLoading,
  onSettingsOpen,
  showToolCalls,
  onToggleToolCalls,
  isLightTheme,
  attachedFiles,
  onAttachedFilesChange,
  disabled = false,
  placeholder = "Ask me anything...",
}: ChatInputProps) {
  const [text, setText] = useState("");
  const [selectedModel, setSelectedModel] = useState("gpt-4");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize clipboard paste handler
  const { handlePaste } = useClipboardPaste({
    maxFileSize: 100 * 1024 * 1024, // 100MB
    onFilesPasted: onAttachedFilesChange,
    existingFiles: attachedFiles,
  });

  // Auto-resize textarea to fit content up to 5 lines
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      // Reset height to auto to correctly calculate scrollHeight for shrinking content
      el.style.height = "auto";
      // Set new height based on scrollHeight, capped at max-height (approx 5 lines)
      const newHeight = Math.min(el.scrollHeight, 120);
      el.style.height = `${newHeight}px`;
    }
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || disabled) {
      return;
    }
    onSubmit(trimmed, attachedFiles);
    setText("");
    onAttachedFilesChange([]);
  }, [text, disabled, onSubmit, attachedFiles, onAttachedFilesChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) {
        return;
      }

      const { validFiles, errors } = processFiles(Array.from(files));

      // Show error messages
      errors.forEach((error) => {
        toast.error(error);
      });

      if (validFiles.length > 0) {
        onAttachedFilesChange([...attachedFiles, ...validFiles]);
        toast.success(
          `Attached ${validFiles.length} file${validFiles.length > 1 ? "s" : ""}`
        );
      }

      e.target.value = "";
    },
    [attachedFiles, onAttachedFilesChange]
  );

  const _removeFile = useCallback(
    (fileId: string) => {
      onAttachedFilesChange(attachedFiles.filter((f) => f.id !== fileId));
    },
    [attachedFiles, onAttachedFilesChange]
  );

  const wordCount = useMemo(
    () => text.trim().split(/\s+/).filter(Boolean).length,
    [text]
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Textarea */}
      <Textarea
        className="max-h-[120px] min-h-[44px] resize-none overflow-y-auto overflow-x-hidden border-0 bg-transparent py-3 focus-visible:ring-0"
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        placeholder={placeholder}
        ref={textareaRef}
        rows={1}
        value={text}
      />

      {/* Bottom Bar */}
      <div className="flex items-center justify-between gap-3 border-border/50 border-t pt-2">
        {/* Left side - All Control Buttons */}
        <div className="flex items-center gap-1">
          <TooltipProvider>
            {/* Attachment / Upload */}
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      className="transition-transform duration-200 hover:scale-110"
                      size="icon-sm"
                      variant="ghost"
                    >
                      <Plus className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="z-100 animate-scale-in">
                    <DropdownMenuItem
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Paperclip className="mr-2 size-4" />
                      Upload File
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <LinkIcon className="mr-2 size-4" />
                      Add URL
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TooltipTrigger>
              <TooltipContent className="z-100 animate-scale-in" side="top">
                <p>Attach files</p>
              </TooltipContent>
            </Tooltip>

            {/* Tools button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  className="transition-transform duration-200 hover:scale-110"
                  size="icon-sm"
                  variant="ghost"
                >
                  <Wrench className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="z-100 animate-scale-in" side="top">
                <p>Tools</p>
              </TooltipContent>
            </Tooltip>

            {/* Tool calls toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  className="transition-transform duration-200 hover:scale-110"
                  onClick={onToggleToolCalls}
                  size="icon-sm"
                  variant="ghost"
                >
                  <Terminal
                    className={cn(
                      "size-4",
                      showToolCalls
                        ? "text-primary"
                        : isLightTheme
                          ? "text-slate-400"
                          : "text-muted-foreground"
                    )}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="z-100 animate-scale-in" side="top">
                <p>Tool Calls {showToolCalls ? "On" : "Off"}</p>
              </TooltipContent>
            </Tooltip>

            {/* Settings */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  className="transition-transform duration-200 hover:scale-110"
                  onClick={onSettingsOpen}
                  size="icon-sm"
                  variant="ghost"
                >
                  <SlidersHorizontal className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="z-100 animate-scale-in" side="top">
                <p>Settings</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Right side - Context + Send */}
        <div className="flex items-center gap-2">
          <TooltipProvider>
            {/* Model selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  className="h-7 text-xs transition-transform duration-200 hover:scale-105"
                  size="sm"
                  variant="ghost"
                >
                  {selectedModel}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="z-100 w-48 animate-scale-in"
              >
                {Object.entries(modelGroups).map(([group, models]) => (
                  <div key={group}>
                    <DropdownMenuLabel className="text-xs">
                      {group}
                    </DropdownMenuLabel>
                    {models.map((model) => (
                      <DropdownMenuItem
                        key={model}
                        onClick={() => setSelectedModel(model)}
                      >
                        {model}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                  </div>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Voice input */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  className="transition-transform duration-200 hover:scale-110"
                  size="icon-sm"
                  variant="ghost"
                >
                  <Mic className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="z-100 animate-scale-in" side="top">
                <p>Voice input</p>
              </TooltipContent>
            </Tooltip>

            <div className="h-5 w-px bg-border/50" />

            {/* Word count */}
            <span className="min-w-[60px] text-right text-muted-foreground text-xs">
              {wordCount} words
            </span>

            {/* Send/Stop button */}
            {isLoading ? (
              <Button
                className="h-9 bg-destructive/10 px-4 text-destructive hover:bg-destructive/20"
                onClick={onStop}
                size="sm"
                variant="ghost"
              >
                <Loader2 className="mr-1 size-4 animate-spin" />
                Stop
              </Button>
            ) : (
              <GradientButton
                className="p-0 text-white"
                disabled={!text.trim()}
                glowIntensity="high"
                height={9}
                icon={<Send className="size-4" />}
                iconOnly
                onClick={handleSubmit}
                radius="full"
                useThemeGradient
                width={9}
              />
            )}
          </TooltipProvider>
        </div>
      </div>

      <input
        className="hidden"
        multiple
        onChange={handleFileChange}
        ref={fileInputRef}
        type="file"
      />
    </div>
  );
});
