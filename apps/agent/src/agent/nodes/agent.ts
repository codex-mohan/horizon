import { type BaseMessage, SystemMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import { agentConfig } from "../../lib/config.js";
import { createLLM, createRuntimeLLM, type RuntimeModelConfig } from "../../lib/llm.js";
import { SYSTEM_PROMPT } from "../prompt.js";
import type { AgentGraphNode, AgentState } from "../state.js";
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

export const AgentNode: AgentGraphNode = async (
  state: AgentState,
  _config: RunnableConfig
): Promise<Partial<AgentState>> => {
  const modelConfig = _config.configurable?.model_config as RuntimeModelConfig | undefined;
  const modelSettings = _config.configurable?.model_settings as Record<string, unknown> | undefined;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let llm: any;
  let modelName: string;

  if (modelConfig?.provider && modelConfig.modelName) {
    llm = await createRuntimeLLM({
      provider: modelConfig.provider,
      modelName: modelConfig.modelName,
      temperature: modelConfig.temperature ?? agentConfig.TEMPERATURE,
      maxTokens: modelConfig.maxTokens ?? agentConfig.MAX_TOKENS,
      apiKey: modelConfig.apiKey,
      baseUrl: modelConfig.baseUrl,
      enableReasoning: modelConfig.enableReasoning,
      reasoningEffort: (modelConfig as any).reasoningEffort,
      thinkingBudget: (modelConfig as any).thinkingBudget,
    });
    modelName = modelConfig.modelName;
  } else {
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

  const invocationConfig: Record<string, unknown> = {};

  if (modelSettings) {
    if (modelSettings.topP !== undefined) invocationConfig.top_p = modelSettings.topP;
    if (modelSettings.topK !== undefined) invocationConfig.top_k = modelSettings.topK;
    if (modelSettings.frequencyPenalty !== undefined)
      invocationConfig.frequency_penalty = modelSettings.frequencyPenalty;
    if (modelSettings.presencePenalty !== undefined)
      invocationConfig.presence_penalty = modelSettings.presencePenalty;
  }

  const llmWithTools = llm.bindTools(
    tools,
    Object.keys(invocationConfig).length > 0 ? invocationConfig : undefined
  );

  let systemPrompt = SYSTEM_PROMPT;

  if (modelSettings?.systemPrompt) {
    systemPrompt += `\n\n<user_instructions>\n${modelSettings.systemPrompt}\n</user_instructions>`;
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

  const sanitizedMessages = messages.map((msg: BaseMessage) => {
    if (Array.isArray(msg.content)) {
      const hasImages = isMultimodalContent(msg.content);

      if (hasImages && supportsVision) {
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

  return { messages: [response], model_calls: 1 };
};
