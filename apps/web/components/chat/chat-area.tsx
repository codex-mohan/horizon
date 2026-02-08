"use client";

import type React from "react";
import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  memo,
} from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@workspace/ui/components/badge";
import { FileBadge } from "./file-badge";
import { ChatBubble } from "./chat-bubble";
import { ChatInput, type AttachedFile as ChatInputAttachedFile } from "./chat-input";
import { cn } from "@workspace/ui/lib/utils";
import type { Message, AttachedFile } from "./chat-interface";
import { ActivityTimeline } from "./activity-timeline";
import { ToolCallMessage, type ToolCall } from "./tool-call-message";

import { BranchSwitcher } from "./branch-switcher";
import {
  useChat,
  ProcessedEvent as ChatProcessedEvent,
  type UseChatOptions,
  type ChatError,
  type MessageMetadata,
} from "@/lib/chat";
import { useChatSettings } from "@/lib/stores/chat-settings";
import {
  combineToolMessages,
  getCombinedToolCallsFromMap,
  isToolMessage,
  isSystemMessage,
} from "@/lib/chat-utils";
import type { Message as LangGraphMessage } from "@langchain/langgraph-sdk";
import { useTheme } from "@/components/theme/theme-provider";
import { createThreadsClient } from "@/lib/threads";
import { generateConversationTitle } from "@/lib/title-utils";
import { useAuthStore } from "@/lib/stores/auth";
import { toast } from "sonner";

// ============================================================================
// STATIC DATA
// ============================================================================

const suggestedPrompts = [
  "Explain quantum computing in simple terms",
  "Write a Python function to sort an array",
  "What are the latest trends in AI?",
  "Help me plan a trip to Japan",
] as const;

// ============================================================================
// MESSAGE DISPLAY COMPONENT
// ============================================================================

interface MessageDisplayProps {
  message: Message;
  showAvatar: boolean;
  showActions: boolean;
  showToolCalls: boolean;
  isStreaming: boolean;
  onEdit: (id: string, content: string) => void;
  onRetry: (id: string, content: string) => void;
  onDelete: (id: string) => void;
  // Branching props - now using simple string types from SDK
  branchMetadata?: MessageMetadata | null;
  onBranchSelect?: (branch: string) => void;
}

