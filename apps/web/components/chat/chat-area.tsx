"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { Loader2, Pencil, RefreshCw, Copy, GitBranch } from "lucide-react";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip";
import { FileBadge } from "./file-badge";
import { ChatBubble } from "./chat-bubble";
import {
  ChatInput,
  type AttachedFile as ChatInputAttachedFile,
} from "./chat-input";
import { cn } from "@workspace/ui/lib/utils";
import type { Message, AttachedFile } from "./chat-interface";
import { ActivityTimeline } from "./activity-timeline";
import { ToolCallMessage, type ToolCall } from "./tool-call-message";
import { GenerativeUIRenderer } from "./generative-ui-renderer";
import { hasCustomUI, getToolUIConfig } from "@/lib/tool-config";
import {
  useChat,
  ProcessedEvent as ChatProcessedEvent,
  type UseChatOptions,
  type ChatError,
} from "@/lib/chat";
import { useChatSettings } from "@/lib/stores/chat-settings";
import { combineToolMessages } from "@/lib/chat-utils";
import type {
  AIMessage,
  Message as LangGraphMessage,
} from "@langchain/langgraph-sdk";
import { useTheme } from "@/components/theme/theme-provider";
import { createThreadsClient } from "@/lib/threads";
import { generateConversationTitle } from "@/lib/title-utils";
import { useAuthStore } from "@/lib/stores/auth";
import { getReasoningFromMessage } from "@/lib/reasoning-utils";
import { toast } from "sonner";
import { BranchSwitcher } from "./branch-switcher";

const suggestedPrompts = [
  "Explain quantum computing in simple terms",
  "Write a Python function to sort an array",
  "What are the latest trends in AI?",
  "Help me plan a trip to Japan",
] as const;

// ============================================================================
// MESSAGE GROUPING TYPES
// ============================================================================

interface MessageGroup {
  id: string;
  userMessage: Message | null;
  assistantMessage: Message | null;
  toolCalls: ToolCall[];
  isLastGroup: boolean;
  branch?: string;
  branchOptions?: string[];
}

// ============================================================================
// MESSAGE GROUPING LOGIC
// ============================================================================

