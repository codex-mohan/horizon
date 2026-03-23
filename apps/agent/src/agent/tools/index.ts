import {
  createArtifactTool,
  getToolRiskLevel,
  isDangerousTool,
  presentArtifactTool,
  ShellExecutor,
  TOOL_CATEGORIES,
  webTools,
} from "@horizon/agent-tools";
import type { RunnableConfig } from "@langchain/core/runnables";
import { z } from "zod";
import { getHorizonConfig, resolveWorkspacePath } from "../../lib/config-loader.js";
import type { ToolApprovalConfig } from "../state.js";
import { spawnSubagentsTool } from "./subagent.js";

const horizonConfig = getHorizonConfig();
const workspacePath = resolveWorkspacePath(horizonConfig);

const shellExecutor = new ShellExecutor({
  cwd: workspacePath,
});

export { TOOL_CATEGORIES };
export type { ToolRiskLevel } from "@horizon/agent-tools";
export { getToolRiskLevel, isDangerousTool };

export const DEFAULT_TOOL_APPROVAL_CONFIG: ToolApprovalConfig = {
  mode: "dangerous_only",
  auto_approve_tools: [],
  never_approve_tools: [],
};

export function getToolApprovalConfig(config: RunnableConfig): ToolApprovalConfig {
  const configurable = config.configurable as Record<string, unknown> | undefined;
  return (configurable?.tool_approval as ToolApprovalConfig) ?? DEFAULT_TOOL_APPROVAL_CONFIG;
}

export function needsApproval(toolName: string, approvalConfig: ToolApprovalConfig): boolean {
  const { mode, auto_approve_tools, never_approve_tools } = approvalConfig;

  if (auto_approve_tools.includes(toolName)) {
    return false;
  }

  if (never_approve_tools.includes(toolName)) {
    return true;
  }

  switch (mode) {
    case "never_ask":
      return false;
    case "always_ask":
      return true;
    case "dangerous_only":
    default:
      return isDangerousTool(toolName);
  }
}

export function anyNeedsApproval(
  toolCalls: Array<{ name: string }>,
  approvalConfig: ToolApprovalConfig
): boolean {
  return toolCalls.some((tc) => needsApproval(tc.name, approvalConfig));
}

export function filterToolsNeedingApproval(
  toolCalls: Array<{ name: string; id?: string; args?: Record<string, unknown> }>,
  approvalConfig: ToolApprovalConfig
): Array<{ name: string; id?: string; args?: Record<string, unknown> }> {
  return toolCalls.filter((tc) => needsApproval(tc.name, approvalConfig));
}

interface ShellResult {
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  success: boolean;
  duration: number;
  cwd: string;
  truncated: boolean;
}

import { tool } from "@langchain/core/tools";

export const shellTool = tool(
  async ({ command }: { command: string }) => {
    try {
      const result = await shellExecutor.execute(command);

      const shellResult: ShellResult = {
        command: result.command,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        success: result.success,
        duration: result.duration,
        cwd: result.cwd,
        truncated: result.truncated,
      };

      return JSON.stringify(shellResult);
    } catch (error) {
      const errorResult: ShellResult = {
        command: command,
        stdout: "",
        stderr: error instanceof Error ? error.message : String(error),
        exitCode: -1,
        success: false,
        duration: 0,
        cwd: process.cwd(),
        truncated: false,
      };
      return JSON.stringify(errorResult);
    }
  },
  {
    name: "shell_execute",
    description:
      "Execute a shell command. Returns structured result with stdout, stderr, exit code, duration, and working directory. Use for file operations, system commands, git, npm, etc.",
    schema: z.object({
      command: z.string().describe("The shell command to execute."),
    }),
  }
);

export const tools = [
  ...webTools,
  shellTool,
  createArtifactTool,
  presentArtifactTool,
  spawnSubagentsTool,
];
export const toolMap = Object.fromEntries(tools.map((t) => [t.name, t]));