// MessageDisplay Component Refactor for robust branching
const MessageDisplay = function MessageDisplay({
  message,
  showAvatar,
  showActions,
  showToolCalls,
  isStreaming,
  onEdit,
  onRetry,
  onDelete,
  branchMetadata,
  onBranchSelect,
}: MessageDisplayProps) {
  const noopHandler = useCallback(() => { }, []);

  // Construct effective metadata - DIRECT from SDK (No caching)
  const effectiveBranch = branchMetadata?.branch;
  const effectiveOptions = branchMetadata?.branchOptions;

  const handleBranchSelect = useCallback(
    (branch: string) => {
      onBranchSelect?.(branch);
    },
    [onBranchSelect]
  );




  return (
    <div className="space-y-3">
      <div
        className={cn(
          "flex items-start gap-3",
          message.role === "user" && "justify-end"
        )}
      >
        {message.role === "user" ? (
          <div className="flex flex-col items-end gap-1">
            <ChatBubble
              message={message}
              onEdit={onEdit}
              onRetry={onRetry}
              onFork={noopHandler}
              onSpeak={noopHandler}
              onSummarize={noopHandler}
              onShare={noopHandler}
              onDelete={onDelete}
              branch={effectiveBranch}
              branchOptions={effectiveOptions}
              onBranchSelect={handleBranchSelect}
            />
          </div>
        ) : (
          <div className="w-full space-y-3">
            <div className="flex flex-col gap-1">
              {/* Only show bubble if there is content or if it's not a pure tool-caller message */}
              {/* Actually, we should nearly always show the bubble if it's an AI message, 
                  unless it's PURELY tool calls and we want to hide those (but we usually show tool calls separately). 
                  If content is empty string, ChatBubble might process it as empty. */}

              {(message.content || !message._combinedToolCalls?.length) && (
                <ChatBubble
                  message={message}
                  onEdit={onEdit}
                  onRetry={onRetry}
                  onFork={noopHandler}
                  onSpeak={noopHandler}
                  onSummarize={noopHandler}
                  onShare={noopHandler}
                  onDelete={onDelete}
                  showAvatar={showAvatar}
                  showActions={showActions}
                  branch={effectiveBranch}
                  branchOptions={effectiveOptions}
                  onBranchSelect={handleBranchSelect}
                />
              )}
            </div>

            {message._combinedToolCalls &&
              message._combinedToolCalls.length > 0 &&
              showToolCalls &&
              !isStreaming && (
                <div className="ml-14">
                  <ToolCallMessage
                    toolCalls={message._combinedToolCalls as ToolCall[]}
                    isLoading={false}
                    branch={effectiveBranch}
                    branchOptions={effectiveOptions}
                    onBranchSelect={handleBranchSelect}
                  />
                </div>
              )}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// MAIN CHAT AREA
// ============================================================================

interface ChatAreaProps {
  messages: Message[];
  attachedFiles: AttachedFile[];
  onMessagesChange: (messages: Message[]) => void;
  onAttachedFilesChange: (files: AttachedFile[]) => void;
  onSettingsOpen: () => void;
  threadId?: string | null;
  onThreadChange?: (threadId: string | null) => void;
}

export function ChatArea({
  messages,
  attachedFiles,
  onMessagesChange,
  onAttachedFilesChange,
  onSettingsOpen,
  threadId,
  onThreadChange,
}: ChatAreaProps) {
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const lastMessageFingerprintRef = useRef("");
  const updateScheduledRef = useRef(false);
  const pendingMessagesRef = useRef<Message[] | null>(null);

  const { themeMode } = useTheme();
  const isLightTheme = themeMode === "light";
  const { settings, toggleShowToolCalls } = useChatSettings();
  const { user } = useAuthStore();

  const [chatError, setChatError] = useState<string | null>(null);
  const [liveActivityEvents, setLiveActivityEvents] = useState<ChatProcessedEvent[]>([]);
  const [currentToolCalls, setCurrentToolCalls] = useState<ToolCall[]>([]);
  const [hiddenMessageIds, setHiddenMessageIds] = useState<Set<string>>(new Set());

  // ---- Chat Hook ----
  const handleThreadId = useCallback(
    (newId: string) => {
      if (newId && !threadId) {
        onThreadChange?.(newId);
      }
    },
    [threadId, onThreadChange]
  );

  const handleError = useCallback((error: ChatError) => {
    setChatError(error.message);
  }, []);

  const handleEvent = useCallback(
    (event: Record<string, unknown>) => {
      // Process for tool calls display
      if (event.tools && settings.showToolCalls) {
        const toolsData = event.tools as Record<string, unknown>;
        if (Array.isArray(toolsData.tool_calls)) {
          const calls: ToolCall[] = toolsData.tool_calls.map(
            (tc: Record<string, unknown>, i: number) => ({
              id: `tool-${Date.now()}-${i}`,
              name: (tc.name as string) || "unknown",
              arguments: (tc.input as Record<string, unknown>) || {},
              status: "loading" as const,
            })
          );
          setCurrentToolCalls((prev) => [...prev, ...calls]);
        }
      }

      // Process for activity timeline
      if (event.event === "updates" && event.data) {
        const data = event.data as Record<string, unknown>;
        const nodeNames = Object.keys(data);
        if (nodeNames.length > 0) {
          const nodeName = nodeNames[0];
          const formattedName = nodeName
            .replace(/_/g, " ")
            .replace(/([A-Z])/g, " $1")
            .replace(/^./, (str) => str.toUpperCase())
            .trim();

          setLiveActivityEvents((prev) => [
            ...prev,
            {
              title: formattedName,
              data: "Processing...",
              icon: "sparkles",
              timestamp: Date.now(),
            },
          ]);
        }
      }
    },
    [settings.showToolCalls]
  );

  const chatOptions = useMemo<UseChatOptions>(
    () => ({
      apiUrl: process.env.NEXT_PUBLIC_LANGGRAPH_API_URL || "http://localhost:2024",
      assistantId: "agent",
      threadId: threadId ?? undefined,
      userId: user?.id,
      onThreadId: handleThreadId,
      onError: handleError,
      onEvent: handleEvent,
      fetchStateHistory: true,
    }),
    [threadId, user?.id, handleThreadId, handleError, handleEvent]
  );

  const chat = useChat(chatOptions);

  // ---- Process messages directly from SDK (no intermediate state) ----
  // This preserves object references for branch metadata lookup
  const processedMessages = useMemo(() => {
    if (chat.messages.length === 0) return [];

    // DEBUG: Deep inspection of branching state
    if (process.env.NODE_ENV === 'development') {
      console.log("[ChatArea] Branch Tree Debug:", {
        branchTree: chat.stream.experimental_branchTree,
        currentBranch: chat.stream.branch,
        message0: chat.messages[0],
        message0_meta: chat.getMessagesMetadata(chat.messages[0]),
      });
      // Dump the entire tree structure json to help debugging
      try {
        console.log("[ChatArea] Full Tree JSON:", JSON.stringify(chat.stream.experimental_branchTree, null, 2));
      } catch (e) { }
    }

    try {
      const { messages: combined, toolCallsMap } = combineToolMessages(chat.messages);

      return combined
        .filter((m: LangGraphMessage) => !isToolMessage(m) && !isSystemMessage(m))
        .map((m: LangGraphMessage, i: number) => {
          const tools = getCombinedToolCallsFromMap(m, toolCallsMap);
          return {
            id: m.id || `msg-${i}`,
            role: m.type === "human" ? "user" : "assistant",
            content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
            timestamp: new Date(),
            ...(tools?.length ? { _combinedToolCalls: tools } : {}),
            // Keep the ORIGINAL LangGraph message for branch metadata lookup
            _originalMessage: m,
          } as Message;
        });
    } catch (err) {
      console.error("Message processing error:", err);
      return [];
    }
  }, [chat.messages]);

  // Sync processed messages to parent (for other components that need message list)
  useEffect(() => {
    if (processedMessages.length > 0) {
      const fp = processedMessages.map((m) => `${m.id}:${m.content.length}`).join("|");
      if (fp !== lastMessageFingerprintRef.current) {
        lastMessageFingerprintRef.current = fp;
        onMessagesChange(processedMessages);
        setChatError(null);
      }
    }
  }, [processedMessages, onMessagesChange]);

  // Clear state when loading stops
  useEffect(() => {
    if (!chat.isLoading) {
      setCurrentToolCalls([]);
      setLiveActivityEvents([]);
    }
  }, [chat.isLoading]);

  // Reset on new conversation
  useEffect(() => {
    if (!threadId) {
      onMessagesChange([]);
      onAttachedFilesChange([]);
      setLiveActivityEvents([]);
      setCurrentToolCalls([]);
      lastMessageFingerprintRef.current = "";
    }
  }, [threadId, onMessagesChange, onAttachedFilesChange]);

  // Scroll to bottom
  useEffect(() => {
    chatContainerRef.current?.scrollTo({
      top: chatContainerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length]);

  // ---- Handlers ----
  const handleSubmit = useCallback(
    async (text: string, files: ChatInputAttachedFile[]) => {
      // Normal submit with optimistic update
      const newMessage = { type: "human" as const, content: text };
      chat.submit(
        { messages: [newMessage] },
        {
          optimisticValues: (prev) => ({
            ...prev,
            messages: [...(prev.messages ?? []), {
              id: `optimistic-${Date.now()}`,
              type: "human",
              content: text,
            } as unknown as LangGraphMessage],
          }),
        }
      );
      onAttachedFilesChange([]);

      // Update title on first message
      if (chat.threadId && chat.messages.filter(m => m.type !== "system").length === 0) {
        try {
          const client = createThreadsClient(
            process.env.NEXT_PUBLIC_LANGGRAPH_API_URL || "http://localhost:2024"
          );
          client.updateThread(chat.threadId, {
            title: generateConversationTitle(text),
          });
        } catch { }
      }
    },
    [messages, onAttachedFilesChange, chat]
  );

  const handleStop = useCallback(() => {
    chat.stop();
  }, [chat]);

  const handleEdit = useCallback(
    (id: string, content: string) => {
      // Find message in live stream for metadata lookup
      const messageIndex = chat.messages.findIndex((m) => m.id === id);
      const liveMessage = chat.messages[messageIndex];

      if (!liveMessage) {
        toast.error("Message not found in current session");
        return;
      }

      const metadata = chat.getMessagesMetadata(liveMessage);
      const parentCheckpoint = metadata?.firstSeenState?.parent_checkpoint;

      // If we have a parent checkpoint, use it to branch
      if (parentCheckpoint) {
        console.log("[ChatArea] Branching from checkpoint:", parentCheckpoint);
        chat.submit(
          { messages: [{ type: "human", content }] },
          { checkpoint: parentCheckpoint }
        );
      } else if (messageIndex === 0) {
        // Special case: Editing the very first message.
        // The parent checkpoint is effectively the "empty" beginning.
        // We typically can't "branch" the root in the same way without a root checkpoint ID,
        // but often the first message HAS a parent checkpoint (the empty one).
        // If it's missing, we might be in a weird state.
        // We'll try to just submit (which might append) but log a warning.
        //Ideally, we should start a new thread or find the root checkpoint. 
        console.warn("[ChatArea] No parent checkpoint for first message. This might append instead of branch.");

        // Attempt to create a NEW conversation if we can't branch the first message properly?
        // Or just let it append and hope the backend deduplicates? 
        // For now, let's treat it as a new submission if we can't find a checkpoint.
        // Actually, let's try passing the current threadId to force context?
        chat.submit(
          { messages: [{ type: "human", content }] }
          // No checkpoint available implies root.
        );
      } else {
        toast.error("Unable to edit: No checkpoint available");
        console.error("Missing checkpoint for message:", liveMessage);
      }
    },
    [chat]
  );

  const handleRetry = useCallback(
    (id: string, _content: string) => {
      // Find message in live stream for metadata lookup
      const liveMessage = chat.messages.find((m) => m.id === id);
      if (!liveMessage) {
        toast.error("Message not found in current session");
        return;
      }

      const metadata = chat.getMessagesMetadata(liveMessage);
      const parentCheckpoint = metadata?.firstSeenState?.parent_checkpoint;

      if (parentCheckpoint) {
        if (liveMessage.type === "human") {
          // For user messages: resubmit the same content from parent checkpoint
          const content = typeof liveMessage.content === 'string'
            ? liveMessage.content
            : JSON.stringify(liveMessage.content);
          chat.submit(
            { messages: [{ type: "human", content }] },
            { checkpoint: parentCheckpoint }
          );
        } else {
          // For assistant messages: regenerate by submitting undefined
          chat.submit(undefined, { checkpoint: parentCheckpoint });
        }
      } else {
        // Fallback for retry if no checkpoint (rare)
        toast.error("Unable to retry: No checkpoint available");
      }
    },
    [chat]
  );

  // Handler for switching between message branches
  const handleBranchSelect = useCallback(
    (branch: string) => {
      chat.setBranch(branch);
    },
    [chat]
  );

  const handleDelete = useCallback(
    (id: string) => {
      setHiddenMessageIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
      // Also notify parent for consistency, though we don't render from it
      onMessagesChange(processedMessages.filter((m) => m.id !== id));
    },
    [processedMessages, onMessagesChange]
  );

  const handleRemoveFile = useCallback(
    (fileId: string) => {
      onAttachedFilesChange(attachedFiles.filter((f) => f.id !== fileId));
    },
    [attachedFiles, onAttachedFilesChange]
  );

  // ---- Render ----
  const hasMessages = chat.messages.filter(m => m.type !== "system").length > 0;
  const showLoading =
    chat.isLoading &&
    (chat.messages.length === 0 || chat.messages[chat.messages.length - 1]?.type === "human");

  return (
    <div className="flex-1 flex flex-col relative z-10">
      {/* Messages Area */}
      <div
        ref={chatContainerRef}
        className={cn(
          "flex-1 overflow-y-auto custom-scrollbar",
          hasMessages ? "p-4" : "flex items-center justify-center"
        )}
      >
        {!hasMessages ? (
          /* Welcome Screen */
          <div className="max-w-3xl w-full space-y-8 animate-slide-up">
            <div className="text-center space-y-4">
              <div className="text-6xl font-bold bg-linear-to-r from-(--gradient-from) via-(--gradient-via) to-(--gradient-to) bg-clip-text text-transparent animate-pulse font-display tracking-tight">
                Horizon
              </div>
              <div className="text-sm text-muted-foreground">by Singularity.ai</div>
              <p className="text-xl text-muted-foreground">
                Experience the event horizon of AI conversations
              </p>
            </div>

            <div className="glass-strong rounded-xl p-4 space-y-3">
              {/* File Badges Area */}
              {attachedFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {attachedFiles.map((file) => (
                    <FileBadge
                      key={file.id}
                      name={file.name}
                      size={file.size}
                      type={file.type}
                      url={file.url}
                      onRemove={() => handleRemoveFile(file.id)}
                    />
                  ))}
                </div>
              )}

              <ChatInput
                onSubmit={handleSubmit}
                onStop={handleStop}
                isLoading={chat.isLoading}
                onSettingsOpen={onSettingsOpen}
                showToolCalls={settings.showToolCalls}
                onToggleToolCalls={toggleShowToolCalls}
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
                  onClick={() => handleSubmit(prompt, [])}
                >
                  {prompt}
                </Badge>
              ))}
            </div>
          </div>
        ) : (
          /* Messages List */
          <div className="max-w-4xl mx-auto w-full space-y-6">
            {chatError && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
                <p className="text-sm font-medium">Error</p>
                <p className="text-xs opacity-80">{chatError}</p>
              </div>
            )}

            {/* Messages List - Iterating directly over stream messages for correct branching */}
            {chat.messages.map((msg, i) => {
              // Skip system messages.
              // Note: We do NOT skip tool messages here if we want to debug them, but normally we hide them 
              // because they are attached to the AI message via getToolCalls.
              if (msg.type === "system" || msg.type === "tool") return null;
              if (msg.id && hiddenMessageIds.has(msg.id)) return null;

              const isLast = i === chat.messages.length - 1;
              const prev = i > 0 ? chat.messages[i - 1] : null;

              // Get metadata and tool calls using SDK methods
              // Get metadata and tool calls using SDK methods
              let branchMetadata = chat.getMessagesMetadata(msg);
              const toolCalls = chat.getToolCalls(msg);

              // Branching logic removed as per request


              if (process.env.NODE_ENV === 'development' && branchMetadata?.branchOptions) {
                console.log(`[ChatArea] Msg ${i} (${msg.id?.slice(0, 8)}):`, branchMetadata);
              }

              // Adapt LangGraph message to UI Message interface on the fly
              const uiMessage: Message = {
                id: msg.id || `msg-${i}`,
                role: msg.type === "human" ? "user" : "assistant",
                content: typeof msg.content === "string"
                  ? msg.content
                  : Array.isArray(msg.content)
                    ? msg.content.map(c => (c as any).text || "").join("")
                    : JSON.stringify(msg.content),
                timestamp: new Date(), // Timestamp not available in SDK message
                _originalMessage: msg,
                // Map SDK tool calls to our UI format
                _combinedToolCalls: toolCalls.map(tc => ({
                  id: tc.call.id || "",
                  name: tc.call.name,
                  arguments: tc.call.args,
                  result: tc.result?.content as string,
                  status: tc.state === "pending" ? "loading" : tc.state === "error" ? "error" : "success"
                }))
              };

              // Calculate if the bubble should show the avatar
              // Show avatar if:
              // 1. It's an assistant message
              // 2. AND (it's the first message OR the previous message was NOT from assistant)
              const showAvatar = uiMessage.role === "assistant" && (i === 0 || prev?.type === "human");

              // Fix for "Only 2 messages shown":
              // This was likely caused by the previous logic filtering or strict content checks.
              // With the logic above, we iterate ALL messages and only filter system/tool/hidden.

              return (
                <MessageDisplay
                  key={msg.id || i}
                  message={uiMessage}
                  showAvatar={showAvatar}
                  showActions={uiMessage.role === "assistant"}
                  showToolCalls={settings.showToolCalls}
                  isStreaming={isLast && chat.isLoading && uiMessage.role === "assistant"}
                  onEdit={handleEdit}
                  onRetry={handleRetry}
                  onDelete={handleDelete}
                  branchMetadata={branchMetadata}
                  onBranchSelect={handleBranchSelect}
                />
              );
            })}

            {/* Loading State */}
            {showLoading && (
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "rounded-xl p-3 w-full min-h-[56px]",
                    isLightTheme ? "glass-strong bg-white/60" : "glass bg-card/60"
                  )}
                >
                  {currentToolCalls.length > 0 || liveActivityEvents.length > 0 ? (
                    <div className="space-y-3">
                      {settings.showToolCalls && currentToolCalls.length > 0 && (
                        <ToolCallMessage toolCalls={currentToolCalls} isLoading />
                      )}
                      {settings.showActivityTimeline && liveActivityEvents.length > 0 && (
                        <ActivityTimeline processedEvents={liveActivityEvents} isLoading />
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Loader2
                        className={cn(
                          "size-5 animate-spin",
                          isLightTheme ? "text-slate-600" : "text-primary"
                        )}
                      />
                      <span className={isLightTheme ? "text-slate-600" : "text-foreground"}>
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

      {/* Bottom Input (when messages exist) */}
      {hasMessages && (
        <div className="border-t border-border p-4">
          <div className="max-w-4xl mx-auto glass-strong rounded-xl p-4">
            {/* File Badges Area */}
            {attachedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {attachedFiles.map((file) => (
                  <FileBadge
                    key={file.id}
                    name={file.name}
                    size={file.size}
                    type={file.type}
                    url={file.url}
                    onRemove={() => handleRemoveFile(file.id)}
                  />
                ))}
              </div>
            )}

            <ChatInput
              onSubmit={handleSubmit}
              onStop={handleStop}
              isLoading={chat.isLoading}
              onSettingsOpen={onSettingsOpen}
              showToolCalls={settings.showToolCalls}
              onToggleToolCalls={toggleShowToolCalls}
              isLightTheme={isLightTheme}
              attachedFiles={attachedFiles}
              onAttachedFilesChange={onAttachedFilesChange}
            />
          </div>
        </div>
      )}
    </div>
  );
}
