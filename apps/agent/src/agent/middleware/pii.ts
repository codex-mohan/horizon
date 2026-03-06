import type { AgentState } from "../state.js";

/**
 * PII Detection Node
 * Checks for sensitive information in the last message.
 */
export const piiDetectionNode = async (state: AgentState) => {
  const messages = state.messages;
  const lastMessage = messages.at(-1);

  if (!lastMessage?.content) {
    return {};
  }

  const content =
    typeof lastMessage.content === "string"
      ? lastMessage.content
      : JSON.stringify(lastMessage.content);

  const PII_PATTERNS = {
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    phone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
  };

  const detected: string[] = [];

  for (const [type, pattern] of Object.entries(PII_PATTERNS)) {
    if (pattern.test(content)) {
      detected.push(type);
    }
  }

  if (detected.length > 0) {
    console.warn(`[PIIDetection] ⚠️ PII detected: ${detected.join(", ")}`);
  }

  return {};
};
