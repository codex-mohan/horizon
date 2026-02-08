/**
 * Tool UI Configuration System
 *
 * Maps tool names to their UI configurations including:
 * - Icon types and colors
 * - Component assignments (namespace-based)
 * - Display settings
 */

import { LucideIcon } from "lucide-react";
import {
  Terminal,
  Search,
  Globe,
  FileText,
  Database,
  Code,
  Settings,
  Wrench,
} from "lucide-react";

export type ToolStatus = "pending" | "executing" | "completed" | "failed";

export type ToolNamespace = "special" | "generic";

export interface ToolUIConfig {
  /** Tool identifier (must match the tool name in backend) */
  toolName: string;

  /** Display name for the tool */
  displayName: string;

  /** Description of what the tool does */
  description: string;

  /** Namespace for component grouping */
  namespace: ToolNamespace;

  /** Icon configuration */
  icon: {
    /** Lucide icon name */
    name: string;
    /** Icon color (tailwind class or hex) */
    color: string;
    /** Background color for icon container */
    bgColor: string;
  };

  /** Component configuration */
  component?: {
    /** Component name to use from generative UI registry */
    name: string;
    /** Whether to use custom component or fallback to generic */
    useCustom: boolean;
  };

  /** Status-specific colors */
  statusColors: {
    pending: string;
    executing: string;
    completed: string;
    failed: string;
  };

  /** Additional metadata */
  metadata?: {
    /** Whether to show arguments by default */
    showArgs?: boolean;
    /** Whether to collapse result by default */
    collapseResult?: boolean;
    /** Max height for result display */
    maxResultHeight?: string;
  };
}

/**
 * Default tool configurations
 * Maps tool names to their UI settings
 */
export const toolUIRegistry: Record<string, ToolUIConfig> = {
  shell_execute: {
    toolName: "shell_execute",
    displayName: "Shell",
    description: "Execute commands in sandboxed environment",
    namespace: "special",
    icon: {
      name: "Terminal",
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/10",
    },
    component: {
      name: "ShellTool",
      useCustom: true,
    },
    statusColors: {
      pending: "text-amber-400",
      executing: "text-blue-400",
      completed: "text-emerald-400",
      failed: "text-red-400",
    },
    metadata: {
      showArgs: true,
      collapseResult: false,
      maxResultHeight: "300px",
    },
  },

  search_web: {
    toolName: "search_web",
    displayName: "Web Search",
    description: "Search the web for information",
    namespace: "special",
    icon: {
      name: "Search",
      color: "text-violet-400",
      bgColor: "bg-violet-500/10",
    },
    component: {
      name: "WebSearchTool",
      useCustom: true,
    },
    statusColors: {
      pending: "text-amber-400",
      executing: "text-blue-400",
      completed: "text-violet-400",
      failed: "text-red-400",
    },
    metadata: {
      showArgs: true,
      collapseResult: true,
      maxResultHeight: "400px",
    },
  },

  fetch_url_content: {
    toolName: "fetch_url_content",
    displayName: "Fetch URL",
    description: "Retrieve content from a URL",
    namespace: "special",
    icon: {
      name: "Globe",
      color: "text-cyan-400",
      bgColor: "bg-cyan-500/10",
    },
    component: {
      name: "FetchUrlTool",
      useCustom: true,
    },
    statusColors: {
      pending: "text-amber-400",
      executing: "text-blue-400",
      completed: "text-cyan-400",
      failed: "text-red-400",
    },
    metadata: {
      showArgs: true,
      collapseResult: true,
      maxResultHeight: "350px",
    },
  },
};

/**
 * Default configuration for tools not in registry
 */
export const defaultToolConfig: ToolUIConfig = {
  toolName: "unknown",
  displayName: "Tool",
  description: "Execute tool operation",
  namespace: "generic",
  icon: {
    name: "Wrench",
    color: "text-slate-400",
    bgColor: "bg-slate-500/10",
  },
  component: {
    name: "GenericTool",
    useCustom: false,
  },
  statusColors: {
    pending: "text-amber-400",
    executing: "text-blue-400",
    completed: "text-emerald-400",
    failed: "text-red-400",
  },
  metadata: {
    showArgs: false,
    collapseResult: true,
    maxResultHeight: "250px",
  },
};

/**
 * Get UI configuration for a tool
 */
export function getToolUIConfig(toolName: string): ToolUIConfig {
  return (
    toolUIRegistry[toolName] || {
      ...defaultToolConfig,
      toolName,
      displayName: toolName
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" "),
    }
  );
}

/**
 * Get icon component for a tool
 */
export function getToolIcon(toolName: string): LucideIcon {
  const config = getToolUIConfig(toolName);
  const iconMap: Record<string, LucideIcon> = {
    Terminal,
    Search,
    Globe,
    FileText,
    Database,
    Code,
    Settings,
    Wrench,
  };
  return iconMap[config.icon.name] || Wrench;
}

/**
 * Check if tool uses custom generative UI
 */
export function hasCustomUI(toolName: string): boolean {
  const config = getToolUIConfig(toolName);
  return config.namespace === "special" && config.component?.useCustom === true;
}
