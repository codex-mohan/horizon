import { createLogger } from "@horizon/shared-utils";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@mariozechner/pi-ai";
import { v4 as uuidv4 } from "uuid";
import type { RuntimeModelConfig } from "../../lib/model.js";
import { runWorkersSequentially, spawnWorkers } from "../subgraphs/index.js";
import type { SubAgentResult } from "../subgraphs/types.js";

const logger = createLogger("SubAgents");

export interface WorkerConfig {
  id?: string;
  name: string;
  task: string;
  systemPrompt: string;
  tools?: string[];
  modelConfig?: RuntimeModelConfig;
  timeout?: number;
  context?: Record<string, any>;
}

const SpawnSubagentsParams = Type.Object({
  displayTitle: Type.String({
    description:
      "A short 10-15 word message shown to the user describing what you're delegating. Examples: 'Delegating frontend and backend development to parallel workers', 'Assigning research tasks to multiple specialized sub-agents'.",
  }),
  workers: Type.Array(
    Type.Object({
      id: Type.Optional(
        Type.String({ description: "Unique ID for this worker (auto-generated if not provided)" })
      ),
      name: Type.String({ description: "Descriptive name for this worker/task" }),
      task: Type.String({ description: "The specific task this worker should accomplish" }),
      systemPrompt: Type.String({
        description: "Custom system prompt for this worker - be specific about role and goals",
      }),
      tools: Type.Optional(
        Type.Array(Type.String(), {
          description:
            "Tools to give this worker (defaults to shell, create_artifact, present_artifact)",
        })
      ),
      modelConfig: Type.Optional(Type.Any({ description: "Optional model config override" })),
      timeout: Type.Optional(Type.Number({ description: "Timeout in ms (default: 300000)" })),
      context: Type.Optional(
        Type.Record(Type.String(), Type.Any(), {
          description: "Additional context to pass to the worker",
        })
      ),
    }),
    { description: "Array of worker configurations" }
  ),
  runMode: Type.Optional(
    Type.Union([Type.Literal("parallel"), Type.Literal("sequential")], {
      description: "Run workers in parallel (default) or sequentially",
    })
  ),
});

export const spawnSubagentsTool: AgentTool<typeof SpawnSubagentsParams> = {
  name: "spawn_subagents",
  label: "Spawn Sub-Agents",
  description: `Spawn one or more sub-agents to handle complex tasks in parallel or sequentially. Always provide a short displayTitle (10-15 words) describing what you're delegating.

Use this when:
- A task can be broken into independent parts that can be worked on simultaneously
- Multiple different aspects need to be developed (e.g., frontend + backend + tests)
- You want to speed up complex multi-component projects
- Research needs to be done on multiple topics in parallel

The main agent decides when to use this - the LLM evaluates task complexity.
Sub-agents are fully configurable by the main agent with custom prompts, tools, and context.`,
  parameters: SpawnSubagentsParams,
  execute: async (_toolCallId, params, _signal, _onUpdate) => {
    const typedParams = params as {
      displayTitle: string;
      workers: WorkerConfig[];
      runMode?: "parallel" | "sequential";
    };
    const workers = typedParams.workers;
    const runMode = typedParams.runMode;

    console.log(
      `[spawn_subagents] Received ${workers.length} workers, mode: ${runMode || "parallel"}`
    );
    logger.info(`Spawning ${workers.length} workers, mode: ${runMode || "parallel"}`);
    logger.info(`Spawning ${workers.length} workers, mode: ${runMode || "parallel"}`);

    const configs = workers.map((w) => ({
      id: w.id || uuidv4(),
      name: w.name,
      systemPrompt: w.systemPrompt,
      tools: w.tools || ["shell_execute", "create_artifact", "present_artifact"],
      modelConfig: w.modelConfig,
      timeout: w.timeout || 300000,
      context: {
        task_description: w.task,
        ...(w.context || {}),
      },
    }));

    logger.info(`Spawning ${configs.length} workers...`);

    let results: SubAgentResult[];

    if (runMode === "sequential") {
      results = await runWorkersSequentially(configs);
    } else {
      results = await spawnWorkers(configs);
    }

    const summary = results.map((r) => ({
      task_id: r.task_id,
      name:
        workers.find(
          (w) => w.id === r.task_id || w.name === configs.find((c) => c.id === r.task_id)?.name
        )?.name || r.task_id,
      status: r.status,
      output: r.output.slice(0, 500) + (r.output.length > 500 ? "..." : ""),
      execution_time_ms: r.metrics?.execution_time_ms,
      errors: r.errors,
    }));

    const allSucceeded = results.every((r: any) => r.status === "success");
    const anyFailed = results.some((r: any) => r.status === "failure");

    const output = JSON.stringify({
      success: allSucceeded,
      summary: `Completed ${results.length} sub-agents: ${results.filter((r: any) => r.status === "success").length} succeeded, ${results.filter((r: any) => r.status === "failure").length} failed`,
      results: summary,
      all_results: results,
      message: anyFailed
        ? "Some sub-agents failed. Check results for details."
        : "All sub-agents completed successfully.",
    });

    return {
      content: [{ type: "text", text: output }],
      details: {
        success: allSucceeded,
        count: results.length,
        displayTitle: typedParams.displayTitle,
      },
    };
  },
};
