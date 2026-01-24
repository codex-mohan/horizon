import type { Message } from "@langchain/langgraph-sdk";

export interface CombinedToolCall {
  id: string;
  name: string;
  arguments?: Record<string, unknown>;
  result?: string;
  status: "loading" | "success" | "error" | "completed";
}

const extendedMessages = new Map<
  string,
  {
    _combinedToolCalls?: CombinedToolCall[];
    _isCombinedToolMessage?: boolean;
  }
>();

export function combineToolMessages(messages: Message[]): Message[] {
  const result: Message[] = [];
  const toolMessageIds = new Set<string>();

  for (let i = 0; i < messages.length; i++) {
    const current = messages[i];
    const currentId = current.id || `msg-${i}`;
    const currentExtended = extendedMessages.get(currentId) || {};

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

      for (let j = i + 1; j < messages.length; j++) {
        const next = messages[j];
        const nextId = next.id || `msg-${j}`;

        if (next.type === "tool") {
          const toolMessageContent =
            typeof next.content === "string"
              ? next.content
              : JSON.stringify(next.content);

          const toolName = next.name || "unknown";

          const matchingCall = toolCalls.find((tc) => {
            if (tc.id && next.tool_call_id === tc.id) return true;
            if (tc.name && tc.name.toLowerCase() === toolName.toLowerCase())
              return true;
            return false;
          });

          if (matchingCall || toolCalls.length === 1) {
            combinedCalls.push({
              id: matchingCall?.id || next.tool_call_id || `tool-${j}`,
              name: matchingCall?.name || toolName,
              arguments: matchingCall?.input,
              result: toolMessageContent,
              status: toolMessageContent.toLowerCase().includes("error")
                ? "error"
                : "completed",
            });

            toolMessageIds.add(nextId);
            extendedMessages.set(nextId, { _isCombinedToolMessage: true });
            continue;
          }
        }

        break;
      }

      if (combinedCalls.length > 0) {
        extendedMessages.set(currentId, {
          ...currentExtended,
          _combinedToolCalls: combinedCalls,
          _isCombinedToolMessage: true,
        });
      }

      result.push(current);
    } else if (
      toolMessageIds.has(currentId) ||
      extendedMessages.get(currentId)?._isCombinedToolMessage
    ) {
    } else {
      result.push(current);
    }
  }

  return result;
}

export function getCombinedToolCalls(
  message: Message,
): CombinedToolCall[] | null {
  const msgId = message.id || `msg-${Date.now()}`;
  return extendedMessages.get(msgId)?._combinedToolCalls || null;
}

export function isToolMessage(message: Message): boolean {
  return message.type === "tool";
}

export function debugToolMessages(messages: Message[]): void {
  console.log("=== Debug Tool Messages ===");
  console.log("Total messages:", messages.length);

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const msgData = msg as unknown as Record<string, unknown>;

    console.log(
      `[${i}] type:${msg.type}, id:${msg.id?.slice(0, 8)}, content_len:${
        typeof msg.content === "string" ? msg.content.length : "N/A"
      }, has_tool_calls:${!!msgData.tool_calls}`,
    );

    if (msg.type === "tool") {
      console.log(
        `    tool_name:${msg.name}, tool_call_id:${msg.tool_call_id}`,
      );
    }
  }
  console.log("===========================");
}
