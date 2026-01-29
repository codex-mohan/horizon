"use client";

import type React from "react";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
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
import { useChat, ProcessedEvent as ChatProcessedEvent, type UseChatOptions, type ChatError } from "@/lib/chat";
import { useChatSettings } from "@/lib/stores/chat-settings";
import {
  combineToolMessages,
  getCombinedToolCallsFromMap,
  isToolMessage,
  debugToolMessages,
  type CombinedToolCall,
} from "@/lib/chat-utils";
import type { Message as LangGraphMessage } from "@langchain/langgraph-sdk";
import { useTheme } from "@/components/theme/theme-provider";
import { Terminal } from "lucide-react";
import { createThreadsClient } from "@/lib/threads";
import { generateConversationTitle } from "@/lib/title-utils";
import { useAuthStore } from "@/lib/stores/auth";

interface ChatAreaProps {
  messages: Message[];
  attachedFiles: AttachedFile[];
  onMessagesChange: (messages: Message[]) => void;
  onAttachedFilesChange: (files: AttachedFile[]) => void;
  onSettingsOpen: () => void;
  threadId?: string | null;
  onThreadChange?: (threadId: string | null) => void;
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
  threadId,
  onThreadChange,
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
  const [chatError, setChatError] = useState<string | null>(null);
  const [toolCallsMap, setToolCallsMap] = useState<Map<string, CombinedToolCall[]>>(new Map());

  // Get current user for associating threads
  const { user } = useAuthStore();

  // Memoize callbacks to prevent useChat/useStream from resetting on re-renders
  const handleThreadId = useCallback((newThreadId: string) => {
    console.log("[ChatArea] onThreadId called:", { newThreadId, currentThreadId: threadId });
    // Only notify if we didn't have a threadId before (new conversation)
    if (newThreadId && !threadId) {
      console.log("[ChatArea] Thread created, notifying parent to update URL");
      onThreadChange?.(newThreadId);
    }
  }, [threadId, onThreadChange]);

  const chatErrorCallback = useCallback((error: ChatError) => {
    setChatError(error.message);
    // Log detailed context for debugging loop issues
    console.error("❌ Discussion Error:", {
      message: error.message,
      type: error.type,
      lastMessage: error.lastMessageContent,
      details: error.details
    });
    // Safety: clear running states
    setCurrentToolCalls([]);
  }, []);

  const chatEventCallback = useCallback((event: Record<string, unknown>) => {
    // Note: We access thread via closure, but for processEvent we might need thread to be stable or use a helper
    // Since 'thread' isn't available when defining options (circular), we handle processing in the effect or render phase
    // or we pass a processor function.
    // However, useChat options `onEvent` is called by the hook.

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
  }, [settings.showToolCalls]);

  const chatOptions = useMemo<UseChatOptions>(() => ({
    apiUrl: process.env.NEXT_PUBLIC_LANGGRAPH_API_URL || "http://localhost:2024",
    assistantId: "agent",
    threadId: threadId,
    userId: user?.id,
    onThreadId: handleThreadId,
    onError: chatErrorCallback,
    onEvent: chatEventCallback
  }), [threadId, user?.id, handleThreadId, chatErrorCallback, chatEventCallback]);

  const thread = useChat(chatOptions);

