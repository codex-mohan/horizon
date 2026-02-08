import { AgentState } from "../state.js";
import { RunnableConfig } from "@langchain/core/runnables";
import { ToolMessage } from "@langchain/core/messages";
import { toolMap } from "../tools/index.js";
import { agentConfig } from "../../lib/config.js";

export async function ToolExecution(
  state: AgentState,
  config: RunnableConfig,
): Promise<Partial<AgentState>> {
  const updates: Partial<AgentState> = {};
  const executedTools: typeof state.executed_tool_calls = [];
  const toolMessages: ToolMessage[] = [];
  let totalRetries = 0;

  const approvedTools = state.pending_tool_calls?.filter(
    (tc) => tc.status === "approved",
  );

  if (!approvedTools || approvedTools.length === 0) return updates;

  console.log(`[ToolExecution] Executing ${approvedTools.length} tool(s)`);

  for (const toolCall of approvedTools) {
    const tool = toolMap[toolCall.name];

    if (!tool) {
      executedTools.push({
        ...toolCall,
        status: "failed" as const,
        error: `Tool "${toolCall.name}" not found`,
        completed_at: Date.now(),
      });
      toolMessages.push(
        new ToolMessage({
          content: `Error: Tool "${toolCall.name}" not found`,
          tool_call_id: toolCall.id,
          name: toolCall.name,
        }),
      );
      continue;
    }

    let result: string;
    let retries = 0;
    const maxRetries = agentConfig.MAX_RETRIES || 3;

    while (true) {
      try {
        const toolResult = await (tool as any).invoke(toolCall.args);
        result =
          typeof toolResult === "string"
            ? toolResult
            : JSON.stringify(toolResult);
        console.log(`[ToolExecution] ${toolCall.name} completed`);
        break;
      } catch (error) {
        retries++;
        totalRetries++;
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(
          `[ToolExecution] ${toolCall.name} failed (${retries}/${maxRetries}): ${errorMessage}`,
        );

        if (retries >= maxRetries) {
          result = `Error after ${retries} attempts: ${errorMessage}`;
          break;
        }

        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, retries) * 1000),
        );
      }
    }

    executedTools.push({
      ...toolCall,
      status:
        retries >= maxRetries ? ("failed" as const) : ("completed" as const),
      result,
      retry_count: retries,
      completed_at: Date.now(),
    });

    toolMessages.push(
      new ToolMessage({
        content: result,
        tool_call_id: toolCall.id,
        name: toolCall.name,
      }),
    );
  }

  updates.executed_tool_calls = [
    ...(state.executed_tool_calls || []),
    ...executedTools,
  ];
  updates.messages = toolMessages;
  updates.pending_tool_calls = [];

  if (totalRetries > 0) {
    updates.middleware_metrics = {
      ...state.middleware_metrics,
      retries: totalRetries,
    };
  }

  console.log(`[ToolExecution] Completed ${executedTools.length} tool(s)`);
  return updates;
}
