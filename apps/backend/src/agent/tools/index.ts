import { webTools } from "@horizon/agent-web";
import { ShellExecutor } from "@horizon/shell";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const shellExecutor = new ShellExecutor();

export const TOOL_CATEGORIES = {
  safe: ["web_search", "fetch_url_content", "duckduckgo_search"],
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

export const shellTool = tool(
  async ({ command }: { command: string }) => {
    try {
      const result = await shellExecutor.execute(command);

      // Return comprehensive result including both stdout and stderr
      const output: string[] = [];

      if (result.stdout) {
        output.push(result.stdout);
      }

      if (result.stderr) {
        if (output.length > 0) {
          output.push("");
        }
        output.push(`[STDERR]: ${result.stderr}`);
      }

      if (result.exitCode !== 0) {
        if (output.length > 0) {
          output.push("");
        }
        output.push(`[Exit Code: ${result.exitCode}]`);
      }

      return output.join("\n") || "(no output)";
    } catch (error) {
      // Only handle actual execution errors, not command failures
      return `Execution error: ${error}`;
    }
  },
  {
    name: "shell_execute",
    description:
      "Execute a shell command in the sandbox. Returns both stdout and stderr. Commands that fail (non-zero exit) will still return their output along with the exit code.",
    schema: z.object({
      command: z.string().describe("The command to execute."),
    }),
  }
);

// Aggregate all tools
export const tools = [...webTools, shellTool];
export const toolMap = Object.fromEntries(tools.map((t) => [t.name, t]));
