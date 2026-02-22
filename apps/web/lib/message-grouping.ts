/**
 * Message grouping utilities for chat messages
 *
 * Groups messages by conversation turns:
 * - User message starts a new turn
 * - All AI messages + tool calls in that turn are ONE group
 * - Tool rounds are tracked in-order via `toolSteps[]`
 * - Controls only appear at the end of the group
 */

import type { AIMessage, Message as LangGraphMessage } from "@langchain/langgraph-sdk";
import type { AttachedFile, Message } from "@/components/chat/chat-interface";
import type { ToolCall } from "@/components/chat/tool-call-message";
import { getReasoningFromMessage } from "@/lib/reasoning-utils";
import { getToolUIConfig } from "@/lib/tool-config";

/**
 * A single tool-call round inside a group.
 * An agent may call tools multiple times sequentially before giving a final
 * answer. Each such round becomes one ToolStep.
 */
export interface ToolStep {
  /** The AI message that initiated this tool round (may have intro text) */
  introMessage: Message | null;
  /** All tool calls that belong to this round */
  toolCalls: ToolCall[];
}

export interface MessageGroup {
  id: string;
  userMessage: Message | null;
  /** Attachments from the user message (images, files) */
  userAttachments: AttachedFile[];
  /**
   * Ordered list of tool-call rounds. Each entry is one AI → tool(s) cycle.
   * Rendered in order so the conversation flow is preserved.
   */
  toolSteps: ToolStep[];
  /** The final AI text response (no tool_calls). */
  assistantMessage: Message | null;
  /** ID of the first AI message in this group - used for regeneration */
  firstAssistantMessageId?: string;
  isLastGroup: boolean;
  branch?: string;
  branchOptions?: string[];
}

export type ChatHook = ReturnType<typeof import("@/lib/chat").useChat>;

/**
 * Extract text content from multimodal message content
 */
function extractTextContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter(
        (block): block is { type: "text"; text: string } =>
          block.type === "text" && typeof block.text === "string"
      )
      .map((block) => block.text)
      .join("\n");
  }
  return "";
}

/**
 * Extract attachments from message's additional_kwargs
 * This persists with the message through LangGraph's checkpointer
 */
