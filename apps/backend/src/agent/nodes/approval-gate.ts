import type { AIMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import type { AgentState } from "../state.js";

// biome-ignore lint/suspicious/useAwait: LangGraph expects async node functions
export async function ApprovalGate(
  state: AgentState,
  _config: RunnableConfig
): Promise<Partial<AgentState>> {
  const lastMessage = state.messages.at(-1);

  if (!lastMessage || lastMessage._getType() !== "ai") {
    return {};
  }

  const aiMessage = lastMessage as AIMessage;
  const toolCalls = aiMessage.tool_calls || [];

  if (toolCalls.length === 0) {
    return {};
  }

  console.log(`[ApprovalGate] Processing ${toolCalls.length} tool call(s)`);

  const DANGEROUS_TOOLS = ["shell_execute", "file_write", "file_delete"];
  const pendingApprovals = toolCalls.filter((tc) => DANGEROUS_TOOLS.includes(tc.name));

  if (pendingApprovals.length > 0) {
    console.log("[ApprovalGate] Auto-approving dangerous tools (HITL skipped)");
  }

  return {
    pending_tool_calls: toolCalls.map((tc) => ({
      id: tc.id || `call_${Date.now()}`,
      name: tc.name,
      args: tc.args || {},
      status: "approved" as const,
      retry_count: 0,
    })),
  };
}
