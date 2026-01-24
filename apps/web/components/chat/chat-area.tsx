"use client";

import type React from "react";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Plus,
  Wrench,
  SlidersHorizontal,
  Paperclip,
  LinkIcon,
  Pencil,
  Send,
  X,
  Mic,
  Loader2,
} from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { GradientButton } from "@workspace/ui/components/gradient-button";
import { Textarea } from "@workspace/ui/components/textarea";
import { Badge } from "@workspace/ui/components/badge";
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
import { ChatBubble } from "./chat-bubble";
import { cn } from "@workspace/ui/lib/utils";
import type { Message, AttachedFile } from "./chat-interface";
import { FileAttachment } from "@workspace/ui/components/file-attachment";
import { ActivityTimeline } from "./activity-timeline";
import { ToolCallMessage, type ToolCall } from "./tool-call-message";
import { useChat, ProcessedEvent as ChatProcessedEvent } from "@/lib/chat";
import { useChatSettings } from "@/lib/stores/chat-settings";
import {
  combineToolMessages,
  getCombinedToolCalls,
  isToolMessage,
  debugToolMessages,
} from "@/lib/chat-utils";
import type { Message as LangGraphMessage } from "@langchain/langgraph-sdk";
import { useTheme } from "@/components/theme/theme-provider";
import { Terminal } from "lucide-react";

interface ChatAreaProps {
  messages: Message[];
  attachedFiles: AttachedFile[];
  onMessagesChange: (messages: Message[]) => void;
  onAttachedFilesChange: (files: AttachedFile[]) => void;
  onSettingsOpen: () => void;
}

const suggestedPrompts = [
  "Explain quantum computing in simple terms",
  "Write a Python function to sort an array",
  "What are the latest trends in AI?",
  "Help me plan a trip to Japan",
];

