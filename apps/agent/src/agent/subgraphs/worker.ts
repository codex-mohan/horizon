import { createLogger } from "@horizon/shared-utils";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Agent } from "@mariozechner/pi-agent-core";
import { agentConfig } from "../../lib/config.js";
import type { RuntimeModelConfig } from "../../lib/model.js";
import { createModel, getThinkingLevel } from "../../lib/model.js";
import { toolMap } from "../tools/index.js";
import { workerEventEmitter } from "./events.js";
import type { SubAgentConfig, SubAgentResult } from "./types.js";

const logger = createLogger("Worker");

function getToolsForNames(names: string[]): AgentTool<any>[] {
  return names
    .map((name) => toolMap[name])
    .filter((tool) => tool !== undefined) as AgentTool<any>[];
}

function buildFallbackModelConfig(): RuntimeModelConfig {
  return {
    provider: agentConfig.MODEL_PROVIDER as any,
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
  };
}

export async function runWorker(config: SubAgentConfig): Promise<SubAgentResult> {
  const startTime = Date.now();

  logger.info(`Worker ${config.id} starting task: ${config.name}`, { tools: config.tools });

  workerEventEmitter.emitWorkerStarted(config);

  try {
    const timeoutMs = config.timeout || 300000;
    const modelConfig = config.modelConfig || buildFallbackModelConfig();
    const model = createModel(modelConfig);
    const availableTools = getToolsForNames(config.tools);

    logger.debug(`Worker ${config.id} bound ${availableTools.length} tools`);

    workerEventEmitter.emitWorkerProgress(
      config.id,
      config.name,
      "running",
      `${availableTools.length} tools bound`
    );

    const agent = new Agent({
      initialState: {
        systemPrompt: config.systemPrompt,
        model,
        thinkingLevel: getThinkingLevel(modelConfig),
        tools: availableTools,
        messages: [],
      },
    });

    const executeWorker = async () => {
      await agent.prompt(config.context?.task_description || config.name);
      await agent.waitForIdle();

      const lastMessage = agent.state.messages.at(-1);
      const output =
        typeof lastMessage?.content === "string"
          ? lastMessage.content
          : Array.isArray(lastMessage?.content)
            ? lastMessage.content
                .filter((b) => b.type === "text")
                .map((b) => (b as { text: string }).text)
                .join("")
            : "";

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
    };

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Worker timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    return await Promise.race([executeWorker(), timeoutPromise]);
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

export function createWorkerConfig(
  taskId: string,
  name: string,
  task: string,
  systemPrompt: string,
  tools: string[] = ["shell_execute", "create_artifact", "present_artifact"],
  modelConfig?: SubAgentConfig["modelConfig"]
): SubAgentConfig {
  return {
    id: taskId || crypto.randomUUID(),
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
