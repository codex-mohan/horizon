import { getModel, type Model } from "@mariozechner/pi-ai";

export type ModelProvider = "openai" | "anthropic" | "google" | "ollama" | "groq" | "nvidia_nim";

export interface RuntimeModelConfig {
  provider: ModelProvider;
  modelName: string;
  temperature?: number;
  maxTokens?: number;
  apiKey?: string;
  baseUrl?: string;
  enableReasoning?: boolean;
  reasoningEffort?: string;
  thinkingBudget?: number;
}

const providerMap: Record<ModelProvider, string> = {
  openai: "openai",
  anthropic: "anthropic",
  google: "google",
  ollama: "openai",
  groq: "groq",
  nvidia_nim: "openai",
};

export function createModel(config: RuntimeModelConfig): Model<any> {
  const piProvider = providerMap[config.provider] || "openai";

  let baseUrl: string | undefined;
  if (config.provider === "ollama") {
    baseUrl = config.baseUrl || "http://localhost:11434/v1";
  } else if (config.provider === "nvidia_nim") {
    baseUrl = config.baseUrl || "https://integrate.api.nvidia.com/v1";
  } else if (config.baseUrl) {
    baseUrl = config.baseUrl;
  }

  const model = getModel(piProvider as any, config.modelName);

  if (baseUrl) {
    return {
      ...model,
      baseUrl,
      compat:
        config.provider === "ollama"
          ? {
              supportsDeveloperRole: false,
              supportsReasoningEffort: false,
            }
          : undefined,
    };
  }

  return model;
}

export function buildStreamOptions(config: RuntimeModelConfig) {
  const options: Record<string, any> = {};

  if (config.apiKey) {
    options.apiKey = config.apiKey;
  }

  if (config.temperature !== undefined) {
    options.temperature = config.temperature;
  }

  if (config.maxTokens !== undefined) {
    options.maxTokens = config.maxTokens;
  }

  if (config.enableReasoning) {
    const provider = config.provider;

    if (provider === "anthropic") {
      options.thinkingEnabled = true;
      if (config.thinkingBudget) {
        options.thinkingBudgetTokens = config.thinkingBudget;
      }
    } else if (provider === "openai" || provider === "nvidia_nim") {
      if (config.reasoningEffort) {
        options.reasoningEffort = config.reasoningEffort;
      }
    } else if (provider === "google") {
      options.thinking = {
        enabled: true,
        budgetTokens: config.thinkingBudget || -1,
      };
    }
  }

  return options;
}

export function getThinkingLevel(
  config: RuntimeModelConfig
): "off" | "minimal" | "low" | "medium" | "high" | "xhigh" {
  if (!config.enableReasoning) return "off";
  const effort = config.reasoningEffort || "medium";
  if (effort === "minimal") return "minimal";
  if (effort === "low") return "low";
  if (effort === "high") return "high";
  if (effort === "xhigh") return "xhigh";
  return "medium";
}