function extractAttachments(msg: LangGraphMessage, msgId: string): AttachedFile[] {
  if (msg.type !== "human") return [];

  const attachments: AttachedFile[] = [];

  // Primary: Extract from additional_kwargs.file_metadata (persists with message)
  const additionalKwargs = (msg as any).additional_kwargs;
  if (additionalKwargs?.file_metadata && Array.isArray(additionalKwargs.file_metadata)) {
    console.log(
      "[extractAttachments] Found file_metadata in additional_kwargs:",
      additionalKwargs.file_metadata.length
    );
    return additionalKwargs.file_metadata.map((f: any, i: number) => ({
      id: f.id || `attachment-${msgId}-${i}`,
      name: f.name || "File",
      type: f.type || "file",
      url: f.url || "",
      size: f.size,
    }));
  }

  // Fallback: Check for attachments stored directly on the message (legacy optimistic updates)
  const msgWithAttachments = msg as LangGraphMessage & { attachments?: AttachedFile[] };
  if (msgWithAttachments.attachments && Array.isArray(msgWithAttachments.attachments)) {
    console.log(
      "[extractAttachments] Found attachments on message object:",
      msgWithAttachments.attachments.length
    );
    return msgWithAttachments.attachments;
  }

  // Fallback: Extract from multimodal content array (for vision models)
  const content = msg.content;
  if (Array.isArray(content)) {
    console.log("[extractAttachments] Content is array with", content.length, "blocks");
    let imageIndex = 0;
    for (const block of content) {
      if (block.type === "image_url" && block.image_url) {
        const imageUrl =
          typeof block.image_url === "string" ? block.image_url : block.image_url.url;
        if (imageUrl) {
          attachments.push({
            id: `attachment-${msgId}-${imageIndex++}`,
            name: "Image",
            type: "image",
            url: imageUrl,
          });
        }
      }
    }
    if (attachments.length > 0) {
      console.log("[extractAttachments] Extracted from multimodal content:", attachments.length);
      return attachments;
    }
  }

  console.log("[extractAttachments] No attachments found for message:", msgId);
  return [];
}

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
      contentType: typeof m.content,
      isArray: Array.isArray(m.content),
      contentPreview:
        typeof m.content === "string"
          ? m.content.slice(0, 50)
          : Array.isArray(m.content)
            ? `array[${m.content.length}]: ${m.content.map((b: any) => b.type).join(",")}`
            : `[${typeof m.content}]`,
      toolCalls: (m as any).tool_calls?.length || 0,
    }))
  );

  const groups: MessageGroup[] = [];
  let currentGroup: MessageGroup | null = null;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    // Skip system and tool messages (tool results come from AI message's tool_calls).
    // Also skip human messages that are purely document context injected for the LLM —
    // these are tagged with is_document_context: true in additional_kwargs.
    if (msg.type === "system" || msg.type === "tool") continue;
    if (
      msg.type === "human" &&
      (msg as any).additional_kwargs?.is_document_context === true
    ) continue;

    if (msg.id && hiddenMessageIds.has(msg.id)) continue;

    const metadata = chat.getMessagesMetadata(msg);
    const reasoning = getReasoningFromMessage(msg as AIMessage);

    const content =
      typeof msg.content === "string"
        ? msg.content
        : Array.isArray(msg.content)
          ? extractTextContent(msg.content)
          : JSON.stringify(msg.content);

    if (msg.type === "human") {
      // Push previous group if exists
      if (currentGroup) {
        groups.push(currentGroup);
      }

      // Extract attachments from multimodal content
      const userAttachments = extractAttachments(msg, msg.id || `msg-${i}`);

      // Start new group for this user turn
      currentGroup = {
        id: `group-${msg.id || i}`,
        userMessage: {
          id: msg.id || `msg-${i}`,
          role: "user",
          content,
          timestamp: new Date(),
          _originalMessage: msg,
          attachments: userAttachments,
        },
        userAttachments,
        toolSteps: [],
        assistantMessage: null,
        firstAssistantMessageId: undefined,
        isLastGroup: false,
        branch: metadata?.branch,
        branchOptions: metadata?.branchOptions,
      };
    } else if (msg.type === "ai") {
      // Get tool calls for this AI message
      const toolCalls = extractToolCalls(chat, msg);
      const hasTextContent = content && content.trim().length > 0;
      const hasToolCalls = toolCalls.length > 0;

      if (currentGroup) {
        // Track the FIRST AI message ID for regeneration purposes
        if (!currentGroup.firstAssistantMessageId) {
          currentGroup.firstAssistantMessageId = msg.id || `msg-${i}`;
        }

        const aiMessage: Message = {
          id: msg.id || `msg-${i}`,
          role: "assistant",
          content,
          timestamp: new Date(),
          _originalMessage: msg,
          reasoning,
        };

        if (hasToolCalls) {
          // This AI message starts (or continues) a tool-call round.
          // Each distinct AI message with tool_calls is its own step — this
          // preserves multi-round ordering (no merging by ID dedup here).
          const introMessage: Message | null = hasTextContent
            ? { ...aiMessage }
            : null;

          // Deduplicate tool calls against ALL previous steps to be safe
          const seenIds = new Set(
            currentGroup.toolSteps.flatMap((s) => s.toolCalls.map((tc) => tc.id))
          );
          const newToolCalls = toolCalls.filter((tc) => !seenIds.has(tc.id));

          if (newToolCalls.length > 0 || introMessage) {
            currentGroup.toolSteps.push({ introMessage, toolCalls: newToolCalls });
          } else if (newToolCalls.length === 0 && currentGroup.toolSteps.length > 0) {
            // All tool calls already seen — this is an update to existing calls
            // (e.g. result messages); merge results into the last step's tool calls
            const lastStep = currentGroup.toolSteps[currentGroup.toolSteps.length - 1];
            const lastStepIds = new Set(lastStep.toolCalls.map((tc) => tc.id));
            for (const tc of toolCalls) {
              if (lastStepIds.has(tc.id)) {
                const existing = lastStep.toolCalls.find((e) => e.id === tc.id);
                if (existing) {
                  existing.result = tc.result || existing.result;
                  existing.status = tc.status;
                }
              }
            }
          }
        } else if (hasTextContent) {
          // Plain text content with no tool calls → this is the final assistant response
          currentGroup.assistantMessage = aiMessage;
        } else {
          // Edge case: AI message with no content and no tool_calls
          // Could be an empty streaming tick — ignore unless it's the only AI message
          if (!currentGroup.assistantMessage && currentGroup.toolSteps.length === 0) {
            currentGroup.assistantMessage = aiMessage;
          }
        }

        // Update branch metadata
        if (metadata?.branch !== undefined) currentGroup.branch = metadata.branch;
        if (metadata?.branchOptions !== undefined)
          currentGroup.branchOptions = metadata.branchOptions;
      } else {
        // AI message without preceding user (edge case)
        const aiMessage: Message = {
          id: msg.id || `msg-${i}`,
          role: "assistant",
          content,
          timestamp: new Date(),
          _originalMessage: msg,
          reasoning,
        };

        const introMessage: Message | null = hasTextContent && hasToolCalls ? { ...aiMessage } : null;

        currentGroup = {
          id: `group-${msg.id || i}`,
          userMessage: null,
          userAttachments: [],
          toolSteps: hasToolCalls
            ? [{ introMessage, toolCalls }]
            : [],
          assistantMessage: hasToolCalls ? null : aiMessage,
          firstAssistantMessageId: msg.id || `msg-${i}`,
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
      toolStepsCount: g.toolSteps.length,
      toolSteps: g.toolSteps.map((s) => ({
        hasIntro: !!s.introMessage,
        toolCalls: s.toolCalls.map((tc) => ({ id: tc.id, name: tc.name, status: tc.status })),
      })),
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