  // Handle live activity events separately since they need thread instance methods
  const lastProcessedEventRef = useRef<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (thread.lastEvent && thread.lastEvent !== lastProcessedEventRef.current) {
      const processedEvent = thread.processEvent(thread.lastEvent);
      if (processedEvent) {
        setLiveActivityEvents((prev) => [...prev, processedEvent]);
      }
      lastProcessedEventRef.current = thread.lastEvent;
    }
  }, [thread.lastEvent, thread.processEvent]);

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

  // Clear live state when loading completes to prevent stale data
  useEffect(() => {
    if (!thread.isLoading) {
      // Clear live tool calls and activity when response is complete
      setCurrentToolCalls([]);
      setLiveActivityEvents([]);
    }
  }, [thread.isLoading]);

  // Optimize message processing to prevent infinite loops
  const { processedMessages, newToolCallsMap } = useMemo(() => {
    if (thread.messages.length === 0) {
      return { processedMessages: [], newToolCallsMap: new Map() };
    }

    try {
      debugToolMessages(thread.messages);
      const { messages: combinedMessages, toolCallsMap: map } = combineToolMessages(thread.messages);

      const converted = combinedMessages
        .filter((msg: LangGraphMessage) => !isToolMessage(msg))
        .map((msg: LangGraphMessage, idx: number) => {
          const combinedToolCalls = getCombinedToolCallsFromMap(msg, map);
          const msgData = msg as unknown as Record<string, unknown>;
          const hasToolCalls =
            msgData.tool_calls &&
            Array.isArray(msgData.tool_calls) &&
            msgData.tool_calls.length > 0;
          const msgWithTimestamp = msg as LangGraphMessage & {
            created_at?: number;
          };

          const content =
            typeof msg.content === "string"
              ? msg.content
              : JSON.stringify(msg.content);

          return {
            id: msg.id || `temp-${idx}`,
            role: msg.type === "human" ? "user" : "assistant",
            content,
            timestamp: new Date(
              msgWithTimestamp.created_at
                ? new Date(msgWithTimestamp.created_at * 1000)
                : Date.now(),
            ),
            ...((combinedToolCalls && combinedToolCalls.length > 0) || hasToolCalls
              ? { _combinedToolCalls: combinedToolCalls || [] }
              : {}),
          };
        }) as Message[];

      return { processedMessages: converted, newToolCallsMap: map };
    } catch (error) {
      console.error("Error processing messages:", error);
      return { processedMessages: [], newToolCallsMap: new Map() };
    }
  }, [thread.messages]);

  // Update tool calls map when it changes
  useEffect(() => {
    if (newToolCallsMap.size > 0 && JSON.stringify(Array.from(newToolCallsMap.entries())) !== JSON.stringify(Array.from(toolCallsMap.entries()))) {
      setToolCallsMap(newToolCallsMap);
    }
  }, [newToolCallsMap, toolCallsMap]);

  // Update messages only when they actually change to break the loop
  // compare with current prop 'messages'
  useEffect(() => {
    if (processedMessages.length > 0) {
      // Simple length check first
      if (processedMessages.length !== messages.length) {
        console.log(`[ChatArea] Updating messages: count changed ${messages.length} -> ${processedMessages.length}`);
        onMessagesChange(processedMessages);
        setChatError(null);
        return;
      }

      // Deep check last message to see if it updated (streaming)
      const lastProcessed = processedMessages[processedMessages.length - 1];
      const lastCurrent = messages[messages.length - 1];

      if (
        lastProcessed.id !== lastCurrent.id ||
        lastProcessed.content !== lastCurrent.content ||
        JSON.stringify(lastProcessed._combinedToolCalls) !== JSON.stringify(lastCurrent._combinedToolCalls)
      ) {
        // console.log("[ChatArea] Updating messages: content changed");
        onMessagesChange(processedMessages);
        setChatError(null);
      }
    }
  }, [processedMessages, messages, onMessagesChange]);

  // Reset chat when threadId changes to null (New Conversation)
  useEffect(() => {
    if (!threadId) {
      onMessagesChange([]);
      setInput("");
      onAttachedFilesChange([]);
      setLiveActivityEvents([]);
      setCurrentToolCalls([]);
    }
  }, [threadId, onMessagesChange, onAttachedFilesChange]);

  const wordCount = input.trim().split(/\s+/).filter(Boolean).length;

  const handleSend = useCallback(async () => {
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

      // Update thread title if this is the first message
      if (thread.threadId && messages.length === 0) {
        try {
          const apiUrl = process.env.NEXT_PUBLIC_LANGGRAPH_API_URL || "http://localhost:2024";
          const threadsClient = createThreadsClient(apiUrl);
          await threadsClient.updateThread(thread.threadId, {
            title: generateConversationTitle(input)
          });
        } catch (error) {
          console.error("Failed to update thread title:", error);
        }
      }

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

  const handleRetry = useCallback((messageId: string, content: string) => {
    // Find the message index
    const messageIndex = messages.findIndex((msg) => msg.id === messageId);
    if (messageIndex === -1) return;

    const message = messages[messageIndex];

    if (message.role === "user") {
      // If retrying a user message, remove all messages after it and re-send
      const keptMessages = messages.slice(0, messageIndex);
      onMessagesChange(keptMessages);

      // Clear states and re-submit
      setLiveActivityEvents([]);
      hasFinalizeEventOccurredRef.current = false;
      setChatError(null);

      thread.submit({
        messages: [{ type: "human" as const, content }],
      });
    } else if (message.role === "assistant") {
      // If retrying an assistant message, find the preceding user message and retry from there
      let precedingUserIndex = -1;
      for (let i = messageIndex - 1; i >= 0; i--) {
        if (messages[i].role === "user") {
          precedingUserIndex = i;
          break;
        }
      }

      if (precedingUserIndex >= 0) {
        const userMessage = messages[precedingUserIndex];
        const keptMessages = messages.slice(0, precedingUserIndex);
        onMessagesChange(keptMessages);

        // Clear states and re-submit
        setLiveActivityEvents([]);
        hasFinalizeEventOccurredRef.current = false;
        setChatError(null);

        thread.submit({
          messages: [{ type: "human" as const, content: userMessage.content }],
        });
      }
    }
  }, [messages, onMessagesChange, thread]);

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

  const chatInput = useMemo(() => (
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
              radius="full"
              iconOnly={true}
              className="p-0 text-white"
              icon={
                isEditing ? (
                  <Pencil className="size-4" />
                ) : (
                  <Send className="size-4" />
                )
              }
            ></GradientButton>
          )}
        </div>
      </div>
    </div>
  ), [
    attachedFiles,
    onAttachedFilesChange,
    isEditing,
    input,
    handleSend,
    toggleShowToolCalls,
    settings.showToolCalls,
    isLightTheme,
    onSettingsOpen,
    wordCount,
    selectedModel,
    modelGroups,
    thread.isLoading,
    handleStop,
    fileInputRef
  ]);

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
              {chatInput}

              <div className="flex flex-wrap gap-2 justify-center">
                {suggestedPrompts.map((prompt, index) => (
                  <Badge
                    key={index}
                    variant="outline"
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
            {/* Error display */}
            {chatError && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
                <p className="text-sm font-medium">Error processing messages</p>
                <p className="text-xs mt-1 opacity-80">{chatError}</p>
              </div>
            )}

            {messages.map((message, index) => {
              const isLast = index === messages.length - 1;
              const isAssistantLoading = isLast && thread.isLoading && message.role === "assistant";

              // Check if previous message was also from assistant to group them
              const prevMessage = index > 0 ? messages[index - 1] : null;
              const nextMessage = index < messages.length - 1 ? messages[index + 1] : null;
              const isConsecutiveAssistant = message.role === "assistant" && prevMessage?.role === "assistant";
              const showAvatar = !isConsecutiveAssistant;

              // Show actions only on the last message in a consecutive assistant group
              const isLastInAssistantGroup = message.role === "assistant" &&
                (nextMessage?.role !== "assistant" || isLast);

              return (
                <div key={message.id} className="space-y-3">
                  <div
                    className={`flex items-start gap-3 ${message.role === "user" ? "justify-end" : ""
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
                      <div className="w-full space-y-3">
                        {/* Chat bubble with the actual content */}
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
                            showAvatar={showAvatar}
                            showActions={isLastInAssistantGroup}
                          />
                        )}

                        {/* Show completed tool calls from message history (not loading state) */}
                        {message._combinedToolCalls &&
                          message._combinedToolCalls.length > 0 &&
                          settings.showToolCalls &&
                          !isAssistantLoading && (
                            <div className="ml-14">
                              <ToolCallMessage
                                toolCalls={message._combinedToolCalls as ToolCall[]}
                                isLoading={false}
                              />
                            </div>
                          )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Loading placeholder - only shown when waiting for assistant response */}
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
                    {/* Show live tool calls and activity during loading */}
                    {(liveActivityEvents.length > 0 || currentToolCalls.length > 0) ? (
                      <div className="space-y-3">
                        {settings.showToolCalls && currentToolCalls.length > 0 && (
                          <ToolCallMessage
                            toolCalls={currentToolCalls}
                            isLoading={true}
                          />
                        )}
                        {settings.showActivityTimeline && liveActivityEvents.length > 0 && (
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
          <div className="max-w-4xl mx-auto">{chatInput}</div>
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
