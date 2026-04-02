import { tool } from "@langchain/core/tools";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod/v4";
import type { SubAgentConfig, SubAgentResult } from "../state.js";
import { runWorkersSequentially, spawnWorkers } from "../subgraphs/index.js";

/**
 * Spawn sub-agents to handle complex tasks in parallel
 * The main agent decides when to spawn sub-agents - the LLM determines complexity
 */
export const spawnSubagentsTool = tool(
  async ({
    workers,
    runMode,
  }: {
    workers: WorkerConfig[];
    runMode?: "parallel" | "sequential";
  }) => {
    console.log(
      `[spawn_subagents] Received ${workers.length} workers, mode: ${runMode || "parallel"}`
    );

    const configs: SubAgentConfig[] = workers.map((w) => ({
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

    console.log(`[spawn_subagents] Spawning ${configs.length} workers...`);

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

    const allSucceeded = results.every((r) => r.status === "success");
    const anyFailed = results.some((r) => r.status === "failure");

    return JSON.stringify({
      success: allSucceeded,
      summary: `Completed ${results.length} sub-agents: ${results.filter((r) => r.status === "success").length} succeeded, ${results.filter((r) => r.status === "failure").length} failed`,
      results: summary,
      all_results: results,
      message: anyFailed
        ? "Some sub-agents failed. Check results for details."
        : "All sub-agents completed successfully.",
    });
  },
  {
    name: "spawn_subagents",
    description: `Spawn one or more sub-agents to handle complex tasks in parallel or sequentially.

Use this when:
- A task can be broken into independent parts that can be worked on simultaneously
- Multiple different aspects need to be developed (e.g., frontend + backend + tests)
- You want to speed up complex multi-component projects
- Research needs to be done on multiple topics in parallel

The main agent decides when to use this - the LLM evaluates task complexity.
Sub-agents are fully configurable by the main agent with custom prompts, tools, and context.`,
    schema: z.object({
      workers: z
        .array(
          z.object({
            id: z
              .string()
              .optional()
              .describe("Unique ID for this worker (auto-generated if not provided)"),
            name: z.string().describe("Descriptive name for this worker/task"),
            task: z.string().describe("The specific task this worker should accomplish"),
            systemPrompt: z
              .string()
              .describe("Custom system prompt for this worker - be specific about role and goals"),
            tools: z
              .array(z.string())
              .optional()
              .describe(
                "Tools to give this worker (defaults to shell, create_artifact, present_artifact)"
              ),
            modelConfig: z.any().optional().describe("Optional model config override"),
            timeout: z.number().optional().describe("Timeout in ms (default: 300000)"),
            context: z
              .record(z.string(), z.any())
              .optional()
              .describe("Additional context to pass to the worker"),
          })
        )
        .describe("Array of worker configurations"),
      runMode: z
        .enum(["parallel", "sequential"])
        .optional()
        .describe("Run workers in parallel (default) or sequentially"),
    }),
  }
);

export interface WorkerConfig {
  id?: string;
  name: string;
  task: string;
  systemPrompt: string;
  tools?: string[];
  modelConfig?: any;
  timeout?: number;
  context?: Record<string, any>;
}
