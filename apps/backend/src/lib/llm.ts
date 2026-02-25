import { ChatAnthropic } from "@langchain/anthropic";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatGroq } from "@langchain/groq";
import { ChatOllama } from "@langchain/ollama";
import { ChatOpenAI } from "@langchain/openai";
import { type AgentConfig, agentConfig } from "./config.js";

export interface RuntimeModelConfig {
  provider: "openai" | "anthropic" | "google" | "ollama" | "groq" | "nvidia_nim";
  modelName: string;
  temperature?: number;
  maxTokens?: number;
  apiKey?: string;
  baseUrl?: string;
  enableReasoning?: boolean;
}

export async function createLLM(config: AgentConfig = agentConfig): Promise<BaseChatModel> {
  const { MODEL_PROVIDER, MODEL_NAME, TEMPERATURE, MAX_TOKENS, BASE_URL } = config;

  console.log(`[LLM] Initializing ${MODEL_PROVIDER} model: ${MODEL_NAME}`);

  return createRuntimeLLM({
    provider: MODEL_PROVIDER as RuntimeModelConfig["provider"],
    modelName: MODEL_NAME,
    temperature: TEMPERATURE,
    maxTokens: MAX_TOKENS,
    baseUrl: BASE_URL,
    apiKey:
      config.MODEL_PROVIDER === "openai"
        ? config.OPENAI_API_KEY
        : config.MODEL_PROVIDER === "anthropic"
          ? config.ANTHROPIC_API_KEY
          : config.MODEL_PROVIDER === "google"
            ? config.GOOGLE_API_KEY
            : config.MODEL_PROVIDER === "groq"
              ? config.GROQ_API_KEY
              : config.MODEL_PROVIDER === "nvidia_nim"
                ? config.NVIDIA_NIM_API_KEY
                : undefined,
  });
}

export async function createRuntimeLLM(runtimeConfig: RuntimeModelConfig): Promise<BaseChatModel> {
  const {
    provider,
    modelName,
    temperature = 0.7,
    maxTokens = 4096,
    apiKey,
    baseUrl,
    enableReasoning = false,
  } = runtimeConfig;

  console.log(
    `[LLM] Creating runtime LLM: ${provider}/${modelName} (reasoning: ${enableReasoning})`
  );

  switch (provider) {
    case "openai":
      if (!apiKey) {
        throw new Error("OPENAI_API_KEY is required for OpenAI provider");
      }
      return new ChatOpenAI({
        modelName,
        temperature,
        maxTokens,
        openAIApiKey: apiKey,
        configuration: {
          baseURL: baseUrl,
        },
      });

    case "anthropic":
      if (!apiKey) {
        throw new Error("ANTHROPIC_API_KEY is required for Anthropic provider");
      }
      return new ChatAnthropic({
        modelName,
        temperature,
        anthropicApiKey: apiKey,
      });

    case "google":
      if (!apiKey) {
        throw new Error("GOOGLE_API_KEY is required for Google provider");
      }
      return new ChatGoogleGenerativeAI({
        modelName,
        temperature,
        maxOutputTokens: maxTokens,
        apiKey,
      });

    case "ollama":
      return new ChatOllama({
        model: modelName,
        temperature,
        baseUrl: baseUrl || "http://localhost:11434",
      });

    case "groq":
      if (!apiKey) {
        throw new Error("GROQ_API_KEY is required for Groq provider");
      }
      return new ChatGroq({
        modelName,
        temperature,
        apiKey,
      });

    case "nvidia_nim":
      if (!apiKey) {
        throw new Error("NVIDIA_NIM_API_KEY is required for NVIDIA NIM provider");
      }
      return new ChatOpenAI({
        modelName,
        temperature,
        maxTokens,
        openAIApiKey: apiKey,
        configuration: {
          baseURL: baseUrl || "https://integrate.api.nvidia.com/v1",
        },
      });

    default:
      throw new Error(`Unsupported model provider: ${provider}`);
  }
}
