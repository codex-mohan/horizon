"use client";

import { Button } from "@workspace/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
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
  AlertTriangle,
  Check,
  LinkIcon,
  Loader2,
  Mic,
  Paperclip,
  Plus,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  SlidersHorizontal,
  Terminal,
  Wrench,
} from "lucide-react";
import type React from "react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useClipboardPaste } from "@/hooks/use-clipboard-paste";
import { type AttachedFile, processFiles } from "@/lib/file-processing";
import {
  ALL_TOOLS,
  DANGEROUS_TOOLS,
  type ToolApprovalMode,
  useChatSettings,
} from "@/lib/stores/chat-settings";

export type { AttachedFile };

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

const modelGroups = {
  "NVIDIA NIM": [
    "qwen/qwen3.5-397b-a17b",
    "meta/llama-3.1-70b-instruct",
    "meta/llama-3.3-70b-instruct",
    "nvidia/llama-3.1-nemotron-70b-instruct",
    "mistralai/mixtral-8x7b-instruct-v0.1",
  ],
  OpenAI: ["gpt-4o", "gpt-4-turbo", "gpt-4", "gpt-3.5-turbo"],
  Anthropic: ["claude-3-5-sonnet-20241022", "claude-3-opus-20240229", "claude-3-haiku-20240307"],
  Google: ["gemini-1.5-pro", "gemini-1.5-flash"],
  Groq: ["llama-3.3-70b-versatile", "mixtral-8x7b-32768"],
  Local: ["ollama/llama3", "ollama/mistral"],
} as const;

const APPROVAL_MODE_CONFIG: Record<
  ToolApprovalMode,
  { label: string; description: string; icon: React.ElementType }
> = {
  always_ask: {
    label: "Always Ask",
    description: "Prompt for all tools",
    icon: ShieldAlert,
  },
  dangerous_only: {
    label: "Dangerous Only",
    description: "Default - prompt for risky tools",
    icon: Shield,
  },
  never_ask: {
    label: "Never Ask",
    description: "Auto-approve all tools",
    icon: ShieldOff,
  },
};

function getToolDisplayName(toolName: string): string {
  const names: Record<string, string> = {
    shell_execute: "Shell Execute",
    file_write: "File Write",
    file_delete: "File Delete",
    web_search: "Web Search",
    fetch_url_content: "Fetch URL",
    duckduckgo_search: "DuckDuckGo Search",
  };
  return names[toolName] || toolName;
}

