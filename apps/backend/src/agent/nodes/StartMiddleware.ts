import type { RunnableConfig } from "@langchain/core/runnables";
import { agentConfig } from "../../lib/config.js";
import type { AgentState } from "../state.js";

/**
 * StartMiddleware Node
 *
 * Initializes execution:
 * - Sets start time
 * - PII Detection
 */
export async function StartMiddleware(
  state: AgentState,
  _config: RunnableConfig
): Promise<Partial<AgentState>> {
  const updates: Partial<AgentState> = {};

  console.log("[StartMiddleware] Initializing...");

  // Set start time
  updates.start_time = Date.now();

  // PII Detection
  if (agentConfig.ENABLE_PII_DETECTION) {
    const lastMessage = state.messages.at(-1);
    if (lastMessage?.content) {
      const content =
        typeof lastMessage.content === "string"
          ? lastMessage.content
          : JSON.stringify(lastMessage.content);

      const PII_PATTERNS = {
        email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
        phone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
        ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
      };

      const detectedTypes: string[] = [];
      for (const [type, pattern] of Object.entries(PII_PATTERNS)) {
        if (pattern.test(content)) {
          detectedTypes.push(type);
          pattern.lastIndex = 0;
        }
      }

      if (detectedTypes.length > 0) {
        console.warn(`[PIIDetection] Detected: ${detectedTypes.join(", ")}`);
        updates.middleware_metrics = {
          ...state.middleware_metrics,
          pii_detected: true,
          pii_types: detectedTypes,
        };
      }
    }
  }

  console.log("[StartMiddleware] Complete");
  return updates;
}
