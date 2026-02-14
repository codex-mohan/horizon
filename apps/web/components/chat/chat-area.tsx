"use client";

import type { Message as LangGraphMessage } from "@langchain/langgraph-sdk";
import { cn } from "@workspace/ui/lib/utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useTheme } from "@/components/theme/theme-provider";
import {
  type ChatError,
  type ProcessedEvent as ChatProcessedEvent,
  type UseChatOptions,
  useChat,
} from "@/lib/chat";
import { useAuthStore } from "@/lib/stores/auth";
import { useChatSettings } from "@/lib/stores/chat-settings";
import { createThreadsClient } from "@/lib/threads";
import { generateConversationTitle } from "@/lib/title-utils";
import { getToolUIConfig } from "@/lib/tool-config";
import { ChatEmptyState } from "./chat-empty-state";
import type { AttachedFile as ChatInputAttachedFile } from "./chat-input";
import { ChatInputArea } from "./chat-input-area";
import type { AttachedFile, Message } from "./chat-interface";
import { ChatLoadingIndicator } from "./chat-loading-indicator";
import { MessageGroup } from "./message-group";
// Extracted components
import { groupMessages } from "./message-grouping";
import type { ToolCall } from "./tool-call-message";

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
  const [liveActivityEvents, setLiveActivityEvents] = useState<ChatProcessedEvent[]>([]);
  const [currentToolCalls, setCurrentToolCalls] = useState<ToolCall[]>([]);
  const [hiddenMessageIds, setHiddenMessageIds] = useState<Set<string>>(new Set());

  // Thread ID handler
  const handleThreadId = useCallback(
    (newId: string) => {
      if (newId && !threadId) {
        onThreadChange?.(newId);
      }
    },
    [threadId, onThreadChange]
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
            }
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
    [settings.showToolCalls]
  );

  // Chat options
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
  }, []);

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
        const confirmMsg =
          "This will replace all messages after this point. This action cannot be undone.";
        if (!window.confirm(confirmMsg)) {
          return;
        }
      }

      if (parentCheckpoint) {
        chat.submit({ messages: [{ type: "human", content }] }, { checkpoint: parentCheckpoint });
        if (isLastGroup) {
          toast.success("Created new branch from edited message");
        } else {
          toast.success("Replacing conversation from edited message");
        }
      } else if (messageIndex === 0) {
        chat.submit({ messages: [{ type: "human", content }] });
        toast.success(isLastGroup ? "Message updated" : "Replacing conversation");
      } else {
        toast.error("Unable to edit: No checkpoint available");
        console.error("Missing checkpoint for message:", liveMessage);
      }
    },
    [chat]
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
        const confirmMsg =
          "This will replace all messages after this point. This action cannot be undone.";
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
    [chat]
  );

  const handleBranchChange = useCallback(
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
      onMessagesChange(messages.filter((m) => m.id !== id));
    },
    [messages, onMessagesChange]
  );

  const handleSubmit = useCallback(
    async (text: string, _files: ChatInputAttachedFile[]) => {
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

      if (chat.threadId && chat.messages.filter((m) => m.type !== "system").length === 0) {
        try {
          const client = createThreadsClient(
            process.env.NEXT_PUBLIC_LANGGRAPH_API_URL || "http://localhost:2024"
          );
          client.updateThread(chat.threadId, {
            title: generateConversationTitle(text),
          });
        } catch {}
      }
    },
    [chat, onAttachedFilesChange]
  );

  const handleStop = useCallback(() => {
    chat.stop();
  }, [chat]);

  const handleRemoveFile = useCallback(
    (fileId: string) => {
      onAttachedFilesChange(attachedFiles.filter((f) => f.id !== fileId));
    },
    [attachedFiles, onAttachedFilesChange]
  );

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const hasMessages = messageGroups.length > 0;
  const showLoading =
    chat.isLoading && (chat.messages.length === 0 || chat.messages.at(-1)?.type === "human");

  return (
    <div className="relative z-10 flex flex-1 flex-col">
      {/* Messages Container */}
      <div
        className={cn(
          "custom-scrollbar flex-1 overflow-y-auto",
          hasMessages ? "p-4" : "flex items-center justify-center"
        )}
        ref={chatContainerRef}
      >
        {hasMessages ? (
          // Messages List - Render by Groups
          <div className="mx-auto w-full max-w-4xl space-y-6">
            {/* Error Display */}
            {chatError && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
                <p className="font-medium text-sm">Error</p>
                <p className="text-xs opacity-80">{chatError}</p>
              </div>
            )}

            {/* Message Groups */}
            {messageGroups.map((group, groupIdx) => {
              const isLastGroup = groupIdx === messageGroups.length - 1;

              return (
                <MessageGroup
                  assistantMessage={group.assistantMessage}
                  branch={group.branch}
                  branchOptions={group.branchOptions}
                  id={group.id}
                  isLastGroup={isLastGroup}
                  isLoading={chat.isLoading}
                  key={group.id}
                  onBranchChange={handleBranchChange}
                  onDelete={handleDelete}
                  onEdit={handleEdit}
                  onRegenerate={handleRegenerate}
                  showToolCalls={settings.showToolCalls}
                  toolCalls={group.toolCalls}
                  userMessage={group.userMessage}
                />
              );
            })}

            {/* Loading Indicator */}
            {showLoading && (
              <ChatLoadingIndicator
                currentToolCalls={currentToolCalls}
                isLightTheme={isLightTheme}
                liveActivityEvents={liveActivityEvents}
                showActivityTimeline={settings.showActivityTimeline}
                showToolCalls={settings.showToolCalls}
              />
            )}
          </div>
        ) : (
          <ChatEmptyState
            attachedFiles={attachedFiles}
            isLightTheme={isLightTheme}
            isLoading={chat.isLoading}
            onAttachedFilesChange={onAttachedFilesChange}
            onRemoveFile={handleRemoveFile}
            onSettingsOpen={onSettingsOpen}
            onStop={handleStop}
            onSubmit={handleSubmit}
            onToggleToolCalls={toggleShowToolCalls}
            showToolCalls={settings.showToolCalls}
          />
        )}
      </div>

      {/* Input Area */}
      {hasMessages && (
        <ChatInputArea
          attachedFiles={attachedFiles}
          isLightTheme={isLightTheme}
          isLoading={chat.isLoading}
          onAttachedFilesChange={onAttachedFilesChange}
          onRemoveFile={handleRemoveFile}
          onSettingsOpen={onSettingsOpen}
          onStop={handleStop}
          onSubmit={handleSubmit}
          onToggleToolCalls={toggleShowToolCalls}
          showToolCalls={settings.showToolCalls}
        />
      )}
    </div>
  );
}
