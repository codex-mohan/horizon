import type { AIMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import { END, START, StateGraph } from "@langchain/langgraph";
import { FileSystemCheckpointer } from "./fs-checkpointer.js";
import { AgentNode } from "./nodes/Agent.js";
import { ApprovalGate } from "./nodes/ApprovalGate.js";
import { EndMiddleware } from "./nodes/EndMiddleware.js";
import { initializeMemory, MemoryRetrieval } from "./nodes/MemoryRetrieval.js";
import { StartMiddleware } from "./nodes/StartMiddleware.js";
import { ToolExecution } from "./nodes/ToolExecution.js";
import { type AgentState, AgentStateAnnotation, type ToolApprovalConfig } from "./state.js";
import { isDangerousTool } from "./tools/index.js";

initializeMemory();

function getToolApprovalConfig(config: RunnableConfig): ToolApprovalConfig {
  const configurable = config.configurable as Record<string, unknown> | undefined;
  return (
    (configurable?.tool_approval as ToolApprovalConfig) || {
      mode: "dangerous_only",
      auto_approve_tools: [],
      never_approve_tools: [],
    }
  );
}

function needsApproval(toolName: string, approvalConfig: ToolApprovalConfig): boolean {
  const { mode, auto_approve_tools, never_approve_tools } = approvalConfig;

  if (auto_approve_tools.includes(toolName)) {
    return false;
  }

  if (never_approve_tools.includes(toolName)) {
    return true;
  }

  switch (mode) {
    case "never_ask":
      return false;
    case "always_ask":
      return true;
    case "dangerous_only":
    default:
      return isDangerousTool(toolName);
  }
}

const routeAfterAgent = (
  state: AgentState,
  config: RunnableConfig
): "ApprovalGate" | "ToolExecution" | "EndMiddleware" => {
  const lastMessage = state.messages.at(-1);

  if (!lastMessage || lastMessage._getType() !== "ai") {
    return "EndMiddleware";
  }

  const aiMessage = lastMessage as AIMessage;
  const toolCalls = aiMessage.tool_calls || [];

  if (toolCalls.length === 0) {
    return "EndMiddleware";
  }

  const approvalConfig = getToolApprovalConfig(config);

  const anyNeedsApproval = toolCalls.some((tc) => needsApproval(tc.name, approvalConfig));

  if (anyNeedsApproval) {
    console.log("[Graph] Routing to ApprovalGate for tool approval");
    return "ApprovalGate";
  }

  console.log("[Graph] All tools auto-approved, routing to ToolExecution");
  return "ToolExecution";
};

const shouldContinue = (state: AgentState): "AgentNode" | "EndMiddleware" => {
  const maxCalls = state.metadata?.max_model_calls || 10;

  if (state.model_calls >= maxCalls) {
    console.warn(`[Graph] Max model calls (${maxCalls}) reached`);
    return "EndMiddleware";
  }

  return "AgentNode";
};

const routeAfterApproval = (state: AgentState): "ToolExecution" | "EndMiddleware" => {
  const lastMessage = state.messages.at(-1);

  if (lastMessage && lastMessage._getType() === "ai") {
    const aiMessage = lastMessage as AIMessage;
    if (aiMessage.content && typeof aiMessage.content === "string") {
      if (
        aiMessage.content.includes("unable to execute") ||
        aiMessage.content.includes("rejected")
      ) {
        console.log("[Graph] Tools rejected, ending");
        return "EndMiddleware";
      }
    }
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
