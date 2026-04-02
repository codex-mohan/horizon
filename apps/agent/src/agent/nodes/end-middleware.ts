import type { RunnableConfig } from "@langchain/core/runnables";
import type { AgentGraphNode, AgentState } from "../state.js";

export const EndMiddleware: AgentGraphNode = async (
  state: AgentState,
  _config: RunnableConfig
): Promise<Partial<AgentState>> => {
  const endTime = Date.now();
  const startTime = state.start_time || endTime;
  const executionTimeMs = endTime - startTime;

  return {
    end_time: endTime,
    middleware_metrics: {
      ...state.middleware_metrics,
      processing_time_ms: executionTimeMs,
    },
  };
};
