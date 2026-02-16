import { type BaseMessage, SystemMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import { agentConfig } from "../../lib/config.js";
import { createLLM } from "../../lib/llm.js";
import type { AgentState } from "../state.js";
import { tools } from "../tools/index.js";

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

  const sanitizedMessages = messages.map((msg) => {
    if (Array.isArray(msg.content)) {
      const textContent = msg.content
        .map((c: any) => (typeof c === "string" ? c : c.type === "text" ? c.text : ""))
        .join("\n");
      const newMsg = Object.create(Object.getPrototypeOf(msg));
      Object.assign(newMsg, msg);
      newMsg.content = textContent;
      return newMsg;
    }
    return msg;
  });

  const response = await llmWithTools.invoke(sanitizedMessages);

  console.log("[AgentNode] Complete");
  return { messages: [response], model_calls: 1 };
}
