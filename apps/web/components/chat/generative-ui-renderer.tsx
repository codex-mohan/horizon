"use client";

import { hasCustomUI } from "@/lib/tool-config";
import { FetchUrlTool, GenericTool, ShellTool, WeatherTool, WebSearchTool } from "./generative-ui";
import type { ToolCall } from "./tool-call-message";

interface GenerativeUIRendererProps {
  toolCalls: ToolCall[];
  isLoading?: boolean;
}

function renderGenerativeUI(toolCall: ToolCall, isLoading: boolean): React.ReactNode {
  const toolName = toolCall.name;

  const uiStatus: "pending" | "executing" | "completed" | "failed" =
    toolCall.status === "loading"
      ? "executing"
      : toolCall.status === "error"
        ? "failed"
        : toolCall.status === "success" || toolCall.status === "completed"
          ? "completed"
          : "pending";

  const commonProps = {
    toolName,
    status: uiStatus,
    args: (toolCall.arguments || {}) as Record<string, unknown>,
    result: toolCall.result,
    startedAt: toolCall.startedAt,
    completedAt: toolCall.completedAt,
    error: toolCall.error,
    isLoading: isLoading && toolCall.status === "loading",
  };

  switch (toolName) {
    case "shell_execute":
      return <ShellTool {...commonProps} />;

    case "search_web":
      return <WebSearchTool {...commonProps} />;

    case "fetch_url_content":
      return <FetchUrlTool {...commonProps} />;

    case "get_weather":
      return <WeatherTool {...commonProps} />;

    default:
      return <GenericTool {...commonProps} />;
  }
}

export function GenerativeUIRenderer({ toolCalls, isLoading = false }: GenerativeUIRendererProps) {
  const specialTools = toolCalls.filter((tc) => hasCustomUI(tc.name));

  if (specialTools.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {specialTools.map((toolCall) => (
        <div
          key={`${toolCall.id}-${toolCall.status}-${toolCall.startedAt || 0}-${toolCall.completedAt || 0}-${toolCall.error || ""}-${typeof toolCall.result === "string" ? toolCall.result.slice(0, 100) : ""}`}
        >
          {renderGenerativeUI(toolCall, isLoading)}
        </div>
      ))}
    </div>
  );
}
