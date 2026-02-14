/**
 * Message grouping utilities for chat messages
 *
 * This module provides logic for grouping messages into user-assistant pairs
 * with associated tool calls for display in the chat interface.
 */

import type { AIMessage, Message as LangGraphMessage } from "@langchain/langgraph-sdk";
import type { Message } from "@/components/chat/chat-interface";
import type { ToolCall } from "@/components/chat/tool-call-message";
import { getReasoningFromMessage } from "@/lib/reasoning-utils";
import { getToolUIConfig } from "@/lib/tool-config";

// ============================================================================
// TYPES
// ============================================================================

export interface MessageGroup {
  id: string;
  userMessage: Message | null;
  assistantMessage: Message | null;
  toolCalls: ToolCall[];
  isLastGroup: boolean;
  branch?: string;
  branchOptions?: string[];
}

export type ChatHook = ReturnType<typeof import("@/lib/chat").useChat>;

// ============================================================================
// MESSAGE GROUPING LOGIC
// ============================================================================

/**
 * Groups messages into user-assistant pairs with associated tool calls.
 *
 * @param messages - Array of LangGraph messages
 * @param chat - The chat hook instance for accessing metadata and tool calls
 * @param hiddenMessageIds - Set of message IDs to hide from display
 * @returns Array of MessageGroup objects
 */
export function groupMessages(
  messages: LangGraphMessage[],
  chat: ChatHook,
  hiddenMessageIds: Set<string>
): MessageGroup[] {
  if (messages.length === 0) {
    return [];
  }

  const groups: MessageGroup[] = [];
  let currentGroup: MessageGroup | null = null;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    // Skip system and hidden messages
    if (msg.type === "system" || msg.type === "tool") {
      continue;
    }
    if (msg.id && hiddenMessageIds.has(msg.id)) {
      continue;
    }

    // Get metadata
    const metadata = chat.getMessagesMetadata(msg);
    const reasoning = getReasoningFromMessage(msg as AIMessage);

    // Extract content
    const content =
      typeof msg.content === "string"
        ? msg.content
        : Array.isArray(msg.content)
          ? msg.content.map((c: Record<string, unknown>) => (c.text as string) || "").join("")
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
      const toolCalls = chat.getToolCalls(msg as unknown);

      const toolCallsWithUI: ToolCall[] = toolCalls.map((tc: Record<string, unknown>) => {
        // Handle both formats: {name, id, args, ...} and {call: {name, id, args}, result, state}
        const callData = tc.call as Record<string, unknown> | undefined;
        const name = (tc.name as string) || (callData?.name as string) || "";
        const id = (tc.id as string) || (callData?.id as string) || "";
        const args =
          (tc.args as Record<string, unknown>) || (callData?.args as Record<string, unknown>) || {};
        const resultData = tc.result as Record<string, unknown> | undefined;
        const result = (tc.resultContent as string) || (resultData?.content as string) || "";
        const state = tc.state as string | undefined;

        const toolConfig = getToolUIConfig(name);
        return {
          id,
          name,
          arguments: args,
          result,
          status: (state === "pending" ? "loading" : state === "error" ? "error" : "success") as
            | "loading"
            | "error"
            | "success"
            | "completed",
          namespace: toolConfig.namespace,
        };
      });

      // ACCUMULATE tool calls - don't overwrite previous tool calls from this group
      // This handles cases where multiple AI messages exist in the same group
      // (e.g., one with tool calls, followed by one with the final response)
      if (toolCallsWithUI.length > 0) {
        currentGroup.toolCalls = [...currentGroup.toolCalls, ...toolCallsWithUI];
      }

      // Always update assistant message to get the latest content
      // but keep the accumulated tool calls
      currentGroup.assistantMessage = {
        id: msg.id || `msg-${i}`,
        role: "assistant",
        content,
        timestamp: new Date(),
        _originalMessage: msg,
        reasoning,
        _combinedToolCalls: currentGroup.toolCalls,
      };

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
  const lastGroup = groups.at(-1);
  if (lastGroup) {
    lastGroup.isLastGroup = true;
  }

  return groups;
}

// ============================================================================
// SUGGESTED PROMPTS
// ============================================================================

export const suggestedPrompts = [
  "Explain quantum computing in simple terms",
  "Write a Python function to sort an array",
  "What are the latest trends in AI?",
  "Help me plan a trip to Japan",
] as const;

export type SuggestedPrompt = (typeof suggestedPrompts)[number];
