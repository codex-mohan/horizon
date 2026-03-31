import type { RunnableConfig } from "@langchain/core/runnables";
import type { AgentState } from "../state.js";

export async function EndMiddleware(
  state: AgentState,
  _config: RunnableConfig
): Promise<Partial<AgentState>> {
  const updates: Partial<AgentState> = {};

  const endTime = Date.now();
  const startTime = state.start_time || endTime;
  const executionTimeMs = endTime - startTime;

  updates.end_time = endTime;
  updates.middleware_metrics = {
    ...state.middleware_metrics,
    processing_time_ms: executionTimeMs,
  };

  return updates;
}