function isToolDangerous(toolName: string): boolean {
  return DANGEROUS_TOOLS.includes(toolName);
}

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
  const [selectedModel, setSelectedModel] = useState("qwen/qwen3.5-397b-a17b");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { settings, setToolApprovalMode, toggleAutoApproveTool, toggleNeverApproveTool } =
    useChatSettings();

  const { handlePaste } = useClipboardPaste({
    maxFileSize: 100 * 1024 * 1024,
    onFilesPasted: onAttachedFilesChange,
    existingFiles: attachedFiles,
  });

  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      const newHeight = Math.min(el.scrollHeight, 100);
      el.style.height = `${newHeight}px`;
    }
  }, [text]);

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

      errors.forEach((error) => {
        toast.error(error);
      });

      if (validFiles.length > 0) {
        onAttachedFilesChange([...attachedFiles, ...validFiles]);
        toast.success(`Attached ${validFiles.length} file${validFiles.length > 1 ? "s" : ""}`);
      }

      e.target.value = "";
    },
    [attachedFiles, onAttachedFilesChange]
  );

  const approvalMode = settings.toolApprovalMode || "dangerous_only";
  const ModeIcon = APPROVAL_MODE_CONFIG[approvalMode]?.icon || Shield;

  return (
    <div className="flex flex-col gap-3">
      <Textarea
        className="custom-scrollbar max-h-[100px] min-h-[36px] resize-none overflow-y-auto overflow-x-hidden border-0 bg-transparent py-2 text-sm focus-visible:ring-0"
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        placeholder={placeholder}
        ref={textareaRef}
        rows={1}
        value={text}
      />

      <div className="flex items-center justify-between gap-2 border-border/40 border-t pt-1.5">
        <div className="flex items-center gap-1">
          <TooltipProvider>
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
                    <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
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

            {/* Tools Settings Menu */}
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      className={cn(
                        "transition-transform duration-200 hover:scale-110",
                        settings.toolApprovalMode === "always_ask" && "text-amber-500",
                        settings.toolApprovalMode === "never_ask" && "text-emerald-500"
                      )}
                      size="icon-sm"
                      variant="ghost"
                    >
                      <Wrench className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent className="z-100 animate-scale-in" side="top">
                  <p>Tool Settings</p>
                </TooltipContent>
              </Tooltip>

              <DropdownMenuContent align="start" className="z-100 w-72">
                <DropdownMenuLabel className="flex items-center gap-2">
                  <Shield className="size-4" />
                  Tool Approval Mode
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                <DropdownMenuRadioGroup
                  onValueChange={(value) => setToolApprovalMode(value as ToolApprovalMode)}
                  value={settings.toolApprovalMode}
                >
                  {Object.entries(APPROVAL_MODE_CONFIG).map(([mode, config]) => {
                    const Icon = config.icon;
                    return (
                      <DropdownMenuRadioItem
                        className="flex items-center gap-2"
                        key={mode}
                        value={mode}
                      >
                        <Icon className="size-4" />
                        <div className="flex flex-col">
                          <span>{config.label}</span>
                          <span className="text-muted-foreground text-xs">
                            {config.description}
                          </span>
                        </div>
                      </DropdownMenuRadioItem>
                    );
                  })}
                </DropdownMenuRadioGroup>

                <DropdownMenuSeparator />

                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="flex items-center gap-2">
                    <ShieldCheck className="size-4" />
                    <span>Tool Permissions</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="z-100 w-64">
                    <DropdownMenuLabel className="text-xs">
                      Auto-approve / Always require
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {ALL_TOOLS.map((toolName) => {
                      const isDangerous = isToolDangerous(toolName);
                      const autoApproveTools = settings.autoApproveTools || [];
                      const neverApproveTools = settings.neverApproveTools || [];
                      const isAutoApproved = autoApproveTools.includes(toolName);
                      const isNeverApproved = neverApproveTools.includes(toolName);

                      return (
                        <DropdownMenuItem
                          className="flex items-center justify-between"
                          key={toolName}
                          onClick={() => {
                            if (isAutoApproved) {
                              toggleNeverApproveTool(toolName);
                            } else if (isNeverApproved) {
                              toggleAutoApproveTool(toolName);
                            } else {
                              toggleAutoApproveTool(toolName);
                            }
                          }}
                        >
                          <div className="flex items-center gap-2">
                            {isDangerous ? (
                              <AlertTriangle className="size-4 text-amber-500" />
                            ) : (
                              <Check className="size-4 text-emerald-500" />
                            )}
                            <span>{getToolDisplayName(toolName)}</span>
                          </div>
                          <span
                            className={cn(
                              "text-xs",
                              isAutoApproved && "text-emerald-500",
                              isNeverApproved && "text-amber-500"
                            )}
                          >
                            {isAutoApproved ? "Auto" : isNeverApproved ? "Always ask" : "Default"}
                          </span>
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSeparator />

                <div className="flex items-center gap-2 px-2 py-1.5 text-muted-foreground text-xs">
                  <ModeIcon className="size-3" />
                  <span>
                    Current: {APPROVAL_MODE_CONFIG[approvalMode]?.label || "Dangerous Only"}
                  </span>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

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

        <div className="flex items-center gap-2">
          <TooltipProvider>
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
              <DropdownMenuContent align="end" className="z-100 w-48 animate-scale-in">
                {Object.entries(modelGroups).map(([group, models]) => (
                  <div key={group}>
                    <DropdownMenuLabel className="text-xs">{group}</DropdownMenuLabel>
                    {models.map((model) => (
                      <DropdownMenuItem key={model} onClick={() => setSelectedModel(model)}>
                        {model}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                  </div>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

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