export function ChatArea({
  messages,
  attachedFiles,
  onMessagesChange,
  onAttachedFilesChange,
  onSettingsOpen,
}: ChatAreaProps) {
  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState("gpt-4");
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [liveActivityEvents, setLiveActivityEvents] = useState<
    ChatProcessedEvent[]
  >([]);
  const [historicalActivities, setHistoricalActivities] = useState<
    Record<string, ChatProcessedEvent[]>
  >({});
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const hasFinalizeEventOccurredRef = useRef(false);
  const { themeMode } = useTheme();
  const isLightTheme = themeMode === "light";
  const { settings, toggleShowToolCalls } = useChatSettings();
  const [currentToolCalls, setCurrentToolCalls] = useState<ToolCall[]>([]);

  const thread = useChat({
    apiUrl:
      process.env.NEXT_PUBLIC_LANGGRAPH_API_URL || "http://localhost:2024",
    assistantId: "agent",
    onEvent: (event: Record<string, unknown>) => {
      const processedEvent = thread.processEvent(event);
      if (processedEvent) {
        setLiveActivityEvents((prev) => [...prev, processedEvent]);
      }

      if (event.tools && settings.showToolCalls) {
        const toolsEvent = event.tools as Record<string, unknown>;
        if (toolsEvent.tool_calls && Array.isArray(toolsEvent.tool_calls)) {
          const newToolCalls: ToolCall[] = toolsEvent.tool_calls.map(
            (tc: Record<string, unknown>, idx: number) => {
              let name = "unknown";
              if (tc.name && typeof tc.name === "string") {
                name = tc.name;
              } else if (
                tc.function &&
                typeof tc.function === "object" &&
                tc.function &&
                (tc.function as Record<string, unknown>).name
              ) {
                name =
                  ((tc.function as Record<string, unknown>).name as string) ||
                  "unknown";
              }
              return {
                id: `tool-${Date.now()}-${idx}`,
                name,
                arguments: (tc.input as Record<string, unknown>) || {},
                status: "loading",
              };
            },
          );
          setCurrentToolCalls((prev) => [...prev, ...newToolCalls]);
        }
      }
    },
  });

  const hasMessages = messages.length > 0;

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf("image") !== -1) {
          const blob = item.getAsFile();
          if (blob) {
            const url = URL.createObjectURL(blob);
            onAttachedFilesChange([
              ...attachedFiles,
              {
                id: Date.now().toString(),
                name: `image-${Date.now()}.png`,
                type: item.type,
                url,
                size: blob.size,
              },
            ]);
          }
        }
      }
    };

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [attachedFiles, onAttachedFilesChange]);

  useEffect(() => {
    if (
      hasFinalizeEventOccurredRef.current &&
      !thread.isLoading &&
      thread.messages.length > 0
    ) {
      const lastMessage = thread.messages[thread.messages.length - 1];
      if (lastMessage && lastMessage.type === "ai" && lastMessage.id) {
        setHistoricalActivities((prev) => ({
          ...prev,
          [lastMessage.id!]: [...liveActivityEvents],
        }));
      }
      hasFinalizeEventOccurredRef.current = false;
    }
  }, [thread.messages, thread.isLoading, liveActivityEvents]);

  useEffect(() => {
    if (thread.messages.length > 0) {
      debugToolMessages(thread.messages);
      const combinedMessages = combineToolMessages(thread.messages);

      const convertedMessages: Message[] = combinedMessages
        .filter((msg) => !isToolMessage(msg))
        .map((msg: LangGraphMessage) => {
          const combinedToolCalls = getCombinedToolCalls(msg);
          const msgData = msg as unknown as Record<string, unknown>;
          const hasToolCalls =
            msgData.tool_calls &&
            Array.isArray(msgData.tool_calls) &&
            msgData.tool_calls.length > 0;
          const msgWithTimestamp = msg as LangGraphMessage & {
            created_at?: number;
          };

          let content =
            typeof msg.content === "string"
              ? msg.content
              : JSON.stringify(msg.content);

          if (
            (combinedToolCalls && combinedToolCalls.length > 0) ||
            hasToolCalls
          ) {
            const hasContent = content && content.trim().length > 0;
            content = hasContent
              ? `${content}\n\n_Tools executed successfully_`
              : `_Tools executed successfully_`;
          }

          return {
            id: msg.id || Date.now().toString(),
            role: msg.type === "human" ? "user" : "assistant",
            content,
            timestamp: new Date(
              msgWithTimestamp.created_at
                ? new Date(msgWithTimestamp.created_at * 1000)
                : Date.now(),
            ),
            ...((combinedToolCalls && combinedToolCalls.length > 0) ||
            hasToolCalls
              ? { _combinedToolCalls: combinedToolCalls || [] }
              : {}),
          };
        });

      console.log("Converted messages:", convertedMessages.length);
      onMessagesChange(convertedMessages);
    }
  }, [thread.messages, onMessagesChange]);

  const wordCount = input.trim().split(/\s+/).filter(Boolean).length;

  const handleSend = useCallback(() => {
    if (!input.trim() && attachedFiles.length === 0) return;

    if (isEditing) {
      onMessagesChange(
        messages.map((msg) =>
          msg.id === isEditing ? { ...msg, content: input } : msg,
        ),
      );
      setIsEditing(null);
    } else {
      const userMessage: Message = {
        id: Date.now().toString(),
        role: "user",
        content: input,
        timestamp: new Date(),
        attachments: attachedFiles.length > 0 ? attachedFiles : undefined,
      };

      const newMessages: Message[] = [...messages, userMessage];
      onMessagesChange(newMessages);

      setLiveActivityEvents([]);
      hasFinalizeEventOccurredRef.current = false;

      thread.submit({
        messages: [
          {
            type: "human" as const,
            content: input,
          },
        ],
      });
    }

    setInput("");
    onAttachedFilesChange([]);
  }, [
    input,
    attachedFiles,
    isEditing,
    messages,
    onMessagesChange,
    onAttachedFilesChange,
    thread,
  ]);

  const handleStop = useCallback(() => {
    thread.stop();
  }, [thread]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newFiles: AttachedFile[] = files.map((file) => ({
      id: Date.now().toString() + file.name,
      name: file.name,
      type: file.type,
      url: URL.createObjectURL(file),
      size: file.size,
    }));
    onAttachedFilesChange([...attachedFiles, ...newFiles]);
  };

  const handleEdit = (messageId: string, content: string) => {
    setIsEditing(messageId);
    setInput(content);
    textareaRef.current?.focus();
  };

  const handleRetry = (messageId: string, content: string) => {
    console.log("Retry message:", messageId, content);
  };

  const handleFork = (messageId: string, content: string) => {
    console.log("Fork message:", messageId, content);
  };

  const handleSpeak = (messageId: string, content: string) => {
    console.log("Speak message:", messageId, content);
  };

  const handleSummarize = (messageId: string, content: string) => {
    console.log("Summarize message:", messageId, content);
  };

  const handleShare = (messageId: string, content: string) => {
    console.log("Share message:", messageId, content);
  };

  const handleDelete = (messageId: string) => {
    onMessagesChange(messages.filter((msg) => msg.id !== messageId));
  };

  const modelGroups = {
    OpenAI: ["gpt-4", "gpt-4-turbo", "gpt-3.5-turbo"],
    Anthropic: ["claude-3-opus", "claude-3-sonnet", "claude-3-haiku"],
    Google: ["gemini-pro", "gemini-pro-vision"],
    Local: ["ollama/llama2", "vllm/mistral"],
  };

  const renderChatInput = () => (
    <div className="glass-strong rounded-xl p-4 space-y-3 hover-lift">
      {attachedFiles.length > 0 && (
        <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-2">
          {attachedFiles.map((file) => (
            <FileAttachment
              key={file.id}
              file={file}
              size={file.size}
              onRemove={() =>
                onAttachedFilesChange(
                  attachedFiles.filter((f) => f.id !== file.id),
                )
              }
              variant="input"
            />
          ))}
        </div>
      )}

      {isEditing && (
        <div className="flex items-center justify-between w-full">
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <span className="font-medium text-foreground/80">
              Editing message
            </span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setIsEditing(null);
              setInput("");
            }}
            className="h-7 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <X className="size-3 mr-1" />
            Cancel
          </Button>
        </div>
      )}

      <Textarea
        ref={textareaRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
          }
        }}
        placeholder="Ask me anything..."
        className="min-h-20 max-h-[150px] resize-none bg-transparent border-0 focus-visible:ring-0 transition-all duration-200"
      />

      <div className="flex items-center justify-between gap-3 pt-2 border-t border-border/50">
        <div className="flex items-center gap-2">
          <TooltipProvider>
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

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="hover:scale-110 transition-transform duration-200"
                  onClick={toggleShowToolCalls}
                >
                  <Terminal
                    className={cn(
                      "size-4",
                      settings.showToolCalls
                        ? "text-primary"
                        : isLightTheme
                          ? "text-slate-400"
                          : "text-muted-foreground",
                    )}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="z-100 animate-scale-in">
                <p>Tool Calls {settings.showToolCalls ? "On" : "Off"}</p>
              </TooltipContent>
            </Tooltip>

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
                <p>Model settings</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground transition-opacity duration-200">
            {wordCount} words
          </span>

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

          {thread.isLoading ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleStop}
              className="h-9 px-4 text-xs hover:scale-105 transition-transform duration-200 bg-destructive/10 text-destructive hover:bg-destructive/20"
            >
              <Loader2 className="size-4 mr-1 animate-spin" />
              Stop
            </Button>
          ) : (
            <GradientButton
              height={9}
              width={9}
              useThemeGradient
              onClick={handleSend}
              disabled={!input.trim() && attachedFiles.length === 0}
              glowIntensity="high"
              icon={
                isEditing ? (
                  <Pencil className="size-4" />
                ) : (
                  <Send className="size-4" />
                )
              }
              className="p-0 text-white"
            ></GradientButton>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col relative z-10">
      <div
        ref={chatContainerRef}
        className={cn(
          "flex-1 overflow-y-auto custom-scrollbar",
          hasMessages ? "p-4" : "flex items-center justify-center",
        )}
      >
        {!hasMessages ? (
          <div className="max-w-3xl w-full space-y-8 animate-slide-up">
            <div className="text-center space-y-4">
              <div className="inline-block">
                <div className="text-6xl font-bold bg-linear-to-r from-(--gradient-from) via-(--gradient-via) to-(--gradient-to) bg-clip-text text-transparent animate-pulse">
                  Horizon
                </div>
                <div
                  className="text-sm text-muted-foreground mt-2 animate-slide-up"
                  style={{ animationDelay: "0.1s" }}
                >
                  by Singularity.ai
                </div>
              </div>
              <p
                className="text-xl text-muted-foreground animate-slide-up"
                style={{ animationDelay: "0.2s" }}
              >
                Experience the event horizon of AI conversations
              </p>
            </div>

            <div
              className="space-y-4 animate-slide-up"
              style={{ animationDelay: "0.3s" }}
            >
              {renderChatInput()}

              <div className="flex flex-wrap gap-2 justify-center">
                {suggestedPrompts.map((prompt, index) => (
                  <Badge
                    key={index}
                    className="cursor-pointer transition-all duration-200 hover:scale-105 hover-lift hover-glow stagger-item glass-badge"
                    style={{ animationDelay: `${0.4 + index * 0.05}s` }}
                    onClick={() => setInput(prompt)}
                  >
                    {prompt}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto w-full space-y-6">
            {messages.map((message, index) => {
              const isLast = index === messages.length - 1;
              return (
                <div key={message.id} className="space-y-3">
                  <div
                    className={`flex items-start gap-3 ${
                      message.role === "user" ? "justify-end" : ""
                    }`}
                  >
                    {message.role === "user" ? (
                      <ChatBubble
                        message={message}
                        onEdit={handleEdit}
                        onRetry={handleRetry}
                        onFork={handleFork}
                        onSpeak={handleSpeak}
                        onSummarize={handleSummarize}
                        onShare={handleShare}
                        onDelete={handleDelete}
                      />
                    ) : (
                      <div className="w-full">
                        {isLast &&
                          thread.isLoading &&
                          settings.showToolCalls &&
                          currentToolCalls.length > 0 && (
                            <div className="mb-3">
                              <ToolCallMessage
                                toolCalls={currentToolCalls}
                                isLoading={thread.isLoading}
                              />
                            </div>
                          )}
                        {isLast &&
                          thread.isLoading &&
                          settings.showActivityTimeline &&
                          liveActivityEvents.length > 0 && (
                            <div className="mb-3">
                              <ActivityTimeline
                                processedEvents={liveActivityEvents}
                                isLoading={thread.isLoading}
                              />
                            </div>
                          )}
                        {message._combinedToolCalls ? (
                          <div className="space-y-3">
                            {settings.showToolCalls && (
                              <ToolCallMessage
                                toolCalls={
                                  message._combinedToolCalls as ToolCall[]
                                }
                                isLoading={
                                  thread.isLoading &&
                                  message._combinedToolCalls.length === 0
                                }
                              />
                            )}
                            {message.content && (
                              <ChatBubble
                                message={message}
                                onEdit={handleEdit}
                                onRetry={handleRetry}
                                onFork={handleFork}
                                onSpeak={handleSpeak}
                                onSummarize={handleSummarize}
                                onShare={handleShare}
                                onDelete={handleDelete}
                              />
                            )}
                          </div>
                        ) : (
                          <ChatBubble
                            message={message}
                            onEdit={handleEdit}
                            onRetry={handleRetry}
                            onFork={handleFork}
                            onSpeak={handleSpeak}
                            onSummarize={handleSummarize}
                            onShare={handleShare}
                            onDelete={handleDelete}
                          />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {thread.isLoading &&
              (messages.length === 0 ||
                messages[messages.length - 1].role === "user") && (
                <div className="flex items-start gap-3 mt-3">
                  <div
                    className={cn(
                      "relative group max-w-[85%] md:max-w-[80%]",
                      "rounded-xl p-3 break-words",
                      "rounded-bl-none w-full min-h-[56px]",
                      isLightTheme
                        ? "glass-strong bg-white/60"
                        : "glass bg-card/60",
                    )}
                  >
                    {liveActivityEvents.length > 0 ||
                    currentToolCalls.length > 0 ? (
                      <div className="text-xs space-y-2">
                        {settings.showToolCalls &&
                          currentToolCalls.length > 0 && (
                            <ToolCallMessage
                              toolCalls={currentToolCalls}
                              isLoading={true}
                            />
                          )}
                        {settings.showActivityTimeline &&
                          liveActivityEvents.length > 0 && (
                            <ActivityTimeline
                              processedEvents={liveActivityEvents}
                              isLoading={true}
                            />
                          )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-start h-full gap-2">
                        <Loader2
                          className={cn(
                            "h-5 w-5 animate-spin",
                            isLightTheme ? "text-slate-600" : "text-primary",
                          )}
                        />
                        <span
                          className={
                            isLightTheme ? "text-slate-600" : "text-foreground"
                          }
                        >
                          Processing...
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
          </div>
        )}
      </div>

      {hasMessages && (
        <div className="border-t border-border p-4 animate-slide-up">
          <div className="max-w-4xl mx-auto">{renderChatInput()}</div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />
    </div>
  );
}
