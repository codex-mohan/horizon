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

initializeMemory();

/**
 * Route after AgentNode: tool calls always go to ApprovalGate
 */
const routeAfterAgent = (state: AgentState): "ApprovalGate" | "EndMiddleware" => {
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

  // All tool calls go through ApprovalGate
  console.log("[Graph] Routing to ApprovalGate for tool processing");
  return "ApprovalGate";
};

/**
 * Route after ApprovalGate:
 * - If tools were rejected -> AgentNode (with ToolMessage feedback)
 * - If tools approved -> ToolExecution
 */
const routeAfterApproval = (state: AgentState): "ToolExecution" | "AgentNode" => {
  // If tools were rejected, route back to AgentNode with feedback
  if (state.tools_rejected) {
    console.log("[Graph] Tools rejected, routing to AgentNode with feedback");
    return "AgentNode";
  }

  // Tools approved, execute them
  return "ToolExecution";
};

/**
 * Check if we should continue the agent loop after ToolExecution
 */
const shouldContinue = (state: AgentState): "AgentNode" | "EndMiddleware" => {
  const envLimit = process.env.MAX_MODEL_CALLS ? parseInt(process.env.MAX_MODEL_CALLS, 10) : 50;
  const maxCalls = state.metadata?.max_model_calls || envLimit;

  if (state.model_calls >= maxCalls) {
    console.warn(`[Graph] Max model calls (${maxCalls}) reached`);
    return "EndMiddleware";
  }

  return "AgentNode";
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

  // AgentNode -> ApprovalGate (if tools) or EndMiddleware (if no tools)
  .addConditionalEdges("AgentNode", routeAfterAgent, {
    ApprovalGate: "ApprovalGate",
    EndMiddleware: "EndMiddleware",
  })

  // ApprovalGate -> ToolExecution (approved) or AgentNode (rejected with feedback)
  .addConditionalEdges("ApprovalGate", routeAfterApproval, {
    ToolExecution: "ToolExecution",
    AgentNode: "AgentNode",
  })

  // ToolExecution -> AgentNode (continue) or EndMiddleware (max calls)
  .addConditionalEdges("ToolExecution", shouldContinue, {
    AgentNode: "AgentNode",
    EndMiddleware: "EndMiddleware",
  })

  .addEdge("EndMiddleware", END)

  .compile({ checkpointer: new FileSystemCheckpointer() });

console.log("[Graph] Simplified graph compiled:");
console.log("  Flow: START → Start → Memory → Agent → ApprovalGate → [Tools | Agent] → End → END");
console.log("  - All tool calls go through ApprovalGate");
console.log("  - Rejected tools return to AgentNode with ToolMessage feedback");