function groupMessages(
  messages: LangGraphMessage[],
  chat: ReturnType<typeof useChat>,
  hiddenMessageIds: Set<string>,
): MessageGroup[] {
  if (messages.length === 0) return [];

  const groups: MessageGroup[] = [];
  let currentGroup: MessageGroup | null = null;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    // Skip system and hidden messages
    if (msg.type === "system" || msg.type === "tool") continue;
    if (msg.id && hiddenMessageIds.has(msg.id)) continue;

    // Get metadata
    const metadata = chat.getMessagesMetadata(msg);
    const reasoning = getReasoningFromMessage(msg as AIMessage);

    // Extract content
    const content =
      typeof msg.content === "string"
        ? msg.content
        : Array.isArray(msg.content)
          ? msg.content.map((c: any) => c.text || "").join("")
          : JSON.stringify(msg.content);

    if (msg.type === "human") {
      // Start a new group for user messages
      if (currentGroup) {
        groups.push(currentGroup);
      }

      currentGroup = {
        id: `group-${msg.id || i}`,
        userMessage: {
          id: msg.id || `msg-${i}`,
          role: "user",
          content,
          timestamp: new Date(),
          _originalMessage: msg,
        },
        assistantMessage: null,
        toolCalls: [],
        isLastGroup: false,
        branch: metadata?.branch,
        branchOptions: metadata?.branchOptions,
      };
    } else if (msg.type === "ai" && currentGroup) {
      // Get tool calls for this AI message
      const toolCalls = chat.getToolCalls(msg as any);
      const toolCallsWithUI: ToolCall[] = toolCalls.map((tc) => {
        const toolConfig = getToolUIConfig(tc.call.name);
        return {
          id: tc.call.id || "",
          name: tc.call.name,
          arguments: tc.call.args,
          result: tc.result?.content as string,
          status: (tc.state === "pending"
            ? "loading"
            : tc.state === "error"
              ? "error"
              : "success") as "loading" | "error" | "success" | "completed",
          namespace: toolConfig.namespace,
        };
      });

      currentGroup.assistantMessage = {
        id: msg.id || `msg-${i}`,
        role: "assistant",
        content,
        timestamp: new Date(),
        _originalMessage: msg,
        reasoning,
        _combinedToolCalls: toolCallsWithUI,
      };
      currentGroup.toolCalls = toolCallsWithUI;

      // Update branch metadata from assistant message (more reliable than user message)
      if (metadata?.branch !== undefined) {
        currentGroup.branch = metadata.branch;
      }
      if (metadata?.branchOptions !== undefined) {
        currentGroup.branchOptions = metadata.branchOptions;
      }
    }
  }

  // Push the last group
  if (currentGroup) {
    groups.push(currentGroup);
  }

  // Mark the last group
  if (groups.length > 0) {
    groups[groups.length - 1].isLastGroup = true;
  }

  return groups;
}

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

  const { themeMode } = useTheme();
  const isLightTheme = themeMode === "light";
  const { settings, toggleShowToolCalls } = useChatSettings();
  const { user } = useAuthStore();

  const [chatError, setChatError] = useState<string | null>(null);
  const [liveActivityEvents, setLiveActivityEvents] = useState<
    ChatProcessedEvent[]
  >([]);
  const [currentToolCalls, setCurrentToolCalls] = useState<ToolCall[]>([]);
  const [hiddenMessageIds, setHiddenMessageIds] = useState<Set<string>>(
    new Set(),
  );

  // Thread ID handler
  const handleThreadId = useCallback(
    (newId: string) => {
      if (newId && !threadId) {
        onThreadChange?.(newId);
      }
    },
    [threadId, onThreadChange],
  );

  // Error handler
  const handleError = useCallback((error: ChatError) => {
    setChatError(error.message);
  }, []);

  // Event handler for tool calls and activity
  const handleEvent = useCallback(
    (event: Record<string, unknown>) => {
      if (event.tools && settings.showToolCalls) {
        const toolsData = event.tools as Record<string, unknown>;
        if (Array.isArray(toolsData.tool_calls)) {
          const calls: ToolCall[] = toolsData.tool_calls.map(
            (tc: Record<string, unknown>, i: number) => {
              const toolName = (tc.name as string) || "unknown";
              const toolConfig = getToolUIConfig(toolName);
              return {
                id: `tool-${Date.now()}-${i}`,
                name: toolName,
                arguments: (tc.input as Record<string, unknown>) || {},
                status: "loading" as const,
                namespace: toolConfig.namespace,
              };
            },
          );
          setCurrentToolCalls((prev) => [...prev, ...calls]);
        }
      }

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
    [settings.showToolCalls],
  );

  // Chat options
  const chatOptions = useMemo<UseChatOptions>(
    () => ({
      apiUrl:
        process.env.NEXT_PUBLIC_LANGGRAPH_API_URL || "http://localhost:2024",
      assistantId: "agent",
      threadId: threadId ?? undefined,
      userId: user?.id,
      onThreadId: handleThreadId,
      onError: handleError,
      onEvent: handleEvent,
      fetchStateHistory: true,
    }),
    [threadId, user?.id, handleThreadId, handleError, handleEvent],
  );

  // Initialize chat hook
  const chat = useChat(chatOptions);

  // Group messages
  const messageGroups = useMemo(() => {
    return groupMessages(chat.messages, chat, hiddenMessageIds);
  }, [chat.messages, chat, hiddenMessageIds]);

  // Clear loading states when done
  useEffect(() => {
    if (!chat.isLoading) {
      setCurrentToolCalls([]);
      setLiveActivityEvents([]);
    }
  }, [chat.isLoading]);

  // Reset on thread change
  useEffect(() => {
    if (!threadId) {
      onMessagesChange([]);
      onAttachedFilesChange([]);
      setLiveActivityEvents([]);
      setCurrentToolCalls([]);
      setHiddenMessageIds(new Set());
    }
  }, [threadId, onMessagesChange, onAttachedFilesChange]);

  // Auto-scroll to bottom
  useEffect(() => {
    chatContainerRef.current?.scrollTo({
      top: chatContainerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messageGroups.length]);

  // ============================================================================
  // MESSAGE ACTIONS
  // ============================================================================

  const handleEdit = useCallback(
    (messageId: string, content: string, isLastGroup: boolean) => {
      const messageIndex = chat.messages.findIndex((m) => m.id === messageId);
      const liveMessage = chat.messages[messageIndex];

      if (!liveMessage) {
        toast.error("Message not found in current session");
        return;
      }

      const metadata = chat.getMessagesMetadata(liveMessage);
      const parentCheckpoint = metadata?.firstSeenState?.parent_checkpoint;

      if (!isLastGroup) {
        const confirmMsg = `This will replace all messages after this point. This action cannot be undone.`;
        if (!window.confirm(confirmMsg)) {
          return;
        }
      }

      if (parentCheckpoint) {
        chat.submit(
          { messages: [{ type: "human", content }] },
          { checkpoint: parentCheckpoint },
        );
        if (isLastGroup) {
          toast.success("Created new branch from edited message");
        } else {
          toast.success("Replacing conversation from edited message");
        }
      } else if (messageIndex === 0) {
        chat.submit({ messages: [{ type: "human", content }] });
        toast.success(
          isLastGroup ? "Message updated" : "Replacing conversation",
        );
      } else {
        toast.error("Unable to edit: No checkpoint available");
        console.error("Missing checkpoint for message:", liveMessage);
      }
    },
    [chat],
  );

  const handleRegenerate = useCallback(
    (messageId: string, isLastGroup: boolean) => {
      const liveMessage = chat.messages.find((m) => m.id === messageId);
      if (!liveMessage) {
        toast.error("Message not found in current session");
        return;
      }

      const metadata = chat.getMessagesMetadata(liveMessage);
      const parentCheckpoint = metadata?.firstSeenState?.parent_checkpoint;

      if (!isLastGroup) {
        const confirmMsg = `This will replace all messages after this point. This action cannot be undone.`;
        if (!window.confirm(confirmMsg)) {
          return;
        }
      }

      if (parentCheckpoint) {
        chat.submit(undefined, { checkpoint: parentCheckpoint });
        if (isLastGroup) {
          toast.success("Regenerating response in new branch");
        } else {
          toast.success("Replacing conversation from this point");
        }
      } else {
        toast.error("Unable to regenerate: No checkpoint available");
      }
    },
    [chat],
  );

  const handleBranchChange = useCallback(
    (branch: string) => {
      chat.setBranch(branch);
    },
    [chat],
  );

  const handleDelete = useCallback(
    (id: string) => {
      setHiddenMessageIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
      onMessagesChange(messages.filter((m) => m.id !== id));
    },
    [messages, onMessagesChange],
  );

  const handleSubmit = useCallback(
    async (text: string, files: ChatInputAttachedFile[]) => {
      const newMessage = { type: "human" as const, content: text };

      const submitOptions: Record<string, any> = {
        optimisticValues: (prev: any) => ({
          ...prev,
          messages: [
            ...(prev.messages ?? []),
            {
              id: `optimistic-${Date.now()}`,
              type: "human",
              content: text,
            } as unknown as LangGraphMessage,
          ],
        }),
      };

      chat.submit({ messages: [newMessage] }, submitOptions);
      onAttachedFilesChange([]);

      if (
        chat.threadId &&
        chat.messages.filter((m) => m.type !== "system").length === 0
      ) {
        try {
          const client = createThreadsClient(
            process.env.NEXT_PUBLIC_LANGGRAPH_API_URL ||
              "http://localhost:2024",
          );
          client.updateThread(chat.threadId, {
            title: generateConversationTitle(text),
          });
        } catch {}
      }
    },
    [chat, onAttachedFilesChange],
  );

  const handleStop = useCallback(() => {
    chat.stop();
  }, [chat]);

  const handleRemoveFile = useCallback(
    (fileId: string) => {
      onAttachedFilesChange(attachedFiles.filter((f) => f.id !== fileId));
    },
    [attachedFiles, onAttachedFilesChange],
  );

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const hasMessages = messageGroups.length > 0;
  const showLoading =
    chat.isLoading &&
    (chat.messages.length === 0 ||
      chat.messages[chat.messages.length - 1]?.type === "human");

  return (
    <div className="flex-1 flex flex-col relative z-10">
      {/* Messages Container */}
      <div
        ref={chatContainerRef}
        className={cn(
          "flex-1 overflow-y-auto custom-scrollbar",
          hasMessages ? "p-4" : "flex items-center justify-center",
        )}
      >
        {!hasMessages ? (
          // Empty State
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
          // Messages List - Render by Groups
          <div className="max-w-4xl mx-auto w-full space-y-6">
            {/* Error Display */}
            {chatError && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
                <p className="text-sm font-medium">Error</p>
                <p className="text-xs opacity-80">{chatError}</p>
              </div>
            )}

            {/* Message Groups */}
            {messageGroups.map((group, groupIdx) => {
              const isLastGroup = groupIdx === messageGroups.length - 1;

              return (
                <div key={group.id} className="space-y-3">
                  {/* User Message */}
                  {group.userMessage && (
                    <ChatBubble
                      message={group.userMessage}
                      showAvatar={false}
                      showActions={true}
                      isLoading={chat.isLoading}
                      isLastInGroup={true}
                      isLastGroup={isLastGroup}
                      isLastMessage={isLastGroup}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      branch={group.branch}
                      branchOptions={group.branchOptions}
                    />
                  )}

                  {/* Assistant Group */}
                  {group.assistantMessage && (
                    <div className="space-y-2 group">
                      {/* Assistant Message (no actions inside bubble) */}
                      <ChatBubble
                        message={group.assistantMessage}
                        showAvatar={true}
                        showActions={false} // Actions are outside the bubble
                        isLoading={chat.isLoading}
                        isLastInGroup={true}
                        isLastGroup={isLastGroup}
                        isLastMessage={isLastGroup}
                      />

                      {/* Tool Calls */}
                      {group.toolCalls.length > 0 && settings.showToolCalls && (
                        <div className="ml-14 space-y-2">
                          {/* Custom Tool UIs */}
                          <GenerativeUIRenderer
                            toolCalls={group.toolCalls.filter((tc) =>
                              hasCustomUI(tc.name),
                            )}
                            isLoading={group.toolCalls.some(
                              (tc) => tc.status === "loading",
                            )}
                          />

                          {/* Standard Tool Display */}
                          {group.toolCalls.some(
                            (tc) => !hasCustomUI(tc.name),
                          ) && (
                            <ToolCallMessage
                              toolCalls={group.toolCalls.filter(
                                (tc) => !hasCustomUI(tc.name),
                              )}
                              isLoading={group.toolCalls.some(
                                (tc) => tc.status === "loading",
                              )}
                            />
                          )}
                        </div>
                      )}

                      {/* Actions Bar - OUTSIDE the bubble, at group level */}
                      <div className="ml-14 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        {/* Branch Switcher - Only on last group */}
                        {isLastGroup &&
                          group.branchOptions &&
                          group.branchOptions.length > 1 && (
                            <BranchSwitcher
                              branch={group.branch}
                              branchOptions={group.branchOptions}
                              onSelect={handleBranchChange}
                            />
                          )}

                        {/* Regenerate Button */}
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() =>
                                  handleRegenerate(
                                    group.assistantMessage!.id,
                                    isLastGroup,
                                  )
                                }
                                disabled={chat.isLoading}
                                className="size-8 bg-background/50 hover:bg-background/80 transition-all duration-200 hover:scale-110"
                              >
                                <RefreshCw
                                  className={cn(
                                    "size-4 text-foreground",
                                    chat.isLoading && "animate-spin",
                                  )}
                                />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>
                                {isLastGroup
                                  ? "Regenerate response (creates new branch)"
                                  : "Regenerate response (replaces conversation from here)"}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        {/* Copy Button */}
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() =>
                                  navigator.clipboard.writeText(
                                    group.assistantMessage!.content,
                                  )
                                }
                                className="size-8 bg-background/50 hover:bg-background/80 transition-all duration-200 hover:scale-110"
                              >
                                <Copy className="size-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Copy message</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Loading Indicator */}
            {showLoading && (
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "rounded-xl p-3 w-full min-h-[56px]",
                    isLightTheme
                      ? "glass-strong bg-white/60"
                      : "glass bg-card/60",
                  )}
                >
                  {currentToolCalls.length > 0 ||
                  liveActivityEvents.length > 0 ? (
                    <div className="space-y-3">
                      {settings.showToolCalls &&
                        currentToolCalls.length > 0 && (
                          <>
                            <GenerativeUIRenderer
                              toolCalls={currentToolCalls.filter((tc) =>
                                hasCustomUI(tc.name),
                              )}
                              isLoading
                            />
                            {currentToolCalls.some(
                              (tc) => !hasCustomUI(tc.name),
                            ) && (
                              <ToolCallMessage
                                toolCalls={currentToolCalls.filter(
                                  (tc) => !hasCustomUI(tc.name),
                                )}
                                isLoading
                              />
                            )}
                          </>
                        )}
                      {settings.showActivityTimeline &&
                        liveActivityEvents.length > 0 && (
                          <ActivityTimeline
                            processedEvents={liveActivityEvents}
                            isLoading
                          />
                        )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Loader2
                        className={cn(
                          "size-5 animate-spin",
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

      {/* Input Area */}
      {hasMessages && (
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
