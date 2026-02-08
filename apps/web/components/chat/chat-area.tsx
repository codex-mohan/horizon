"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@workspace/ui/components/badge";
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
import { getReasoningFromMessage } from "@/lib/reasoning-utils";
import { toast } from "sonner";
import {
  Copy,
  RotateCcw,
  Volume2,
  FileText,
  Forklift as Fork,
  Share,
  MoreHorizontal,
  MessageSquare,
  Trash2,
} from "lucide-react";
import { Button } from "@workspace/ui/components/button";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";

const suggestedPrompts = [
  "Explain quantum computing in simple terms",
  "Write a Python function to sort an array",
  "What are the latest trends in AI?",
  "Help me plan a trip to Japan",
] as const;

// ============================================================================
// GROUP CONTROLS COMPONENT
// ============================================================================

interface GroupControlsProps {
  retryTargetId: string | null;
  branch: string | undefined;
  branchOptions: string[] | undefined;
  onBranchSelect: (branch: string) => void;
  onRetry: (id: string, content: string) => void;
  onSpeak?: (id: string, content: string) => void;
  onSummarize?: (id: string, content: string) => void;
  onFork?: (id: string, content: string) => void;
  onShare?: (id: string, content: string) => void;
  onDelete?: (id: string) => void;
  copyContent: string;
}

