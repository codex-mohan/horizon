import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import { v4 as uuidv4 } from "uuid";
import { agentConfig } from "../../lib/config.js";
import { createRuntimeLLM } from "../../lib/llm.js";
import type { SubAgentConfig, SubAgentResult } from "../state.js";
import { toolMap } from "../tools/index.js";
import { workerEventEmitter } from "./events.js";

/**
 * Get tools by name from the global tool map
 */
function getToolsForNames(names: string[]) {
  return names.map((name) => toolMap[name]).filter((tool) => tool !== undefined);
}

/**
 * Worker function - executes a single task
 * This is a generic agent that can be fully configured by the main agent
 */
export async function runWorker(config: SubAgentConfig): Promise<SubAgentResult> {
  const startTime = Date.now();

  console.log(`[Worker ${config.id}] Starting task: ${config.name}`);
  console.log(`[Worker ${config.id}] Tools: ${config.tools.join(", ")}`);

  workerEventEmitter.emitWorkerStarted(config);

  try {
    const llm = await createRuntimeLLM(
      config.modelConfig || {
        provider: agentConfig.MODEL_PROVIDER as
          | "openai"
          | "anthropic"
          | "google"
          | "ollama"
          | "groq"
          | "nvidia_nim",
        modelName: agentConfig.MODEL_NAME,
        apiKey:
          agentConfig.MODEL_PROVIDER === "openai"
            ? agentConfig.OPENAI_API_KEY
            : agentConfig.MODEL_PROVIDER === "anthropic"
              ? agentConfig.ANTHROPIC_API_KEY
              : agentConfig.MODEL_PROVIDER === "google"
                ? agentConfig.GOOGLE_API_KEY
                : agentConfig.MODEL_PROVIDER === "groq"
                  ? agentConfig.GROQ_API_KEY
                  : agentConfig.MODEL_PROVIDER === "nvidia_nim"
                    ? agentConfig.NVIDIA_NIM_API_KEY
                    : undefined,
        baseUrl: agentConfig.BASE_URL,
      }
    );

    workerEventEmitter.emitWorkerProgress(
      config.id,
      config.name,
      "initializing",
      "Creating LLM instance"
    );

    const availableTools = getToolsForNames(config.tools);
    console.log(`[Worker ${config.id}] Bound ${availableTools.length} tools`);

    workerEventEmitter.emitWorkerProgress(
      config.id,
      config.name,
      "running",
      `${availableTools.length} tools bound`
    );

    // biome-ignore: LangChain LLM typing requires any here
    const llmWithTools = (llm as any).bindTools ? (llm as any).bindTools(availableTools) : llm;

    const systemMessage = new AIMessage({
      content: config.systemPrompt,
    });

    // biome-ignore: Messages typed as any for LangChain compatibility
    let messages: any[] = [
      systemMessage,
      new HumanMessage({ content: config.context?.task_description || config.name }),
    ];

    const maxIterations = 15;
    let iteration = 0;

    while (iteration < maxIterations) {
      iteration++;

      workerEventEmitter.emitWorkerProgress(
        config.id,
        config.name,
        "running",
        `Iteration ${iteration}/${maxIterations}`
      );

      const response = await llmWithTools.invoke(messages);

      messages = [...messages, response];

      if (!response.tool_calls || response.tool_calls.length === 0) {
        console.log(`[Worker ${config.id}] No more tool calls, finishing.`);
        break;
      }

      for (const toolCall of response.tool_calls) {
        workerEventEmitter.emitWorkerProgress(
          config.id,
          config.name,
          "tool_call",
          `Calling ${toolCall.name}`,
          {
            name: toolCall.name,
            args: toolCall.args as Record<string, unknown>,
          }
        );

        const tool = toolMap[toolCall.name];
        if (!tool) {
          const errorMsg = `Tool not found: ${toolCall.name}`;
          console.error(`[Worker ${config.id}] ${errorMsg}`);
          messages = [
            ...messages,
            new ToolMessage({
              content: errorMsg,
              tool_call_id: toolCall.id,
              name: toolCall.name,
            }),
          ];
          continue;
        }

        try {
          const args = toolCall.args as Record<string, unknown>;
          // biome-ignore: LangChain tool typing requires any
          const result = await (tool as any).invoke(args);

          const resultStr = typeof result === "string" ? result : JSON.stringify(result);
          messages = [
            ...messages,
            new ToolMessage({
              content: resultStr,
              tool_call_id: toolCall.id,
              name: toolCall.name,
            }),
          ];

          workerEventEmitter.emitWorkerProgress(
            config.id,
            config.name,
            "running",
            `Completed ${toolCall.name}`
          );
        } catch (toolError) {
          const errorMsg = toolError instanceof Error ? toolError.message : String(toolError);
          console.error(`[Worker ${config.id}] Tool error: ${errorMsg}`);
          messages = [
            ...messages,
            new ToolMessage({
              content: `Error: ${errorMsg}`,
              tool_call_id: toolCall.id,
              name: toolCall.name,
            }),
          ];
        }
      }
    }

    const lastMessage = messages[messages.length - 1];
    const output = (lastMessage?.content as string) || "";

    const executionTime = Date.now() - startTime;
    console.log(`[Worker ${config.id}] Completed in ${executionTime}ms`);

    const result: SubAgentResult = {
      task_id: config.id,
      agent_id: config.id,
      status: "success",
      output,
      metrics: {
        execution_time_ms: executionTime,
      },
    };

    workerEventEmitter.emitWorkerCompleted(result, config.name);

    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[Worker ${config.id}] Failed: ${errorMsg}`);

    workerEventEmitter.emitWorkerFailed(config.id, config.name, errorMsg);

    const result: SubAgentResult = {
      task_id: config.id,
      agent_id: config.id,
      status: "failure",
      output: "",
      errors: [errorMsg],
      metrics: {
        execution_time_ms: Date.now() - startTime,
      },
    };

    return result;
  }
}

/**
 * Create a worker configuration
 */
export function createWorkerConfig(
  taskId: string,
  name: string,
  task: string,
  systemPrompt: string,
  tools: string[] = ["shell_execute", "create_artifact", "present_artifact"],
  modelConfig?: SubAgentConfig["modelConfig"]
): SubAgentConfig {
  return {
    id: taskId || uuidv4(),
    name,
    systemPrompt,
    tools,
    modelConfig,
    context: {
      task_description: task,
    },
    timeout: 300000,
  };
}

/**
 * Spawn multiple workers and run them in parallel
 */
export async function spawnWorkers(configs: SubAgentConfig[]): Promise<SubAgentResult[]> {
  console.log(`[SubAgentManager] Spawning ${configs.length} workers in parallel`);

  workerEventEmitter.emitAllWorkersStarted(configs.length);

  const results = await Promise.all(configs.map((config) => runWorker(config)));

  console.log(`[SubAgentManager] All ${results.length} workers completed`);

  const completedEvents = results.map((result) => ({
    type: "worker_completed" as const,
    task_id: result.task_id,
    name: result.task_id,
    status: result.status,
    output: result.output,
    errors: result.errors,
    execution_time_ms: result.metrics?.execution_time_ms,
    timestamp: Date.now(),
  }));

  const successCount = results.filter((r) => r.status === "success").length;
  const failureCount = results.filter((r) => r.status === "failure").length;

  workerEventEmitter.emitAllWorkersCompleted(completedEvents, successCount, failureCount);

  return results;
}

export { workerEventEmitter } from "./events.js";

/**
 * Run workers sequentially with dependency support
 */
export async function runWorkersSequentially(configs: SubAgentConfig[]): Promise<SubAgentResult[]> {
  console.log(`[SubAgentManager] Running ${configs.length} workers sequentially`);

  workerEventEmitter.emitAllWorkersStarted(configs.length);

  const results: SubAgentResult[] = [];

  for (const config of configs) {
    console.log(`[SubAgentManager] Starting worker: ${config.name}`);
    const result = await runWorker(config);
    results.push(result);
    console.log(`[SubAgentManager] Worker ${config.name} completed with status: ${result.status}`);
  }

  console.log(`[SubAgentManager] All ${results.length} workers completed`);

  const completedEvents = results.map((result) => ({
    type: "worker_completed" as const,
    task_id: result.task_id,
    name: result.task_id,
    status: result.status,
    output: result.output,
    errors: result.errors,
    execution_time_ms: result.metrics?.execution_time_ms,
    timestamp: Date.now(),
  }));

  const successCount = results.filter((r) => r.status === "success").length;
  const failureCount = results.filter((r) => r.status === "failure").length;

  workerEventEmitter.emitAllWorkersCompleted(completedEvents, successCount, failureCount);

  return results;
}
