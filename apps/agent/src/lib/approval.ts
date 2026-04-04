export type ToolApprovalMode = "always_ask" | "dangerous_only" | "never_ask";

export interface ToolApprovalConfig {
  mode: ToolApprovalMode;
  auto_approve_tools: string[];
  never_approve_tools: string[];
}

export const DEFAULT_TOOL_APPROVAL_CONFIG: ToolApprovalConfig = {
  mode: "dangerous_only",
  auto_approve_tools: [],
  never_approve_tools: [],
};

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
    default:
      return isDangerousTool(toolName);
  }
}

export function isDangerousTool(toolName: string): boolean {
  const dangerousTools = ["shell_execute", "file_write", "file_delete"];
  return dangerousTools.includes(toolName);
}
