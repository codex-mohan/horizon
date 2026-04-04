import type { Message } from "@/lib/types/message";

/**
 * Extracts reasoning/thinking content from an AI message.
 * Supports both OpenAI reasoning and Anthropic extended thinking.
 */
export function getReasoningFromMessage(message: Message): string | undefined {
  type MessageWithExtras = AIMessage & {
    additional_kwargs?: {
      reasoning?: {
        summary?: Array<{ type: string; text: string }>;
      };
      reasoning_content?: string;
    };
    kwargs?: {
      additional_kwargs?: {
        reasoning?: {
          summary?: Array<{ type: string; text: string }>;
        };
        reasoning_content?: string;
      };
      reasoning?: string;
    };
    contentBlocks?: Array<{ type: string; thinking?: string }>;
  };

  const msg = message as MessageWithExtras;

  const additionalKwargs = msg.additional_kwargs || msg.kwargs?.additional_kwargs;

  // Check for string reasoning_content (Ollama / NVIDIA NIM)
  if (additionalKwargs?.reasoning_content) {
    if (typeof additionalKwargs.reasoning_content === "string") {
      return additionalKwargs.reasoning_content;
    }
  }

  // Check for OpenAI reasoning in additional_kwargs
  if (additionalKwargs?.reasoning?.summary) {
    const content = additionalKwargs.reasoning.summary
      .filter((item) => item.type === "summary_text")
      .map((item) => item.text)
      .join("");
    if (content.trim()) return content;
  }

  // Check for Anthropic thinking in contentBlocks
  if (msg.contentBlocks?.length) {
    const thinking = msg.contentBlocks
      .filter((b) => b.type === "thinking" && b.thinking)
      .map((b) => b.thinking)
      .join("\n");
    if (thinking) return thinking;
  }

  // Check for thinking in message.content array
  if (Array.isArray(msg.content)) {
    const thinking = msg.content
      .filter(
        (b: any): b is { type: "thinking"; thinking: string } =>
          typeof b === "object" && b !== null && b.type === "thinking" && "thinking" in b
      )
      .map((b: any) => b.thinking)
      .join("\n");
    if (thinking) return thinking;
  }

  // Check for Ollama's top-level reasoning string in kwargs
  if (msg.kwargs?.reasoning && typeof msg.kwargs.reasoning === "string") {
    return msg.kwargs.reasoning;
  }

  return undefined;
}

/**
 * Extracts text content from a message.
 */
export function getTextContent(message: Message): string {
  if (typeof message.content === "string") return message.content;
  if (Array.isArray(message.content)) {
    return message.content
      .filter((c: any): c is { type: "text"; text: string } => c.type === "text")
      .map((c: any) => c.text)
      .join("");
  }
  return "";
}
