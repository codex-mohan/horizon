import type { Message } from "@langchain/langgraph-sdk";

export interface CombinedToolCall {
  id: string;
  name: string;
  arguments?: Record<string, unknown>;
  result?: string;
  status: "loading" | "success" | "error" | "completed";
}

export interface ProcessedMessageResult {
  messages: Message[];
  toolCallsMap: Map<string, CombinedToolCall[]>;
}

/**
 * Combines tool call messages with their corresponding tool result messages.
 * This function processes messages to:
 * 1. Match tool_calls from AI messages with their corresponding tool result messages
 * 2. Filter out standalone tool messages (they get merged into the AI message's _combinedToolCalls)
 * 3. Maintain proper ordering: tool invocation data comes before results
 *
 * Returns both the filtered messages and a map of messageId -> combined tool calls
 */
export function combineToolMessages(messages: Message[]): ProcessedMessageResult {
  const result: Message[] = [];
  const toolCallsMap = new Map<string, CombinedToolCall[]>();
  const processedToolMessageIndices = new Set<number>();

  // First pass: identify all AI messages with tool_calls and their corresponding tool results
  for (let i = 0; i < messages.length; i++) {
    const current = messages[i];
    const currentData = current as unknown as Record<string, unknown>;

    const hasToolCalls =
      currentData.tool_calls &&
      Array.isArray(currentData.tool_calls) &&
      currentData.tool_calls.length > 0;

    if (current.type === "ai" && hasToolCalls) {
      const toolCalls = currentData.tool_calls as Array<{
        id?: string;
        name?: string;
        input?: Record<string, unknown>;
      }>;

      const combinedCalls: CombinedToolCall[] = [];

      // First, create placeholder entries for all tool calls (invocation first)
      const toolCallsById = new Map<string, CombinedToolCall>();
      for (let k = 0; k < toolCalls.length; k++) {
        const tc = toolCalls[k];
        const tcId = tc.id || `tool-call-${i}-${k}`;
        const call: CombinedToolCall = {
          id: tcId,
          name: tc.name || "unknown",
          arguments: tc.input,
          result: undefined,
          status: "loading",
        };
        toolCallsById.set(tcId, call);
        combinedCalls.push(call);
      }

      // Second, find matching tool result messages and update the entries
      for (let j = i + 1; j < messages.length; j++) {
        const next = messages[j];

        if (next.type === "tool") {
          const toolMessageContent =
            typeof next.content === "string" ? next.content : JSON.stringify(next.content);

          const toolName = next.name || "unknown";
          const toolCallId = next.tool_call_id;

          // Try to find matching call by ID first, then by name
          let matchedCall: CombinedToolCall | undefined;

          if (toolCallId && toolCallsById.has(toolCallId)) {
            matchedCall = toolCallsById.get(toolCallId);
          } else {
            // Fallback: match by name if only one tool call exists
            matchedCall = combinedCalls.find(
              (tc) => tc.name.toLowerCase() === toolName.toLowerCase() && !tc.result
            );
          }

          if (matchedCall) {
            matchedCall.result = toolMessageContent;
            matchedCall.status = toolMessageContent.toLowerCase().includes("error")
              ? "error"
              : "completed";
            processedToolMessageIndices.add(j);
          }
        } else if (next.type === "ai") {
          // Stop looking for tool results when we hit another AI message
          break;
        }
      }

      const currentId = current.id || `msg-${i}`;
      toolCallsMap.set(currentId, combinedCalls);
    }
  }

  // Second pass: build the result array, excluding processed tool messages
  for (let i = 0; i < messages.length; i++) {
    if (!processedToolMessageIndices.has(i)) {
      // Skip tool messages that weren't matched to any AI message
      if (messages[i].type === "tool") {
        continue;
      }
      result.push(messages[i]);
    }
  }

  return { messages: result, toolCallsMap };
}

/**
 * Get combined tool calls for a specific message from the processed map
 */
export function getCombinedToolCallsFromMap(
  message: Message,
  toolCallsMap: Map<string, CombinedToolCall[]>
): CombinedToolCall[] | null {
  const msgId = message.id;
  if (!msgId) {
    return null;
  }
  return toolCallsMap.get(msgId) || null;
}

/**
 * Check if a message is a tool type message
 */
export function isToolMessage(message: Message): boolean {
  return message.type === "tool";
}

/**
 * Check if a message is a system message
 */
export function isSystemMessage(message: Message): boolean {
  return message.type === "system";
}

/**
 * Debug utility to log message structure for troubleshooting
 */
export function debugToolMessages(messages: Message[]): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  console.group("🔧 Debug Tool Messages");
  console.log("Total messages:", messages.length);

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const msgData = msg as unknown as Record<string, unknown>;

    const toolCallCount = msgData.tool_calls ? (msgData.tool_calls as unknown[]).length : 0;

    const contentPreview =
      typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);

    console.log(
      `[${i}] type:${msg.type}, id:${msg.id?.slice(0, 8) || "N/A"}, ` +
        `tool_calls:${toolCallCount}`
    );
    console.log(`    content: ${contentPreview}`);

    if (msg.type === "tool") {
      console.log(`    └─ tool_name:${msg.name}, tool_call_id:${msg.tool_call_id}`);
    }
  }
  console.groupEnd();
}
