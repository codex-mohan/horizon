import { type BaseMessage, SystemMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import { agentConfig } from "../../lib/config.js";
import { createLLM } from "../../lib/llm.js";
import type { AgentState } from "../state.js";
import { tools } from "../tools/index.js";

/**
 * Check if a message content contains multimodal elements (images)
 */
function isMultimodalContent(content: unknown): boolean {
  if (!Array.isArray(content)) return false;
  return content.some(
    (block) => typeof block === "object" && block !== null && block.type === "image_url"
  );
}

/**
 * Check if the model supports vision/multimodal input
 */
function isVisionModel(modelName: string): boolean {
  const visionModels = [
    "gpt-4-vision",
    "gpt-4-turbo",
    "gpt-4o",
    "gpt-4o-mini",
    "gemini",
    "claude-3",
    "claude-sonnet",
    "claude-opus",
    "claude-haiku",
    "llava",
    "cogvlm",
    "qwen-vl",
  ];
  const lowerModel = modelName.toLowerCase();
  return visionModels.some((vm) => lowerModel.includes(vm));
}

export async function AgentNode(
  state: AgentState,
  _config: RunnableConfig
): Promise<Partial<AgentState>> {
  console.log("[AgentNode] Processing...");

  const llm = await createLLM();
  if (!llm.bindTools) {
    throw new Error("LLM does not support tool binding");
  }

  const llmWithTools = llm.bindTools(tools);

  let systemPrompt =
    `${agentConfig.CHARACTER}\n\n` +
    `Behavior: ${agentConfig.CORE_BEHAVIOR}\n` +
    `Instructions: ${agentConfig.INSTRUCTIONS}\n` +
    `Guidelines: ${agentConfig.INTERACTION_GUIDELINES}\n` +
    `Capabilities: ${agentConfig.KNOWLEDGE_CAPABILITIES}\n` +
    `Reasoning: ${agentConfig.REASONING_APPROACH}\n` +
    `Format: ${agentConfig.RESPONSE_FORMAT}\n` +
    `Standards: ${agentConfig.FORMATTING_STANDARDS}\n` +
    `Security: ${agentConfig.SECURITY_REQUIREMENTS}`;

  const memories = state.metadata?.retrieved_memories;
  if (memories && memories.length > 0) {
    const memoryContext = memories.map((m: any, i: number) => `${i + 1}. ${m.content}`).join("\n");
    systemPrompt += `\n\nContext from previous conversations:\n${memoryContext}`;
  }

  let messages = state.messages;
  const hasSystemPrompt = messages.some((msg: BaseMessage) => msg._getType() === "system");

  if (!hasSystemPrompt) {
    messages = [new SystemMessage(systemPrompt), ...messages];
  }

  // Check if the model supports vision
  const modelName = agentConfig.MODEL_NAME || "";
  const supportsVision = isVisionModel(modelName);
  console.log("[AgentNode] Model:", modelName, "Vision support:", supportsVision);

  // Process messages - preserve multimodal content for vision models
  const sanitizedMessages = messages.map((msg) => {
    // If content is an array (multimodal), check what to do
    if (Array.isArray(msg.content)) {
      const hasImages = isMultimodalContent(msg.content);

      if (hasImages && supportsVision) {
        // Keep multimodal content for vision models
        console.log("[AgentNode] Preserving multimodal content for vision model");
        return msg;
      }

      // Extract text only for non-vision models or messages without images
      const textContent = msg.content
        .map((c: any) => (typeof c === "string" ? c : c.type === "text" ? c.text : ""))
        .filter(Boolean)
        .join("\n");

      const newMsg = Object.create(Object.getPrototypeOf(msg));
      Object.assign(newMsg, msg);
      newMsg.content = textContent || "[Image content - not supported by this model]";
      return newMsg;
    }
    return msg;
  });

  const response = await llmWithTools.invoke(sanitizedMessages);

  console.log("[AgentNode] Complete");
  return { messages: [response], model_calls: 1 };
}
