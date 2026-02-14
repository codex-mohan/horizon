"use client";

import type { ComponentType } from "react";
import { FetchUrlTool } from "@/components/chat/generative-ui/fetch-url-tool";
import { GenericTool } from "@/components/chat/generative-ui/generic-tool";
import { ShellTool } from "@/components/chat/generative-ui/shell-tool";
import { WeatherTool } from "@/components/chat/generative-ui/weather-tool";
import { WebSearchTool } from "@/components/chat/generative-ui/web-search-tool";

interface ToolProps {
  toolName: string;
  status: "pending" | "executing" | "completed" | "failed";
  args: Record<string, unknown>;
  result?: string;
  startedAt?: number;
  completedAt?: number;
  error?: string;
  isLoading?: boolean;
}

export const toolComponents: Record<string, ComponentType<ToolProps>> = {
  shell_execute: ShellTool,
  search_web: WebSearchTool,
  fetch_url_content: FetchUrlTool,
  weather: WeatherTool,
};

export function getToolComponent(name: string): ComponentType<ToolProps> {
  return toolComponents[name] || GenericTool;
}
