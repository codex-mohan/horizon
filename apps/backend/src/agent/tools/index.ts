import { webTools } from "@horizon/agent-web";
import { ShellExecutor } from "@horizon/shell";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const shellExecutor = new ShellExecutor();

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
