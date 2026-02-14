import { ToolMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import type { StructuredTool } from "@langchain/core/tools";
import { v4 as uuidv4 } from "uuid";
import { agentConfig } from "../../lib/config.js";
import type { AgentState, ToolCall, UIMessage } from "../state.js";
import { toolMap } from "../tools/index.js";

/**
 * Helper to emit a custom event for real-time UI updates
 * This allows streaming UI status during tool execution
 */
interface ConfigWithStreamEvents extends RunnableConfig {
  streamEvents?: (event: { event: string; data: UIMessage }) => Promise<void>;
}

async function emitUIEvent(config: RunnableConfig, uiMessage: UIMessage): Promise<void> {
  // Check if we're in a streaming context with custom event emitter
  const typedConfig = config as ConfigWithStreamEvents;
  const streamEvents = typedConfig.streamEvents;
  if (streamEvents && typeof streamEvents === "function") {
    await streamEvents({
      event: "ui",
      data: uiMessage,
    });
  }

  // Also emit via console for debugging
  console.log(`[UI Event] ${uiMessage.name}: ${uiMessage.props.status}`);
}

function createUIMessage(
  id: string,
  toolCall: ToolCall,
  aiMessageId: string | undefined,
  status: string,
  extraProps: Record<string, unknown> = {}
): UIMessage {
  return {
    id,
    name: toolCall.name,
    props: {
      toolName: toolCall.name,
      status,
      args: toolCall.args,
      ...extraProps,
    },
    metadata: {
      message_id: aiMessageId,
      tool_call_id: toolCall.id,
      tool_name: toolCall.name,
    },
  };
}

async function executeToolWithRetry(
  tool: StructuredTool,
  toolCall: ToolCall,
  uiMessageId: string,
  aiMessageId: string | undefined,
  config: RunnableConfig,
  uiMessages: UIMessage[]
): Promise<{
  result: string;
  retries: number;
  status: "completed" | "failed";
}> {
  let retries = 0;
  const maxRetries = agentConfig.MAX_RETRIES || 3;
  const startedAt = Date.now();

  while (true) {
    try {
      const toolResult = await tool.invoke(toolCall.args);
      const result = typeof toolResult === "string" ? toolResult : JSON.stringify(toolResult);
      console.log(`[ToolExecution] ${toolCall.name} completed`);

      // Emit completion UI message (REAL-TIME)
      const completeUIMessage = createUIMessage(uiMessageId, toolCall, aiMessageId, "completed", {
        result,
        startedAt,
        completedAt: Date.now(),
      });

      uiMessages.push(completeUIMessage);
      await emitUIEvent(config, completeUIMessage);

      return { result, retries, status: "completed" };
    } catch (error) {
      retries++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(
        `[ToolExecution] ${toolCall.name} failed (${retries}/${maxRetries}): ${errorMessage}`
      );

      if (retries >= maxRetries) {
        const result = `Error after ${retries} attempts: ${errorMessage}`;

        // Emit failure UI message (REAL-TIME)
        const failUIMessage = createUIMessage(uiMessageId, toolCall, aiMessageId, "failed", {
          error: errorMessage,
          startedAt,
          completedAt: Date.now(),
        });

        uiMessages.push(failUIMessage);
        await emitUIEvent(config, failUIMessage);

        return { result, retries, status: "failed" };
      }

      await new Promise((resolve) => setTimeout(resolve, 2 ** retries * 1000));
    }
  }
}

async function handleMissingTool(
  toolCall: ToolCall,
  uiMessageId: string,
  aiMessageId: string | undefined,
  config: RunnableConfig,
  executedTools: ToolCall[],
  toolMessages: ToolMessage[],
  uiMessages: UIMessage[]
): Promise<void> {
  const errorUIMessage = createUIMessage(uiMessageId, toolCall, aiMessageId, "failed", {
    error: `Tool "${toolCall.name}" not found`,
    completedAt: Date.now(),
  });

  uiMessages.push(errorUIMessage);
  await emitUIEvent(config, errorUIMessage);

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
    })
  );
}

async function handleToolExecution(
  toolCall: ToolCall,
  tool: StructuredTool,
  uiMessageId: string,
  aiMessageId: string | undefined,
  config: RunnableConfig,
  executedTools: ToolCall[],
  toolMessages: ToolMessage[],
  uiMessages: UIMessage[]
): Promise<number> {
  // Emit initial UI message for tool execution start (REAL-TIME)
  const startUIMessage = createUIMessage(uiMessageId, toolCall, aiMessageId, "executing", {
    startedAt: Date.now(),
  });

  uiMessages.push(startUIMessage);
  await emitUIEvent(config, startUIMessage);

  const { result, retries, status } = await executeToolWithRetry(
    tool,
    toolCall,
    uiMessageId,
    aiMessageId,
    config,
    uiMessages
  );

  executedTools.push({
    ...toolCall,
    status,
    result,
    retry_count: retries,
    completed_at: Date.now(),
  });

  toolMessages.push(
    new ToolMessage({
      content: result,
      tool_call_id: toolCall.id,
      name: toolCall.name,
    })
  );

  return retries;
}

export async function ToolExecution(
  state: AgentState,
  config: RunnableConfig
): Promise<Partial<AgentState>> {
  const updates: Partial<AgentState> = {};
  const executedTools: typeof state.executed_tool_calls = [];
  const toolMessages: ToolMessage[] = [];
  const uiMessages: UIMessage[] = [];
  let totalRetries = 0;

  const approvedTools = state.pending_tool_calls?.filter((tc) => tc.status === "approved");

  if (!approvedTools || approvedTools.length === 0) {
    return updates;
  }

  const lastAiMessage = [...(state.messages || [])].reverse().find((m) => m._getType() === "ai");
  const aiMessageId = lastAiMessage?.id || undefined;

  console.log(`[ToolExecution] Executing ${approvedTools.length} tool(s)`);

  for (const toolCall of approvedTools) {
    const tool = toolMap[toolCall.name];
    const uiMessageId = uuidv4();

    if (!tool) {
      await handleMissingTool(
        toolCall,
        uiMessageId,
        aiMessageId,
        config,
        executedTools,
        toolMessages,
        uiMessages
      );
      continue;
    }

    const retries = await handleToolExecution(
      toolCall,
      tool as StructuredTool,
      uiMessageId,
      aiMessageId,
      config,
      executedTools,
      toolMessages,
      uiMessages
    );
    totalRetries += retries;
  }

  updates.executed_tool_calls = [...(state.executed_tool_calls || []), ...executedTools];
  updates.messages = toolMessages;
  updates.pending_tool_calls = [];
  updates.ui = uiMessages;

  if (totalRetries > 0) {
    updates.middleware_metrics = {
      ...state.middleware_metrics,
      retries: totalRetries,
    };
  }

  console.log(`[ToolExecution] Completed ${executedTools.length} tool(s)`);
  return updates;
}
