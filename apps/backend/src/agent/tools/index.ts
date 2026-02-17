import { webTools } from "@horizon/agent-web";
import { ShellExecutor } from "@horizon/shell";
import type { RunnableConfig } from "@langchain/core/runnables";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getHorizonConfig, resolveWorkspacePath } from "../../lib/config-loader.js";
import type { ToolApprovalConfig } from "../state.js";

// Initialize shell executor with workspace from config
const horizonConfig = getHorizonConfig();
const workspacePath = resolveWorkspacePath(horizonConfig);

const shellExecutor = new ShellExecutor({
  cwd: workspacePath,
});

export const TOOL_CATEGORIES = {
  safe: ["web_search", "fetch_url_content", "duckduckgo_search", "get_weather"],
  dangerous: ["shell_execute", "file_write", "file_delete"],
} as const;

export type ToolRiskLevel = "safe" | "dangerous";

export function getToolRiskLevel(toolName: string): ToolRiskLevel {
  if (TOOL_CATEGORIES.dangerous.includes(toolName as (typeof TOOL_CATEGORIES.dangerous)[number])) {
    return "dangerous";
  }
  return "safe";
}

export function isDangerousTool(toolName: string): boolean {
  return getToolRiskLevel(toolName) === "dangerous";
}

/**
 * Default tool approval configuration
 */
export const DEFAULT_TOOL_APPROVAL_CONFIG: ToolApprovalConfig = {
  mode: "dangerous_only",
  auto_approve_tools: [],
  never_approve_tools: [],
};

/**
 * Extract tool approval configuration from RunnableConfig
 */
export function getToolApprovalConfig(config: RunnableConfig): ToolApprovalConfig {
  const configurable = config.configurable as Record<string, unknown> | undefined;
  return (configurable?.tool_approval as ToolApprovalConfig) ?? DEFAULT_TOOL_APPROVAL_CONFIG;
}

/**
 * Check if a tool needs approval based on the approval configuration
 */
export function needsApproval(toolName: string, approvalConfig: ToolApprovalConfig): boolean {
  const { mode, auto_approve_tools, never_approve_tools } = approvalConfig;

  // Explicitly auto-approved tools never need approval
  if (auto_approve_tools.includes(toolName)) {
    return false;
  }

  // Explicitly never-approve tools always need approval
  if (never_approve_tools.includes(toolName)) {
    return true;
  }

  // Check mode
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

/**
 * Check if any tool calls need approval
 */
export function anyNeedsApproval(
  toolCalls: Array<{ name: string }>,
  approvalConfig: ToolApprovalConfig
): boolean {
  return toolCalls.some((tc) => needsApproval(tc.name, approvalConfig));
}

/**
 * Filter tool calls that need approval
 */
export function filterToolsNeedingApproval(
  toolCalls: Array<{ name: string; id?: string; args?: Record<string, unknown> }>,
  approvalConfig: ToolApprovalConfig
): Array<{ name: string; id?: string; args?: Record<string, unknown> }> {
  return toolCalls.filter((tc) => needsApproval(tc.name, approvalConfig));
}

/**
 * Shell execution result structure for generative UI
 */
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

export const shellTool = tool(
  async ({ command }: { command: string }) => {
    try {
      const result = await shellExecutor.execute(command);

      // Return structured JSON for the frontend to parse
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
      // Handle execution errors (timeout, permission denied, etc.)
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

// Aggregate all tools
export const tools = [...webTools, shellTool];
export const toolMap = Object.fromEntries(tools.map((t) => [t.name, t]));
