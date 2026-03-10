/**
 * @horizon/agent-tools - Consolidated agent tools package
 *
 * This package contains all tools used by the Horizon agent:
 * - Shell execution (shell/)
 * - Web tools (search, weather, URL fetching) (web/)
 * - Artifact management (artifacts.ts)
 *
 * @module @horizon/agent-tools
 */

export {
  createArtifactTool,
  presentArtifactTool,
} from "./artifacts.js";

export {
  type ErrorContext,
  PermissionError,
  ShellError,
  TimeoutError,
} from "./shell/errors.js";
export {
  type ApprovalContext,
  type ApprovalMode,
  type ExecutionResult,
  type ShellConfig,
  ShellExecutor,
} from "./shell/executor.js";
export { CommandHistory, type HistoryEntry } from "./shell/history.js";
export {
  type InteractiveConfig,
  InteractiveShell,
  type SessionState,
} from "./shell/index.js";
export {
  detectOS,
  getPlatformInfo,
  joinPaths,
  normalizePath,
  type PlatformInfo,
} from "./shell/platform.js";
export {
  fetchUrlContent,
  getWeather,
  searchWeb,
  webTools,
} from "./web/index.js";

export const TOOL_CATEGORIES = {
  safe: [
    "web_search",
    "fetch_url_content",
    "duckduckgo_search",
    "get_weather",
    "create_artifact",
    "present_artifact",
  ],
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
