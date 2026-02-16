import { type AIMessage, ToolMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import { v4 as uuidv4 } from "uuid";
import { agentConfig } from "../../lib/config.js";
import type { AgentState, UIMessage } from "../state.js";
import { toolMap } from "../tools/index.js";

async function emitUIEvent(config: RunnableConfig, uiMessage: UIMessage): Promise<void> {
    const streamEvents = (config as any).streamEvents;
    if (streamEvents && typeof streamEvents === "function") {
        await streamEvents({
            event: "ui",
            data: uiMessage,
        });
    }
    console.log(`[UI Event] ${uiMessage.name}: ${uiMessage.props.status}`);
}

export async function ToolExecution(
    state: AgentState,
    config: RunnableConfig
): Promise<Partial<AgentState>> {
    const lastMessage = state.messages.at(-1);

    if (!lastMessage || lastMessage._getType() !== "ai") {
        console.log("[ToolExecution] No AI message found, skipping");
        return {};
    }

    const aiMessage = lastMessage as AIMessage;
    const toolCalls = aiMessage.tool_calls || [];

    if (toolCalls.length === 0) {
        console.log("[ToolExecution] No tool calls found, skipping");
        return {};
    }

    const toolMessages: ToolMessage[] = [];
    const uiMessages: UIMessage[] = [];
    let totalRetries = 0;

    console.log(`[ToolExecution] Executing ${toolCalls.length} tool(s)`);

    for (const toolCall of toolCalls) {
        const toolName = toolCall.name;
        const toolArgs = toolCall.args || {};
        const toolCallId = toolCall.id || uuidv4();

        const tool = toolMap[toolName];
        const uiMessageId = uuidv4();

        if (!tool) {
            console.error(`[ToolExecution] Tool "${toolName}" not found`);

            const errorUIMessage: UIMessage = {
                id: uiMessageId,
                name: toolName,
                props: {
                    toolName,
                    status: "failed",
                    args: toolArgs,
                    error: `Tool "${toolName}" not found`,
                    completedAt: Date.now(),
                },
                metadata: {
                    tool_call_id: toolCallId,
                    tool_name: toolName,
                },
            };

            uiMessages.push(errorUIMessage);
            await emitUIEvent(config, errorUIMessage);

            toolMessages.push(
                new ToolMessage({
                    content: `Error: Tool "${toolName}" not found`,
                    tool_call_id: toolCallId,
                    name: toolName,
                })
            );
            continue;
        }

        // Emit start UI message
        const startUIMessage: UIMessage = {
            id: uiMessageId,
            name: toolName,
            props: {
                toolName,
                status: "executing",
                args: toolArgs,
                startedAt: Date.now(),
            },
            metadata: {
                tool_call_id: toolCallId,
                tool_name: toolName,
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
                console.log(`[ToolExecution] Invoking ${toolName}...`);
                const toolResult = await (tool as any).invoke(toolArgs);
                result = typeof toolResult === "string" ? toolResult : JSON.stringify(toolResult);
                console.log(`[ToolExecution] ${toolName} completed`);

                // Emit completion UI message
                const completeUIMessage: UIMessage = {
                    id: uiMessageId,
                    name: toolName,
                    props: {
                        toolName,
                        status: "completed",
                        args: toolArgs,
                        result,
                        startedAt,
                        completedAt: Date.now(),
                    },
                    metadata: {
                        tool_call_id: toolCallId,
                        tool_name: toolName,
                    },
                };

                uiMessages.push(completeUIMessage);
                await emitUIEvent(config, completeUIMessage);

                break;
            } catch (error) {
                retries++;
                totalRetries++;
                const errorMessage = error instanceof Error ? error.message : String(error);
                console.error(
                    `[ToolExecution] ${toolName} failed (${retries}/${maxRetries}): ${errorMessage}`
                );

                if (retries >= maxRetries) {
                    result = `Error after ${retries} attempts: ${errorMessage}`;

                    const failUIMessage: UIMessage = {
                        id: uiMessageId,
                        name: toolName,
                        props: {
                            toolName,
                            status: "failed",
                            args: toolArgs,
                            error: errorMessage,
                            startedAt,
                            completedAt: Date.now(),
                        },
                        metadata: {
                            tool_call_id: toolCallId,
                            tool_name: toolName,
                        },
                    };

                    uiMessages.push(failUIMessage);
                    await emitUIEvent(config, failUIMessage);

                    break;
                }

                await new Promise((resolve) => setTimeout(resolve, 2 ** retries * 1000));
            }
        }

        toolMessages.push(
            new ToolMessage({
                content: result,
                tool_call_id: toolCallId,
                name: toolName,
            })
        );
    }

    console.log(`[ToolExecution] Completed ${toolMessages.length} tool(s)`);

    const updates: Partial<AgentState> = {
        messages: toolMessages,
        ui: uiMessages,
    };

    if (totalRetries > 0) {
        updates.middleware_metrics = {
            ...state.middleware_metrics,
            retries: totalRetries,
        };
    }

    return updates;
}
