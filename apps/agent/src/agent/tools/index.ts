import {
  createArtifactTool,
  fetchUrlContent,
  getToolRiskLevel,
  getWeather,
  isDangerousTool,
  presentArtifactTool,
  ShellExecutor,
  searchWeb,
  TOOL_CATEGORIES,
} from "@horizon/agent-tools";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@mariozechner/pi-ai";
import { getHorizonConfig, resolveWorkspacePath } from "../../lib/config-loader.js";
import { spawnSubagentsTool } from "./subagent.js";

const horizonConfig = getHorizonConfig();
const workspacePath = resolveWorkspacePath(horizonConfig);

const shellExecutor = new ShellExecutor({
  cwd: workspacePath,
});

export { TOOL_CATEGORIES };
export type { ToolRiskLevel } from "@horizon/agent-tools";
export { getToolRiskLevel, isDangerousTool };

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

const ShellParams = Type.Object({
  displayTitle: Type.String({
    description:
      "A short 10-15 word message shown to the user describing what you're doing. Examples: 'Fixing linting on new files', 'Installing project dependencies', 'Running test suite to verify changes', 'Creating project directory structure'.",
  }),
  command: Type.String({ description: "The shell command to execute." }),
});

export const shellTool: AgentTool<typeof ShellParams> = {
  name: "shell_execute",
  label: "Shell Execute",
  description:
    "Execute a shell command on the user's system. Always provide a short displayTitle (10-15 words) describing what you're doing, like 'Fixing linting on new files' or 'Installing project dependencies'. Returns structured result with stdout, stderr, exit code, duration, and working directory. Use for file operations, system commands, git, npm, etc.",
  parameters: ShellParams,
  execute: async (_toolCallId, params, _signal, _onUpdate) => {
    try {
      const result = await shellExecutor.execute(params.command);

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

      return {
        content: [{ type: "text", text: JSON.stringify(shellResult) }],
        details: { ...shellResult, displayTitle: params.displayTitle },
      };
    } catch (error) {
      const errorResult: ShellResult = {
        command: params.command,
        stdout: "",
        stderr: error instanceof Error ? error.message : String(error),
        exitCode: -1,
        success: false,
        duration: 0,
        cwd: process.cwd(),
        truncated: false,
      };
      throw new Error(JSON.stringify(errorResult));
    }
  },
};

const SearchParams = Type.Object({
  displayTitle: Type.String({
    description:
      "A short 10-15 word message shown to the user describing the search. Examples: 'Searching for latest React documentation', 'Looking up weather API alternatives', 'Finding recent news about TypeScript'.",
  }),
  query: Type.String({ description: "The search query to look up." }),
  fetchContent: Type.Optional(
    Type.Boolean({
      description: "Whether to fetch and include brief content summaries from top results.",
    })
  ),
});

export const searchWebTool: AgentTool<typeof SearchParams> = {
  name: "search_web",
  label: "Web Search",
  description:
    "Search the web for information using DuckDuckGo. Always provide a short displayTitle (10-15 words) describing what you're searching for, like 'Searching for latest React documentation' or 'Looking up weather API alternatives'.",
  parameters: SearchParams,
  execute: async (_toolCallId, params, _signal, _onUpdate) => {
    const result = await searchWeb.invoke({
      query: params.query,
      fetchContent: params.fetchContent ?? false,
    });
    return {
      content: [
        { type: "text", text: typeof result === "string" ? result : JSON.stringify(result) },
      ],
      details: { query: params.query, displayTitle: params.displayTitle },
    };
  },
};

const FetchParams = Type.Object({
  displayTitle: Type.String({
    description:
      "A short 10-15 word message shown to the user describing what you're fetching. Examples: 'Reading documentation from GitHub repository', 'Extracting article content from blog post'.",
  }),
  url: Type.String({ description: "The URL to fetch content from." }),
});

export const fetchUrlContentTool: AgentTool<typeof FetchParams> = {
  name: "fetch_url_content",
  label: "Fetch URL",
  description:
    "Fetch and extract text content from a URL. Always provide a short displayTitle (10-15 words) describing what you're fetching, like 'Reading documentation from GitHub repository' or 'Extracting article content from blog post'.",
  parameters: FetchParams,
  execute: async (_toolCallId, params, _signal, _onUpdate) => {
    const result = await fetchUrlContent.invoke({ url: params.url });
    return {
      content: [
        { type: "text", text: typeof result === "string" ? result : JSON.stringify(result) },
      ],
      details: { url: params.url, displayTitle: params.displayTitle },
    };
  },
};

