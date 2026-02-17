/**
 * Message grouping utilities for chat messages
 *
 * Groups messages by conversation turns:
 * - User message starts a new turn
 * - All AI messages + tool calls in that turn are ONE group
 * - Controls only appear at the end of the group
 */

import type { AIMessage, Message as LangGraphMessage } from "@langchain/langgraph-sdk";
import type { Message } from "@/components/chat/chat-interface";
import type { ToolCall } from "@/components/chat/tool-call-message";
import { getReasoningFromMessage } from "@/lib/reasoning-utils";
import { getToolUIConfig } from "@/lib/tool-config";

export interface MessageGroup {
  id: string;
  userMessage: Message | null;
  assistantMessage: Message | null;
  /** ID of the first AI message in this group - used for regeneration */
  firstAssistantMessageId?: string;
  toolCalls: ToolCall[];
  isLastGroup: boolean;
  branch?: string;
  branchOptions?: string[];
}

export type ChatHook = ReturnType<typeof import("@/lib/chat").useChat>;

function extractToolCalls(chat: ChatHook, msg: unknown): ToolCall[] {
  const toolCalls = chat.getToolCalls(msg);
  const result: ToolCall[] = [];

  for (const tc of toolCalls) {
    const tcRecord = tc as Record<string, unknown>;
    const callData = tcRecord.call as Record<string, unknown> | undefined;
    const name = (tcRecord.name as string) || (callData?.name as string) || "";
    const id = (tcRecord.id as string) || (callData?.id as string) || "";
    const args =
      (tcRecord.args as Record<string, unknown>) ||
      (callData?.args as Record<string, unknown>) ||
      {};
    const resultData = tcRecord.result as Record<string, unknown> | undefined;
    const resultContent =
      (tcRecord.resultContent as string) || (resultData?.content as string) || "";
    const state = tcRecord.state as string | undefined;

    const toolConfig = getToolUIConfig(name);
    result.push({
      id,
      name,
      arguments: args,
      result: resultContent,
      status: (state === "pending" ? "loading" : state === "error" ? "error" : "success") as
        | "loading"
        | "error"
        | "success"
        | "completed",
      namespace: toolConfig.namespace,
    });
  }

  return result;
}

export function groupMessages(
  messages: LangGraphMessage[],
  chat: ChatHook,
  hiddenMessageIds: Set<string>
): MessageGroup[] {
  if (messages.length === 0) return [];

  // Debug: Log incoming messages
  console.log(
    "[groupMessages] Incoming messages:",
    messages.map((m, idx) => ({
      index: idx,
      id: m.id,
      type: m.type,
      content: typeof m.content === "string" ? m.content.slice(0, 50) : `[${typeof m.content}]`,
      toolCalls: (m as any).tool_calls?.length || 0,
    }))
  );

  const groups: MessageGroup[] = [];
  let currentGroup: MessageGroup | null = null;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    // Skip system and tool messages (tool results come from AI message's tool_calls)
    if (msg.type === "system" || msg.type === "tool") continue;
    if (msg.id && hiddenMessageIds.has(msg.id)) continue;

    const metadata = chat.getMessagesMetadata(msg);
    const reasoning = getReasoningFromMessage(msg as AIMessage);

    const content =
      typeof msg.content === "string"
        ? msg.content
        : Array.isArray(msg.content)
          ? msg.content.map((c: Record<string, unknown>) => (c.text as string) || "").join("")
          : JSON.stringify(msg.content);

    if (msg.type === "human") {
      // Push previous group if exists
      if (currentGroup) {
        groups.push(currentGroup);
      }

      // Start new group for this user turn
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
        firstAssistantMessageId: undefined,
        toolCalls: [],
        isLastGroup: false,
        branch: metadata?.branch,
        branchOptions: metadata?.branchOptions,
      };
    } else if (msg.type === "ai") {
      // Get tool calls for this AI message
      const toolCalls = extractToolCalls(chat, msg);

      if (currentGroup) {
        // Track the FIRST AI message ID for regeneration purposes
        // This is crucial for regenerating from the start of the group
        if (!currentGroup.firstAssistantMessageId) {
          currentGroup.firstAssistantMessageId = msg.id || `msg-${i}`;
        }

        // Merge tool calls, deduplicating by ID and preferring ones with results
        const existingToolCallIds = new Set(currentGroup.toolCalls.map((tc) => tc.id));
        const newToolCalls = toolCalls.filter((tc) => !existingToolCallIds.has(tc.id));
        currentGroup.toolCalls = [...currentGroup.toolCalls, ...newToolCalls];

        // Update assistant message - the last AI message with text content wins
        const hasTextContent = content && content.trim().length > 0;
        if (hasTextContent) {
          currentGroup.assistantMessage = {
            id: msg.id || `msg-${i}`,
            role: "assistant",
            content,
            timestamp: new Date(),
            _originalMessage: msg,
            reasoning,
          };
        } else if (!currentGroup.assistantMessage && toolCalls.length > 0) {
          // AI message with only tool calls, no text - still create placeholder
          currentGroup.assistantMessage = {
            id: msg.id || `msg-${i}`,
            role: "assistant",
            content: "",
            timestamp: new Date(),
            _originalMessage: msg,
            reasoning,
          };
        }

        // Update branch metadata
        if (metadata?.branch !== undefined) currentGroup.branch = metadata.branch;
        if (metadata?.branchOptions !== undefined)
          currentGroup.branchOptions = metadata.branchOptions;
      } else {
        // AI message without preceding user (edge case)
        currentGroup = {
          id: `group-${msg.id || i}`,
          userMessage: null,
          assistantMessage: {
            id: msg.id || `msg-${i}`,
            role: "assistant",
            content,
            timestamp: new Date(),
            _originalMessage: msg,
            reasoning,
          },
          firstAssistantMessageId: msg.id || `msg-${i}`,
          toolCalls,
          isLastGroup: false,
          branch: metadata?.branch,
          branchOptions: metadata?.branchOptions,
        };
      }
    }
  }

  // Push the last group
  if (currentGroup) {
    groups.push(currentGroup);
  }

  // Mark the last group
  const lastGroup = groups.at(-1);
  if (lastGroup) lastGroup.isLastGroup = true;

  // Debug logging
  console.log(
    "[groupMessages] Groups created:",
    groups.map((g, idx) => ({
      index: idx,
      id: g.id,
      hasUser: !!g.userMessage,
      userContent: g.userMessage?.content?.slice(0, 50),
      hasAssistant: !!g.assistantMessage,
      assistantContent: g.assistantMessage?.content?.slice(0, 50),
      assistantId: g.assistantMessage?.id,
      toolCallsCount: g.toolCalls.length,
      toolCalls: g.toolCalls.map((tc) => ({ id: tc.id, name: tc.name, status: tc.status })),
      branch: g.branch,
      isLastGroup: g.isLastGroup,
    }))
  );

  return groups;
}

export const suggestedPrompts = [
  "Explain quantum computing in simple terms",
  "Write a Python function to sort an array",
  "What are the latest trends in AI?",
  "Help me plan a trip to Japan",
] as const;

export type SuggestedPrompt = (typeof suggestedPrompts)[number];
