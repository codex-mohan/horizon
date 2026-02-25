import { type BaseMessage, SystemMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import { agentConfig } from "../../lib/config.js";
import { createLLM, createRuntimeLLM, type RuntimeModelConfig } from "../../lib/llm.js";
import type { AgentState } from "../state.js";
import { tools } from "../tools/index.js";

function isMultimodalContent(content: unknown): boolean {
  if (!Array.isArray(content)) return false;
  return content.some(
    (block) => typeof block === "object" && block !== null && block.type === "image_url"
  );
}

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
    "qwen",
  ];
  const lowerModel = modelName.toLowerCase();
  return visionModels.some((vm) => lowerModel.includes(vm));
}

export async function AgentNode(
  state: AgentState,
  _config: RunnableConfig
): Promise<Partial<AgentState>> {
  console.log("[AgentNode] Processing with config:", _config.configurable?.model_config);

  const modelConfig = _config.configurable?.model_config as RuntimeModelConfig | undefined;
  const modelSettings = _config.configurable?.model_settings as Record<string, unknown> | undefined;

  let llm;
  let modelName: string;

  if (modelConfig && modelConfig.provider && modelConfig.modelName) {
    console.log(
      `[AgentNode] Using runtime model config: ${modelConfig.provider}/${modelConfig.modelName}`
    );
    llm = await createRuntimeLLM({
      provider: modelConfig.provider,
      modelName: modelConfig.modelName,
      temperature: modelConfig.temperature ?? agentConfig.TEMPERATURE,
      maxTokens: modelConfig.maxTokens ?? agentConfig.MAX_TOKENS,
      apiKey: modelConfig.apiKey,
      baseUrl: modelConfig.baseUrl,
    });
    modelName = modelConfig.modelName;
  } else {
    console.log("[AgentNode] Using default config from environment");
    const mergedConfig = { ...agentConfig };
    if (modelSettings) {
      if (modelSettings.temperature !== undefined)
        mergedConfig.TEMPERATURE = modelSettings.temperature as number;
      if (modelSettings.maxTokens !== undefined)
        mergedConfig.MAX_TOKENS = modelSettings.maxTokens as number;
    }
    llm = await createLLM(mergedConfig);
    modelName = agentConfig.MODEL_NAME;
  }

  if (!llm.bindTools) {
    throw new Error("LLM does not support tool binding");
  }

  let llmWithTools = llm.bindTools(tools);

  if (modelSettings) {
    const callArgs: Record<string, unknown> = {};
    if (modelSettings.topP !== undefined) callArgs.top_p = modelSettings.topP;
    if (modelSettings.topK !== undefined) callArgs.top_k = modelSettings.topK;
    if (modelSettings.frequencyPenalty !== undefined)
      callArgs.frequency_penalty = modelSettings.frequencyPenalty;
    if (modelSettings.presencePenalty !== undefined)
      callArgs.presence_penalty = modelSettings.presencePenalty;

    if (Object.keys(callArgs).length > 0) {
      llmWithTools = llmWithTools.bind(callArgs);
    }
  }

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

  if (modelSettings?.systemPrompt) {
    systemPrompt += `\n\nUser Override/Custom Instructions:\n${modelSettings.systemPrompt}`;
  }

  const memories = state.metadata?.retrieved_memories;
  if (memories && memories.length > 0) {
    const memoryContext = memories
      .map((m: unknown, i: number) => {
        const mem = m as { content?: string };
        return `${i + 1}. ${mem.content}`;
      })
      .join("\n");
    systemPrompt += `\n\nContext from previous conversations:\n${memoryContext}`;
  }

  let messages = state.messages;
  const hasSystemPrompt = messages.some((msg: BaseMessage) => msg._getType() === "system");

  if (!hasSystemPrompt) {
    messages = [new SystemMessage(systemPrompt), ...messages];
  }

  const supportsVision = isVisionModel(modelName);
  console.log("[AgentNode] Model:", modelName, "Vision support:", supportsVision);

  const sanitizedMessages = messages.map((msg) => {
    if (Array.isArray(msg.content)) {
      const hasImages = isMultimodalContent(msg.content);

      if (hasImages && supportsVision) {
        console.log("[AgentNode] Preserving multimodal content for vision model");
        return msg;
      }

      const textContent = msg.content
        .map((c: unknown) => {
          if (typeof c === "string") return c;
          const block = c as { type?: string; text?: string };
          return block.type === "text" ? block.text : "";
        })
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
