import type { RunnableConfig } from "@langchain/core/runnables";
import type { AgentState } from "../state.js";

export async function EndMiddleware(
    state: AgentState,
    _config: RunnableConfig
): Promise<Partial<AgentState>> {
    const updates: Partial<AgentState> = {};

    console.log("[EndMiddleware] Finalizing...");

    const endTime = Date.now();
    const startTime = state.start_time || endTime;
    const executionTimeMs = endTime - startTime;

    updates.end_time = endTime;
    updates.middleware_metrics = {
        ...state.middleware_metrics,
        processing_time_ms: executionTimeMs,
    };

    console.log("[EndMiddleware] Summary:");
    console.log(`  - Time: ${executionTimeMs}ms`);
    console.log(`  - Model Calls: ${state.model_calls}`);
    console.log(`  - Tools: ${state.executed_tool_calls?.length || 0}`);
    console.log(`  - PII: ${state.middleware_metrics?.pii_detected}`);

    return updates;
}