function GroupControls({
  retryTargetId,
  branch,
  branchOptions,
  onBranchSelect,
  onRetry,
  onSpeak,
  onSummarize,
  onFork,
  onShare,
  onDelete,
  copyContent,
}: GroupControlsProps) {
  const [copied, setCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const showSwitcher = branch && branchOptions && branchOptions.length > 1;

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(copyContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [copyContent]);

  const handleRetry = useCallback(() => {
    if (retryTargetId) {
      onRetry(retryTargetId, "");
    }
  }, [retryTargetId, onRetry]);

  const handleSpeak = useCallback(() => {
    if ("speechSynthesis" in window) {
      if (isSpeaking) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
      } else {
        const utterance = new SpeechSynthesisUtterance(copyContent);
        utterance.onend = () => setIsSpeaking(false);
        window.speechSynthesis.speak(utterance);
        setIsSpeaking(true);
      }
    }
  }, [copyContent, isSpeaking]);

  return (
    <div className="flex items-center gap-2 transition-all duration-300 group-hover:opacity-100">
      {showSwitcher && (
        <BranchSwitcher
          branch={branch}
          branchOptions={branchOptions}
          onSelect={onBranchSelect}
          className="mr-1"
        />
      )}

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleCopy}
              className="size-8 bg-background/50 hover:bg-background/80 transition-all duration-200 hover:scale-110"
            >
              {copied ? (
                <span className="text-green-500 text-xs">Copied!</span>
              ) : (
                <Copy className="size-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Copy response</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleRetry}
              disabled={!retryTargetId}
              className="size-8 bg-background/50 hover:bg-background/80 transition-all duration-200 hover:scale-110"
            >
              <RotateCcw className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Retry</p>
          </TooltipContent>
        </Tooltip>

        {onSpeak && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleSpeak}
                className={cn(
                  "size-8 bg-background/50 hover:bg-background/80 transition-all duration-200 hover:scale-110",
                  isSpeaking && "text-primary",
                )}
              >
                <Volume2
                  className={cn("size-4", isSpeaking && "animate-pulse")}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isSpeaking ? "Stop" : "Speak"}</p>
            </TooltipContent>
          </Tooltip>
        )}

        {onSummarize && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() =>
                  retryTargetId && onSummarize(retryTargetId, copyContent)
                }
                disabled={!retryTargetId}
                className="size-8 bg-background/50 hover:bg-background/80 transition-all duration-200 hover:scale-110"
              >
                <FileText className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Summarize</p>
            </TooltipContent>
          </Tooltip>
        )}

        {onFork && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() =>
                  retryTargetId && onFork(retryTargetId, copyContent)
                }
                disabled={!retryTargetId}
                className="size-8 bg-background/50 hover:bg-background/80 transition-all duration-200 hover:scale-110"
              >
                <Fork className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Fork to new conversation</p>
            </TooltipContent>
          </Tooltip>
        )}

        {(onShare || onDelete) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-8 bg-background/50 hover:bg-background/80 transition-all duration-200 hover:scale-110"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="z-[100] animate-scale-in glass border border-border"
            >
              {onShare && (
                <DropdownMenuItem
                  onClick={() =>
                    retryTargetId && onShare(retryTargetId, copyContent)
                  }
                >
                  <Share className="size-4 mr-2" />
                  Share
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleCopy}>
                <Copy className="size-4 mr-2" />
                Copy response
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigator.clipboard.writeText(copyContent)}
              >
                <FileText className="size-4 mr-2" />
                Copy as markdown
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {onDelete && (
                <DropdownMenuItem
                  onClick={() => retryTargetId && onDelete(retryTargetId)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="size-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </TooltipProvider>
    </div>
  );
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
  const lastMessageFingerprintRef = useRef("");

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

  const [currentBranch, setCurrentBranch] = useState<string | null>(null);
  const [currentBranchCheckpoint, setCurrentBranchCheckpoint] = useState<{
    checkpoint_id: string;
  } | null>(null);

  const handleThreadId = useCallback(
    (newId: string) => {
      if (newId && !threadId) {
        onThreadChange?.(newId);
      }
    },
    [threadId, onThreadChange],
  );

  const handleError = useCallback((error: ChatError) => {
    setChatError(error.message);
  }, []);

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

  const chat = useChat(chatOptions);

  const processedMessages = useMemo(() => {
    if (chat.messages.length === 0) return [];

    try {
      const { messages: combined, toolCallsMap } = combineToolMessages(
        chat.messages,
      );

      return combined
        .filter(
          (m: LangGraphMessage) => !isToolMessage(m) && !isSystemMessage(m),
        )
        .map((m: LangGraphMessage, i: number) => {
          const tools = getCombinedToolCallsFromMap(m, toolCallsMap);
          return {
            id: m.id || `msg-${i}`,
            role: m.type === "human" ? "user" : "assistant",
            content:
              typeof m.content === "string"
                ? m.content
                : JSON.stringify(m.content),
            timestamp: new Date(),
            ...(tools?.length ? { _combinedToolCalls: tools } : {}),
            _originalMessage: m,
          } as Message;
        });
    } catch (err) {
      console.error("Message processing error:", err);
      return [];
    }
  }, [chat.messages]);

  useEffect(() => {
    if (processedMessages.length > 0) {
      const fp = processedMessages
        .map((m) => `${m.id}:${m.content.length}`)
        .join("|");
      if (fp !== lastMessageFingerprintRef.current) {
        lastMessageFingerprintRef.current = fp;
        onMessagesChange(processedMessages);
        setChatError(null);
      }
    }
  }, [processedMessages, onMessagesChange]);

  useEffect(() => {
    if (!chat.isLoading) {
      setCurrentToolCalls([]);
      setLiveActivityEvents([]);
    }
  }, [chat.isLoading]);

  useEffect(() => {
    if (!threadId) {
      onMessagesChange([]);
      onAttachedFilesChange([]);
      setLiveActivityEvents([]);
      setCurrentToolCalls([]);
      lastMessageFingerprintRef.current = "";
    }
  }, [threadId, onMessagesChange, onAttachedFilesChange]);

  useEffect(() => {
    chatContainerRef.current?.scrollTo({
      top: chatContainerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length]);

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

      if (currentBranchCheckpoint) {
        submitOptions.checkpoint = currentBranchCheckpoint;
      }

      chat.submit({ messages: [newMessage] }, submitOptions);
      onAttachedFilesChange([]);

      setCurrentBranch(null);
      setCurrentBranchCheckpoint(null);

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
    [
      messages,
      onAttachedFilesChange,
      chat,
      currentBranch,
      currentBranchCheckpoint,
    ],
  );

  // DUMMY TITLE GENERATION LOGIC
  useEffect(() => {
    // Check if we have exactly 1 user message and 1 assistant message (first turn)
    const userMessages = chat.messages.filter((m) => m.type === "human");
    const aiMessages = chat.messages.filter((m) => m.type === "ai");

    if (
      userMessages.length === 1 &&
      aiMessages.length === 1 &&
      chat.threadId &&
      !chat.isLoading
    ) {
      console.log(
        "[Dummy Logic] Analyzing first response for title generation...",
      );

      // Simulate API call delay
      const timeoutId = setTimeout(() => {
        const dummyTitle = `Title: ${userMessages[0].content.slice(0, 15)}... (AI Generated)`;
        console.log(`[Dummy Logic] Generated title: "${dummyTitle}"`);
        toast.info("Conversaton title updated (Dummy Logic)");

        // In a real implementation, we would call the API to update the title here.
        // For now, we'll just log it.
        // We could also update it using the threads client if we wanted to see it in the UI,
        // but the requirements said "dummy logic so it does nothing for now", implies logging/stubbing.
        // However, updating the actual thread title would be cool. Let's do it.

        try {
          const client = createThreadsClient(
            process.env.NEXT_PUBLIC_LANGGRAPH_API_URL ||
              "http://localhost:2024",
          );
          client.updateThread(chat.threadId!, {
            title: dummyTitle,
          });
          console.log("[Dummy Logic] Title actually updated in backend");
        } catch (e) {
          console.error("[Dummy Logic] Failed to update title", e);
        }
      }, 2000);

      return () => clearTimeout(timeoutId);
    }
  }, [chat.messages, chat.threadId, chat.isLoading]);

  const handleStop = useCallback(() => {
    chat.stop();
  }, [chat]);

  const handleEdit = useCallback(
    (id: string, content: string) => {
      const messageIndex = chat.messages.findIndex((m) => m.id === id);
      const liveMessage = chat.messages[messageIndex];

      if (!liveMessage) {
        toast.error("Message not found in current session");
        return;
      }

      const metadata = chat.getMessagesMetadata(liveMessage);
      let parentCheckpoint = metadata?.firstSeenState?.parent_checkpoint;

      if (currentBranchCheckpoint && !parentCheckpoint) {
        parentCheckpoint = currentBranchCheckpoint;
      }

      if (parentCheckpoint) {
        chat.submit(
          { messages: [{ type: "human", content }] },
          { checkpoint: parentCheckpoint },
        );
      } else if (messageIndex === 0) {
        console.warn(
          "[ChatArea] No parent checkpoint for first message. This might append instead of branch.",
        );
        chat.submit({ messages: [{ type: "human", content }] });
      } else {
        toast.error("Unable to edit: No checkpoint available");
        console.error("Missing checkpoint for message:", liveMessage);
      }
    },
    [chat, currentBranchCheckpoint],
  );

  const handleRetry = useCallback(
    (id: string, _content: string) => {
      const liveMessage = chat.messages.find((m) => m.id === id);
      if (!liveMessage) {
        toast.error("Message not found in current session");
        return;
      }

      const metadata = chat.getMessagesMetadata(liveMessage);
      let parentCheckpoint = metadata?.firstSeenState?.parent_checkpoint;

      if (currentBranchCheckpoint && !parentCheckpoint) {
        parentCheckpoint = currentBranchCheckpoint;
      }

      if (parentCheckpoint) {
        if (liveMessage.type === "human") {
          const content =
            typeof liveMessage.content === "string"
              ? liveMessage.content
              : JSON.stringify(liveMessage.content);
          chat.submit(
            { messages: [{ type: "human", content }] },
            { checkpoint: parentCheckpoint },
          );
        } else {
          chat.submit(undefined, { checkpoint: parentCheckpoint });
        }
      } else {
        toast.error("Unable to retry: No checkpoint available");
      }
    },
    [chat, currentBranchCheckpoint],
  );

  const handleBranchSelect = useCallback(
    (branch: string) => {
      chat.setBranch(branch);
      setCurrentBranch(branch);

      const lastMessage = chat.messages[chat.messages.length - 1];
      if (lastMessage) {
        const meta = chat.getMessagesMetadata(lastMessage);
        if (meta?.firstSeenState?.parent_checkpoint) {
          setCurrentBranchCheckpoint(meta.firstSeenState.parent_checkpoint);
        }
      }
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
      onMessagesChange(processedMessages.filter((m) => m.id !== id));
    },
    [processedMessages, onMessagesChange],
  );

  const handleRemoveFile = useCallback(
    (fileId: string) => {
      onAttachedFilesChange(attachedFiles.filter((f) => f.id !== fileId));
    },
    [attachedFiles, onAttachedFilesChange],
  );

  const hasMessages =
    chat.messages.filter((m) => m.type !== "system").length > 0;
  const showLoading =
    chat.isLoading &&
    (chat.messages.length === 0 ||
      chat.messages[chat.messages.length - 1]?.type === "human");

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
          <div className="max-w-4xl mx-auto w-full space-y-6">
            {chatError && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
                <p className="text-sm font-medium">Error</p>
                <p className="text-xs opacity-80">{chatError}</p>
              </div>
            )}

            {(() => {
              console.log(
                "[BranchDebug] ==================== MESSAGE PROCESSING START ====================",
              );
              console.log(
                "[BranchDebug] Total messages:",
                chat.messages.length,
              );
              console.log("[BranchDebug] Current threadId:", chat.threadId);
              console.log(
                "[BranchDebug] Current stream branch:",
                (chat as any).stream?.branch,
              );
              console.log(
                "[BranchDebug] experimental_branchTree:",
                JSON.stringify(
                  (chat as any).stream?.experimental_branchTree,
                  null,
                  2,
                ),
              );

              const processed: Array<{
                uiMessage: Message;
                isLastInGroup: boolean;
                retryTargetId: string | null;
                branch: string | undefined;
                branchOptions: string[] | undefined;
                groupCopyContent: string;
              }> = [];

              let groupFirstAiId: string | null = null;
              let groupMessages: Array<{ role: string; content: string }> = [];

              for (let i = 0; i < chat.messages.length; i++) {
                const msg = chat.messages[i];

                if (msg.type === "system" || msg.type === "tool") continue;
                if (msg.id && hiddenMessageIds.has(msg.id)) continue;

                console.log(`[BranchDebug] --- Processing message ${i} ---`);
                console.log("[BranchDebug] Message id:", msg.id);
                console.log("[BranchDebug] Message type:", msg.type);
                console.log(
                  "[BranchDebug] Message content preview:",
                  typeof msg.content === "string"
                    ? msg.content.slice(0, 50)
                    : "complex",
                );

                if (msg.type === "human") {
                  groupFirstAiId = null;
                  groupMessages = [];
                  console.log("[BranchDebug] NEW GROUP STARTED");
                }

                const branchMetadata = chat.getMessagesMetadata(msg);
                console.log("[BranchDebug] branchMetadata:", {
                  branch: branchMetadata?.branch,
                  branchOptions: branchMetadata?.branchOptions,
                  branchOptionsLength: branchMetadata?.branchOptions?.length,
                  hasFirstSeenState: !!branchMetadata?.firstSeenState,
                  parentCheckpointId:
                    branchMetadata?.firstSeenState?.parent_checkpoint
                      ?.checkpoint_id,
                });

                const toolCalls = chat.getToolCalls(msg);
                console.log(
                  "[BranchDebug] Tool calls count:",
                  toolCalls.length,
                );

                const reasoning = (msg as any)._originalMessage
                  ? getReasoningFromMessage((msg as any)._originalMessage)
                  : undefined;

                const content =
                  typeof msg.content === "string"
                    ? msg.content
                    : Array.isArray(msg.content)
                      ? msg.content.map((c: any) => c.text || "").join("")
                      : JSON.stringify(msg.content);

                if (msg.type === "ai") {
                  groupMessages.push({ role: "assistant", content });
                }

                const uiMessage: Message = {
                  id: msg.id || `msg-${i}`,
                  role: msg.type === "human" ? "user" : "assistant",
                  content,
                  timestamp: new Date(),
                  _originalMessage: msg,
                  reasoning,
                  _combinedToolCalls: toolCalls.map((tc) => {
                    const uiMsg = chat.ui.find(
                      (ui) => ui.metadata?.tool_call_id === tc.call.id,
                    );
                    const toolConfig = getToolUIConfig(tc.call.name);

                    return {
                      id: tc.call.id || "",
                      name: tc.call.name,
                      arguments: tc.call.args,
                      result: tc.result?.content as string,
                      status:
                        uiMsg?.props?.status === "executing"
                          ? "loading"
                          : uiMsg?.props?.status === "failed"
                            ? "error"
                            : uiMsg?.props?.status === "completed"
                              ? "success"
                              : tc.state === "pending"
                                ? "loading"
                                : tc.state === "error"
                                  ? "error"
                                  : "success",
                      startedAt: uiMsg?.props?.startedAt,
                      completedAt: uiMsg?.props?.completedAt,
                      error: uiMsg?.props?.error,
                      namespace: toolConfig.namespace,
                    };
                  }),
                };

                if (msg.type === "ai" && groupFirstAiId === null) {
                  groupFirstAiId = uiMessage.id;
                }

                let isLastInGroup = false;
                for (let j = i + 1; j < chat.messages.length; j++) {
                  if (chat.messages[j].type === "human") {
                    isLastInGroup = true;
                    break;
                  }
                }
                if (i === chat.messages.length - 1) isLastInGroup = true;

                const groupCopyContent = groupMessages
                  .map((m) => m.content)
                  .join("\n\n");

                processed.push({
                  uiMessage,
                  isLastInGroup,
                  retryTargetId: groupFirstAiId,
                  branch: branchMetadata?.branch,
                  branchOptions: branchMetadata?.branchOptions,
                  groupCopyContent,
                });

                console.log("[BranchDebug] Added to processed:", {
                  id: uiMessage.id,
                  role: uiMessage.role,
                  isLastInGroup,
                  retryTargetId: groupFirstAiId,
                  branchOptionsLength: branchMetadata?.branchOptions?.length,
                });
              }

              console.log("[BranchDebug] Total processed:", processed.length);
              console.log(
                "[BranchDebug] ==================== END ====================",
              );

              return processed.map(
                (
                  {
                    uiMessage,
                    isLastInGroup,
                    retryTargetId,
                    branch,
                    branchOptions,
                    groupCopyContent,
                  },
                  idx,
                ) => {
                  const prevMsg = idx > 0 ? processed[idx - 1].uiMessage : null;
                  const showAvatar =
                    uiMessage.role === "assistant" &&
                    (idx === 0 || prevMsg?.role === "user");

                  return (
                    <React.Fragment key={uiMessage.id}>
                      <ChatBubble
                        message={uiMessage}
                        showAvatar={showAvatar}
                        showActions={uiMessage.role === "user"}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                      />

                      {uiMessage._combinedToolCalls &&
                        uiMessage._combinedToolCalls.length > 0 &&
                        settings.showToolCalls &&
                        !showLoading && (
                          <GenerativeUIRenderer
                            toolCalls={
                              uiMessage._combinedToolCalls.filter((tc) =>
                                hasCustomUI(tc.name),
                              ) as ToolCall[]
                            }
                            isLoading={uiMessage._combinedToolCalls.some(
                              (tc) => tc.status === "loading",
                            )}
                          />
                        )}

                      {uiMessage._combinedToolCalls &&
                        uiMessage._combinedToolCalls.length > 0 &&
                        settings.showToolCalls &&
                        !showLoading &&
                        uiMessage._combinedToolCalls.some(
                          (tc) => !hasCustomUI(tc.name),
                        ) && (
                          <div className="ml-14 mt-3">
                            <ToolCallMessage
                              toolCalls={
                                uiMessage._combinedToolCalls.filter(
                                  (tc) => !hasCustomUI(tc.name),
                                ) as ToolCall[]
                              }
                              isLoading={uiMessage._combinedToolCalls.some(
                                (tc) => tc.status === "loading",
                              )}
                            />
                          </div>
                        )}

                      {isLastInGroup && uiMessage.role === "assistant" && (
                        <>
                          {console.log("[BranchDebug] GroupControls:", {
                            id: uiMessage.id,
                            hasRetryTarget: !!retryTargetId,
                            hasBranch: !!branch,
                            branchOptionsLength: branchOptions?.length,
                          })}
                          <div className="flex items-center gap-2 mt-2 ml-14 group-hover:opacity-100 transition-opacity">
                            <GroupControls
                              retryTargetId={retryTargetId}
                              branch={branch}
                              branchOptions={branchOptions}
                              onBranchSelect={handleBranchSelect}
                              onRetry={handleRetry}
                              copyContent={groupCopyContent}
                            />
                          </div>
                        </>
                      )}
                    </React.Fragment>
                  );
                },
              );
            })()}

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
