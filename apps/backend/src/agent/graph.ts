import type { AIMessage } from "@langchain/core/messages";
import { END, START, StateGraph } from "@langchain/langgraph";
import { FileSystemCheckpointer } from "./fs-checkpointer.js";
import { AgentNode } from "./nodes/Agent.js";
import { ApprovalGate } from "./nodes/ApprovalGate.js";
import { EndMiddleware } from "./nodes/EndMiddleware.js";
import { initializeMemory, MemoryRetrieval } from "./nodes/MemoryRetrieval.js";
// Import nodes
import { StartMiddleware } from "./nodes/StartMiddleware.js";
import { ToolExecution } from "./nodes/ToolExecution.js";
import { type AgentState, AgentStateAnnotation } from "./state.js";

// Initialize memory on import
initializeMemory();

/**
 * Conditional: Does the agent want to use tools?
 */
const shouldCheckApproval = (
  state: AgentState
): "ApprovalGate" | "EndMiddleware" => {
  const lastMessage = state.messages.at(-1);

  if (!lastMessage || lastMessage._getType() !== "ai") {
    return "EndMiddleware";
  }

  const aiMessage = lastMessage as AIMessage;
  const toolCalls = aiMessage.tool_calls || [];

  if (toolCalls.length > 0) {
    return "ApprovalGate";
  }

  return "EndMiddleware";
};

/**
 * Conditional: Execute tools or finish?
 */
const shouldExecuteTools = (
  state: AgentState
): "ToolExecution" | "EndMiddleware" => {
  const approvedTools = state.pending_tool_calls?.filter(
    (tc) => tc.status === "approved"
  );

  if (approvedTools && approvedTools.length > 0) {
    return "ToolExecution";
  }

  return "EndMiddleware";
};

/**
 * Conditional: Continue after tools or finish?
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
 * Multi-Node Graph Architecture
 *
 * Flow:
 * START → StartMiddleware → MemoryRetrieval → AgentNode → ApprovalGate → ToolExecution → (loop to AgentNode) → EndMiddleware → END
 */
export const graph = new StateGraph(AgentStateAnnotation)
  // Add all nodes with PascalCase names
  .addNode("StartMiddleware", StartMiddleware)
  .addNode("MemoryRetrieval", MemoryRetrieval)
  .addNode("AgentNode", AgentNode)
  .addNode("ApprovalGate", ApprovalGate)
  .addNode("ToolExecution", ToolExecution)
  .addNode("EndMiddleware", EndMiddleware)

  // Linear flow: Start → Memory → Agent
  .addEdge(START, "StartMiddleware")
  .addEdge("StartMiddleware", "MemoryRetrieval")
  .addEdge("MemoryRetrieval", "AgentNode")

  // Agent → ApprovalGate (conditional on tool calls)
  .addConditionalEdges("AgentNode", shouldCheckApproval, {
    ApprovalGate: "ApprovalGate",
    EndMiddleware: "EndMiddleware",
  })

  // ApprovalGate → ToolExecution (conditional on approved tools)
  .addConditionalEdges("ApprovalGate", shouldExecuteTools, {
    ToolExecution: "ToolExecution",
    EndMiddleware: "EndMiddleware",
  })

  // ToolExecution → AgentNode (loop back) or EndMiddleware (finish)
  .addConditionalEdges("ToolExecution", shouldContinue, {
    AgentNode: "AgentNode",
    EndMiddleware: "EndMiddleware",
  })

  // EndMiddleware → END
  .addEdge("EndMiddleware", END)

  .compile({ checkpointer: new FileSystemCheckpointer() });

console.log("[Graph] Multi-node graph compiled:");
console.log(
  "  Nodes: StartMiddleware → MemoryRetrieval → AgentNode → ApprovalGate → ToolExecution → EndMiddleware"
);
console.log(
  "  Flow: START → Start → Memory → Agent → [Approval → Tools → Agent loop] → End → END"
);
