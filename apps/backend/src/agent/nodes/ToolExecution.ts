import { ToolMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import { v4 as uuidv4 } from "uuid";
import { agentConfig } from "../../lib/config.js";
import type { AgentState, UIMessage } from "../state.js";
import { toolMap } from "../tools/index.js";

/**
 * Helper to emit a custom event for real-time UI updates
 * This allows streaming UI status during tool execution
 */
async function emitUIEvent(
  config: RunnableConfig,
  uiMessage: UIMessage
): Promise<void> {
  // Check if we're in a streaming context with custom event emitter
  const streamEvents = (config as any).streamEvents;
  if (streamEvents && typeof streamEvents === "function") {
    await streamEvents({
      event: "ui",
      data: uiMessage,
    });
  }

  // Also emit via console for debugging
  console.log(`[UI Event] ${uiMessage.name}: ${uiMessage.props.status}`);
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

  const approvedTools = state.pending_tool_calls?.filter(
    (tc) => tc.status === "approved"
  );

  if (!approvedTools || approvedTools.length === 0) {
    return updates;
  }

  console.log(`[ToolExecution] Executing ${approvedTools.length} tool(s)`);

  for (const toolCall of approvedTools) {
    const tool = toolMap[toolCall.name];
    const uiMessageId = uuidv4();

    if (!tool) {
      // Emit UI message for error
      const errorUIMessage: UIMessage = {
        id: uiMessageId,
        name: toolCall.name,
        props: {
          toolName: toolCall.name,
          status: "failed",
          args: toolCall.args,
          error: `Tool "${toolCall.name}" not found`,
          completedAt: Date.now(),
        },
        metadata: {
          tool_call_id: toolCall.id,
          tool_name: toolCall.name,
        },
      };

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
      continue;
    }

    // Emit initial UI message for tool execution start (REAL-TIME)
    const startUIMessage: UIMessage = {
      id: uiMessageId,
      name: toolCall.name,
      props: {
        toolName: toolCall.name,
        status: "executing",
        args: toolCall.args,
        startedAt: Date.now(),
      },
      metadata: {
        tool_call_id: toolCall.id,
        tool_name: toolCall.name,
      },
    };

    uiMessages.push(startUIMessage);
    await emitUIEvent(config, startUIMessage);

    let result: string;
    let retries = 0;
    const maxRetries = agentConfig.MAX_RETRIES || 3;
    const startedAt = Date.now();

    while (true) {
      try {
        const toolResult = await (tool as any).invoke(toolCall.args);
        result =
          typeof toolResult === "string"
            ? toolResult
            : JSON.stringify(toolResult);
        console.log(`[ToolExecution] ${toolCall.name} completed`);

        // Emit completion UI message (REAL-TIME)
        const completeUIMessage: UIMessage = {
          id: uiMessageId,
          name: toolCall.name,
          props: {
            toolName: toolCall.name,
            status: "completed",
            args: toolCall.args,
            result,
            startedAt,
            completedAt: Date.now(),
          },
          metadata: {
            tool_call_id: toolCall.id,
            tool_name: toolCall.name,
          },
        };

        uiMessages.push(completeUIMessage);
        await emitUIEvent(config, completeUIMessage);

        break;
      } catch (error) {
        retries++;
        totalRetries++;
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(
          `[ToolExecution] ${toolCall.name} failed (${retries}/${maxRetries}): ${errorMessage}`
        );

        if (retries >= maxRetries) {
          result = `Error after ${retries} attempts: ${errorMessage}`;

          // Emit failure UI message (REAL-TIME)
          const failUIMessage: UIMessage = {
            id: uiMessageId,
            name: toolCall.name,
            props: {
              toolName: toolCall.name,
              status: "failed",
              args: toolCall.args,
              error: errorMessage,
              startedAt,
              completedAt: Date.now(),
            },
            metadata: {
              tool_call_id: toolCall.id,
              tool_name: toolCall.name,
            },
          };

          uiMessages.push(failUIMessage);
          await emitUIEvent(config, failUIMessage);

          break;
        }

        await new Promise((resolve) =>
          setTimeout(resolve, 2 ** retries * 1000)
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
      })
    );
  }

  updates.executed_tool_calls = [
    ...(state.executed_tool_calls || []),
    ...executedTools,
  ];
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
