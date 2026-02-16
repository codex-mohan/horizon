import type { AIMessage } from "@langchain/langgraph-sdk";

interface ThinkingBlock {
  type: "thinking";
  thinking: string;
  [key: string]: unknown;
}

function _isThinkingBlock(content: unknown): content is ThinkingBlock {
  return (
    typeof content === "object" &&
    content !== null &&
    "type" in content &&
    (content as any).type === "thinking" &&
    "thinking" in content
  );
}

export function getReasoningFromMessage(message: AIMessage): string | undefined {
  type MessageWithExtras = AIMessage & {
    additional_kwargs?: {
      reasoning?: {
        summary?: Array<{ type: string; text: string }>;
      };
    };
    contentBlocks?: Array<{ type: string; thinking?: string }>;
  };

  const msg = message as MessageWithExtras;

  if (msg.additional_kwargs?.reasoning?.summary) {
    const content = msg.additional_kwargs.reasoning.summary
      .filter((item) => item.type === "summary_text")
      .map((item) => item.text)
      .join("");
    if (content.trim()) {
      return content;
    }
  }

  if (msg.contentBlocks?.length) {
    const thinking = msg.contentBlocks
      .filter((b) => b.type === "thinking" && b.thinking)
      .map((b) => b.thinking)
      .join("\n");
    if (thinking) {
      return thinking;
    }
  }

  if (Array.isArray(msg.content)) {
    const thinkingBlocks = msg.content.filter(
      (b) =>
        typeof b === "object" &&
        b !== null &&
        "type" in b &&
        (b as any).type === "thinking" &&
        "thinking" in b
    ) as unknown as ThinkingBlock[];
    const thinking = thinkingBlocks.map((b) => b.thinking).join("\n");
    if (thinking) {
      return thinking;
    }
  }

  return undefined;
}

export function getTextContent(message: AIMessage): string {
  if (typeof message.content === "string") {
    return message.content;
  }
  if (Array.isArray(message.content)) {
    return message.content
      .filter(
        (c): c is { type: "text"; text: string } =>
          typeof c === "object" &&
          c !== null &&
          "type" in c &&
          (c as any).type === "text" &&
          "text" in c
      )
      .map((c) => (c as { text: string }).text)
      .join("");
  }
  return "";
}
