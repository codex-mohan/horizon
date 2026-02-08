"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  memo,
} from "react";
import {
  Plus,
  Wrench,
  SlidersHorizontal,
  Paperclip,
  LinkIcon,
  Send,
  Mic,
  Loader2,
  Terminal,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@workspace/ui/components/button";
import { GradientButton } from "@workspace/ui/components/gradient-button";
import { Textarea } from "@workspace/ui/components/textarea";
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
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@workspace/ui/components/dropdown-menu";
import { cn } from "@workspace/ui/lib/utils";
import { useClipboardPaste } from "@/hooks/use-clipboard-paste";
import {
  processFiles,
  formatFileSize,
  type AttachedFile,
} from "@/lib/file-processing";

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
  }, [text]);

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
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
    [handleSubmit],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;

      const { validFiles, errors } = processFiles(Array.from(files));

      // Show error messages
      errors.forEach((error) => {
        toast.error(error);
      });

      if (validFiles.length > 0) {
        onAttachedFilesChange([...attachedFiles, ...validFiles]);
        toast.success(
          `Attached ${validFiles.length} file${validFiles.length > 1 ? "s" : ""}`,
        );
      }

      e.target.value = "";
    },
    [attachedFiles, onAttachedFilesChange],
  );

  const removeFile = useCallback(
    (fileId: string) => {
      onAttachedFilesChange(attachedFiles.filter((f) => f.id !== fileId));
    },
    [attachedFiles, onAttachedFilesChange],
  );

  const wordCount = useMemo(
    () => text.trim().split(/\s+/).filter(Boolean).length,
    [text],
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Textarea */}
      <Textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        className="min-h-[44px] max-h-[120px] py-3 resize-none bg-transparent border-0 focus-visible:ring-0 overflow-x-hidden overflow-y-auto"
      />

      {/* Bottom Bar */}
      <div className="flex items-center justify-between gap-3 pt-2 border-t border-border/50">
        {/* Left side - All Control Buttons */}
        <div className="flex items-center gap-1">
          <TooltipProvider>
            {/* Attachment / Upload */}
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="hover:scale-110 transition-transform duration-200"
                    >
                      <Plus className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="z-100 animate-scale-in">
                    <DropdownMenuItem
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Paperclip className="size-4 mr-2" />
                      Upload File
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <LinkIcon className="size-4 mr-2" />
                      Add URL
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TooltipTrigger>
              <TooltipContent side="top" className="z-100 animate-scale-in">
                <p>Attach files</p>
              </TooltipContent>
            </Tooltip>

            {/* Tools button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="hover:scale-110 transition-transform duration-200"
                >
                  <Wrench className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="z-100 animate-scale-in">
                <p>Tools</p>
              </TooltipContent>
            </Tooltip>

            {/* Tool calls toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="hover:scale-110 transition-transform duration-200"
                  onClick={onToggleToolCalls}
                >
                  <Terminal
                    className={cn(
                      "size-4",
                      showToolCalls
                        ? "text-primary"
                        : isLightTheme
                          ? "text-slate-400"
                          : "text-muted-foreground",
                    )}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="z-100 animate-scale-in">
                <p>Tool Calls {showToolCalls ? "On" : "Off"}</p>
              </TooltipContent>
            </Tooltip>

            {/* Settings */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={onSettingsOpen}
                  className="hover:scale-110 transition-transform duration-200"
                >
                  <SlidersHorizontal className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="z-100 animate-scale-in">
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
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs hover:scale-105 transition-transform duration-200"
                >
                  {selectedModel}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-48 z-100 animate-scale-in"
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
                  variant="ghost"
                  size="icon-sm"
                  className="hover:scale-110 transition-transform duration-200"
                >
                  <Mic className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="z-100 animate-scale-in">
                <p>Voice input</p>
              </TooltipContent>
            </Tooltip>

            <div className="w-px h-5 bg-border/50" />

            {/* Word count */}
            <span className="text-xs text-muted-foreground min-w-[60px] text-right">
              {wordCount} words
            </span>

            {/* Send/Stop button */}
            {isLoading ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={onStop}
                className="h-9 px-4 bg-destructive/10 text-destructive hover:bg-destructive/20"
              >
                <Loader2 className="size-4 mr-1 animate-spin" />
                Stop
              </Button>
            ) : (
              <GradientButton
                height={9}
                width={9}
                useThemeGradient
                onClick={handleSubmit}
                disabled={!text.trim()}
                glowIntensity="high"
                radius="full"
                iconOnly
                className="p-0 text-white"
                icon={<Send className="size-4" />}
              />
            )}
          </TooltipProvider>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
});
