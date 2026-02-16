import type { AIMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import { END, START, StateGraph } from "@langchain/langgraph";
import { FileSystemCheckpointer } from "./fs-checkpointer.js";
import { AgentNode } from "./nodes/agent.js";
import { ApprovalGate } from "./nodes/approval-gate.js";
import { EndMiddleware } from "./nodes/end-middleware.js";
import { initializeMemory, MemoryRetrieval } from "./nodes/memory-retrieval.js";
import { StartMiddleware } from "./nodes/start-middleware.js";
import { ToolExecution } from "./nodes/tool-execution.js";
import { type AgentState, AgentStateAnnotation } from "./state.js";
import { anyNeedsApproval, getToolApprovalConfig } from "./tools/index.js";

initializeMemory();

/**
 * Route after AgentNode based on tool calls and approval requirements
 */
const routeAfterAgent = (
  state: AgentState,
  config: RunnableConfig
): "ApprovalGate" | "ToolExecution" | "EndMiddleware" => {
  const lastMessage = state.messages.at(-1);

  // No message or not AI message -> end
  if (!lastMessage || lastMessage._getType() !== "ai") {
    return "EndMiddleware";
  }

  const aiMessage = lastMessage as AIMessage;
  const toolCalls = aiMessage.tool_calls || [];

  // No tool calls -> end
  if (toolCalls.length === 0) {
    return "EndMiddleware";
  }

  // Check if any tools need approval
  const approvalConfig = getToolApprovalConfig(config);

  if (anyNeedsApproval(toolCalls, approvalConfig)) {
    console.log("[Graph] Routing to ApprovalGate for tool approval");
    return "ApprovalGate";
  }

  console.log("[Graph] All tools auto-approved, routing to ToolExecution");
  return "ToolExecution";
};

/**
 * Check if we should continue the agent loop
 */
const shouldContinue = (state: AgentState): "AgentNode" | "EndMiddleware" => {
  const maxCalls = state.metadata?.max_model_calls || 10;

  if (state.model_calls >= maxCalls) {
    console.warn(`[Graph] Max model calls (${maxCalls}) reached`);
    return "EndMiddleware";
  }

  return "AgentNode";
};

/**
 * Route after ApprovalGate based on whether tools were rejected
 * Uses state.tools_rejected flag instead of fragile string matching
 */
const routeAfterApproval = (state: AgentState): "ToolExecution" | "EndMiddleware" => {
  // Check the rejection flag set by ApprovalGate
  if (state.tools_rejected) {
    console.log("[Graph] Tools rejected, ending");
    return "EndMiddleware";
  }

  return "ToolExecution";
};

export const graph = new StateGraph(AgentStateAnnotation)
  .addNode("StartMiddleware", StartMiddleware)
  .addNode("MemoryRetrieval", MemoryRetrieval)
  .addNode("AgentNode", AgentNode)
  .addNode("ApprovalGate", ApprovalGate)
  .addNode("ToolExecution", ToolExecution)
  .addNode("EndMiddleware", EndMiddleware)

  .addEdge(START, "StartMiddleware")
  .addEdge("StartMiddleware", "MemoryRetrieval")
  .addEdge("MemoryRetrieval", "AgentNode")

  .addConditionalEdges("AgentNode", routeAfterAgent, {
    ApprovalGate: "ApprovalGate",
    ToolExecution: "ToolExecution",
    EndMiddleware: "EndMiddleware",
  })

  .addConditionalEdges("ApprovalGate", routeAfterApproval, {
    ToolExecution: "ToolExecution",
    EndMiddleware: "EndMiddleware",
  })

  .addConditionalEdges("ToolExecution", shouldContinue, {
    AgentNode: "AgentNode",
    EndMiddleware: "EndMiddleware",
  })

  .addEdge("EndMiddleware", END)

  .compile({ checkpointer: new FileSystemCheckpointer() });

console.log("[Graph] Multi-node graph compiled:");
console.log(
  "  Nodes: StartMiddleware → MemoryRetrieval → AgentNode → ApprovalGate/ToolExecution → EndMiddleware"
);
console.log("  Flow: START → Start → Memory → Agent → [Approval → Tools → Agent loop] → End → END");