const WeatherParams = Type.Object({
  displayTitle: Type.String({
    description:
      "A short 10-15 word message shown to the user describing the weather request. Examples: 'Checking current weather conditions for London', 'Fetching weather forecast for Tokyo'.",
  }),
  city: Type.String({ description: "The city name to get weather for." }),
});

export const getWeatherTool: AgentTool<typeof WeatherParams> = {
  name: "get_weather",
  label: "Weather",
  description:
    "Get current weather information for a city. Always provide a short displayTitle (10-15 words) describing the request, like 'Checking current weather conditions for London' or 'Fetching weather forecast for Tokyo'.",
  parameters: WeatherParams,
  execute: async (_toolCallId, params, _signal, _onUpdate) => {
    const result = await getWeather.invoke({ city: params.city });
    return {
      content: [
        { type: "text", text: typeof result === "string" ? result : JSON.stringify(result) },
      ],
      details: { city: params.city, displayTitle: params.displayTitle },
    };
  },
};

const ArtifactParams = Type.Object({
  displayTitle: Type.String({
    description:
      "A short 10-15 word message shown to the user describing what you're building. Examples: 'Building interactive dashboard with charts', 'Creating responsive landing page layout', 'Designing SVG icon for the project'.",
  }),
  title: Type.String({ description: "Display title shown to the user" }),
  fileName: Type.String({
    description: "File name with extension (e.g., 'landing-page.html')",
  }),
  type: Type.Union([
    Type.Literal("html"),
    Type.Literal("svg"),
    Type.Literal("mermaid"),
    Type.Literal("react"),
    Type.Literal("code"),
    Type.Literal("markdown"),
  ]),
  content: Type.String({ description: "Full artifact content. Must be self-contained." }),
  language: Type.Optional(Type.String({ description: "Programming language for code artifacts" })),
});

function createArtifactAdapter(): AgentTool<typeof ArtifactParams> {
  return {
    name: "create_artifact",
    label: "Create Artifact",
    description:
      "Create a renderable artifact (HTML page, SVG graphic, Mermaid diagram, React component, or code file). Always provide a short displayTitle (10-15 words) describing what you're building, like 'Building interactive dashboard with charts' or 'Creating responsive landing page layout'.",
    parameters: ArtifactParams,
    execute: async (toolCallId, params, _signal, _onUpdate) => {
      const result = await createArtifactTool.invoke({
        title: params.title,
        fileName: params.fileName,
        type: params.type,
        content: params.content,
        language: params.language,
        threadId: toolCallId?.split(":")?.[0] || "unknown",
      });
      return {
        content: [
          { type: "text", text: typeof result === "string" ? result : JSON.stringify(result) },
        ],
        details: {
          ...(typeof result === "string" ? JSON.parse(result) : result),
          displayTitle: params.displayTitle,
        },
      };
    },
  };
}

const PresentArtifactParams = Type.Object({
  displayTitle: Type.String({
    description:
      "A short 10-15 word message shown to the user describing what you're presenting. Examples: 'Showing the completed dashboard component', 'Presenting the generated architecture diagram'.",
  }),
  artifact_id: Type.String({
    description: "The ID of the artifact to present (returned by create_artifact)",
  }),
});

function presentArtifactAdapter(): AgentTool<typeof PresentArtifactParams> {
  return {
    name: "present_artifact",
    label: "Present Artifact",
    description:
      "Display a previously created artifact to the user. Always provide a short displayTitle (10-15 words) describing what you're showing, like 'Showing the completed dashboard component' or 'Presenting the generated architecture diagram'.",
    parameters: PresentArtifactParams,
    execute: async (_toolCallId, params, _signal, _onUpdate) => {
      const result = await presentArtifactTool.invoke({
        artifact_id: params.artifact_id,
      });
      return {
        content: [
          { type: "text", text: typeof result === "string" ? result : JSON.stringify(result) },
        ],
        details: {
          ...(typeof result === "string" ? JSON.parse(result) : result),
          displayTitle: params.displayTitle,
        },
      };
    },
  };
}

export const tools: AgentTool<any>[] = [
  searchWebTool,
  fetchUrlContentTool,
  getWeatherTool,
  shellTool,
  createArtifactAdapter(),
  presentArtifactAdapter(),
  spawnSubagentsTool as unknown as AgentTool<any>,
];

export const toolMap = Object.fromEntries(tools.map((t) => [t.name, t]));
