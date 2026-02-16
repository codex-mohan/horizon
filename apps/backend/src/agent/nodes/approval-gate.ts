import { AIMessage, ToolMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import { interrupt } from "@langchain/langgraph";
import type { AgentState } from "../state.js";
import {
    filterToolsNeedingApproval,
    getToolApprovalConfig,
    getToolRiskLevel,
} from "../tools/index.js";

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
 * Handles human-in-the-loop approval for tool calls.
 * Uses LangGraph's interrupt() for pausing execution.
 *
 * Note: This node is only reached when tools need approval (filtered by routeAfterAgent).
 */
export async function ApprovalGate(
    state: AgentState,
    config: RunnableConfig
): Promise<Partial<AgentState>> {
    const lastMessage = state.messages.at(-1);

    // Safety check - should not happen due to routing, but handle gracefully
    if (!lastMessage || lastMessage._getType() !== "ai") {
        console.log("[ApprovalGate] No AI message found, skipping");
        return {};
    }

    const aiMessage = lastMessage as AIMessage;
    const toolCalls = aiMessage.tool_calls || [];

    // Safety check - should not happen due to routing
    if (toolCalls.length === 0) {
        console.log("[ApprovalGate] No tool calls found, skipping");
        return {};
    }

    // Get tools that need approval (using shared utility)
    const approvalConfig = getToolApprovalConfig(config);
    const toolsNeedingApproval = filterToolsNeedingApproval(toolCalls, approvalConfig);

    // Should not happen due to routing, but handle gracefully
    if (toolsNeedingApproval.length === 0) {
        console.log("[ApprovalGate] All tools auto-approved (unexpected routing)");
        return {};
    }

    console.log(
        `[ApprovalGate] ${toolsNeedingApproval.length} tool(s) need approval:`,
        toolsNeedingApproval.map((t) => t.name)
    );

    // Build HITL request format matching LangGraph's expected structure
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

    console.log("[ApprovalGate] Calling interrupt() with HITL request");

    // Use LangGraph's interrupt() - this pauses execution and returns decisions when resumed
    const decisions = interrupt(hitlRequest);

    console.log("[ApprovalGate] interrupt() returned:", typeof decisions, Array.isArray(decisions));
    console.log("[ApprovalGate] decisions value:", JSON.stringify(decisions));

    // If we get here, we've been resumed with decisions
    if (!decisions) {
        console.log("[ApprovalGate] No decisions received (null/undefined), returning empty");
        return {};
    }

    if (!Array.isArray(decisions)) {
        console.log("[ApprovalGate] Decisions is not an array:", typeof decisions);
        return {};
    }

    // Process decisions and handle rejections
    const newMessages: Array<ToolMessage | AIMessage> = [];
    const rejectedToolNames: string[] = [];

    for (let i = 0; i < toolsNeedingApproval.length; i++) {
        const tc = toolsNeedingApproval[i];
        if (!tc) continue;

        const decision = decisions[i] as HitlDecision | undefined;
        if (!decision) continue;

        console.log(`[ApprovalGate] Processing decision ${i}:`, decision.type);

        if (decision.type === "reject") {
            console.log("[ApprovalGate] Tool rejected:", tc.name);
            rejectedToolNames.push(tc.name);

            newMessages.push(
                new ToolMessage({
                    content: `Tool execution rejected: User declined`,
                    tool_call_id: tc.id || `unknown_${Date.now()}_${i}`,
                    name: tc.name,
                })
            );
        } else if (decision.type === "approve") {
            console.log("[ApprovalGate] Tool approved:", tc.name);
        }
    }

    // If any tools were rejected, set the rejection flag and add explanation
    if (rejectedToolNames.length > 0) {
        const rejectionMessage = new AIMessage({
            content: `I was unable to execute the following tool(s) because they were rejected: ${rejectedToolNames.join(", ")}.`,
        });

        return {
            messages: [...newMessages, rejectionMessage],
            tools_rejected: true,
        } as Partial<AgentState>;
    }

    console.log("[ApprovalGate] All tools approved, continuing to ToolExecution");
    return { tools_rejected: false };
}
