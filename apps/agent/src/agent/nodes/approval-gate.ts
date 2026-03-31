import { type AIMessage, ToolMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import { interrupt } from "@langchain/langgraph";
import type { AgentState } from "../state.js";
import { getToolApprovalConfig, getToolRiskLevel, needsApproval } from "../tools/index.js";

interface ActionRequest {
  name: string;
  arguments: Record<string, unknown>;
  description: string;
}

interface ReviewConfig {
  action_name: string;
  allowed_decisions: string[];
}

interface HitlRequest {
  action_requests: ActionRequest[];
  review_configs: ReviewConfig[];
}

interface HitlDecision {
  type: "approve" | "reject" | "edit";
  message?: string;
  edited_action?: {
    name: string;
    args: Record<string, unknown>;
  };
}

/**
 * ApprovalGate Node
 *
 * Central gate for ALL tool calls. Handles:
 * 1. Auto-approval for tools that don't need user confirmation
 * 2. Human-in-the-loop approval for tools that need it
 * 3. Returns ToolMessage for rejected tools so LLM can respond
 *
 * Flow:
 * - All tool calls from AgentNode come here
 * - Tools are auto-approved or need user approval based on config
 * - Rejected tools get ToolMessage feedback for LLM
 * - Approved tools proceed to ToolExecution
 */
export async function ApprovalGate(
  state: AgentState,
  config: RunnableConfig
): Promise<Partial<AgentState>> {
  const lastMessage = state.messages.at(-1);

  if (!lastMessage || lastMessage._getType() !== "ai") {
    return { tools_rejected: false };
  }

  const aiMessage = lastMessage as AIMessage;
  const toolCalls = aiMessage.tool_calls || [];

  if (toolCalls.length === 0) {
    return { tools_rejected: false };
  }

  const approvalConfig = getToolApprovalConfig(config);

  // Separate tools into auto-approved and need-approval
  const autoApprovedTools: typeof toolCalls = [];
  const toolsNeedingApproval: typeof toolCalls = [];

  for (const tc of toolCalls) {
    if (needsApproval(tc.name, approvalConfig)) {
      toolsNeedingApproval.push(tc);
    } else {
      autoApprovedTools.push(tc);
    }
  }

  // If no tools need approval, proceed directly
  if (toolsNeedingApproval.length === 0) {
    return { tools_rejected: false };
  }

  // Build HITL request for tools needing approval
  const hitlRequest: HitlRequest = {
    action_requests: toolsNeedingApproval.map((tc) => ({
      name: tc.name,
      arguments: tc.args || {},
      description: `Tool: ${tc.name}\nRisk: ${getToolRiskLevel(tc.name)}\nArgs: ${JSON.stringify(tc.args || {})}`,
    })),
    review_configs: toolsNeedingApproval.map((tc) => ({
      action_name: tc.name,
      allowed_decisions: ["approve", "reject"],
    })),
  };

  // Use LangGraph's interrupt() - pauses execution until user responds
  const decisions = interrupt(hitlRequest);

  if (!decisions || !Array.isArray(decisions)) {
    // Return ToolMessage for all tools needing approval
    const toolMessages = toolsNeedingApproval.map(
      (tc) =>
        new ToolMessage(
          "Tool execution rejected: No valid approval received",
          tc.id || `unknown_${Date.now()}`,
          tc.name
        )
    );
    return {
      messages: toolMessages,
      tools_rejected: true,
    };
  }

  // Process decisions
  const toolMessages: ToolMessage[] = [];
  const rejectedToolNames: string[] = [];
  const approvedToolIds = new Set<string>();

  for (let i = 0; i < toolsNeedingApproval.length; i++) {
    const tc = toolsNeedingApproval[i];
    if (!tc) continue;

    const decision = decisions[i] as HitlDecision | undefined;

    if (!decision || decision.type === "reject") {
      rejectedToolNames.push(tc.name);

      // Return ToolMessage so LLM knows the tool was rejected
      toolMessages.push(
        new ToolMessage(
          `Tool execution rejected by user. ${decision?.message || "User declined to execute this tool."}`,
          tc.id || `unknown_${Date.now()}_${i}`,
          tc.name
        )
      );
    } else if (decision.type === "approve") {
      if (tc.id) {
        approvedToolIds.add(tc.id);
      }
    }
  }

  // If all tools needing approval were rejected
  if (rejectedToolNames.length === toolsNeedingApproval.length) {
    return {
      messages: toolMessages,
      tools_rejected: true,
    };
  }

  // If some tools were rejected but others approved
  if (rejectedToolNames.length > 0) {
    // Return ToolMessages for rejected tools, but allow approved ones to proceed
    return {
      messages: toolMessages,
      tools_rejected: false, // Allow approved tools to execute
    };
  }

  // All tools approved

  return { tools_rejected: false };
}
