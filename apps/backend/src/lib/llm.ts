import { ChatAnthropic } from "@langchain/anthropic";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatGroq } from "@langchain/groq";
import { ChatOllama } from "@langchain/ollama";
import { ChatOpenAI } from "@langchain/openai";
import { type AgentConfig, agentConfig } from "./config.js";

export async function createLLM(config: AgentConfig = agentConfig): Promise<BaseChatModel> {
  const { MODEL_PROVIDER, MODEL_NAME, TEMPERATURE, MAX_TOKENS, BASE_URL } = config;

  console.log(`[LLM] Initializing ${MODEL_PROVIDER} model: ${MODEL_NAME}`);

  switch (MODEL_PROVIDER) {
    case "openai":
      return new ChatOpenAI({
        modelName: MODEL_NAME,
        temperature: TEMPERATURE,
        maxTokens: MAX_TOKENS,
        openAIApiKey: config.OPENAI_API_KEY,
        configuration: {
          baseURL: BASE_URL,
        },
      });

    case "anthropic":
      if (!config.ANTHROPIC_API_KEY) {
        throw new Error("ANTHROPIC_API_KEY is required");
      }
      return new ChatAnthropic({
        modelName: MODEL_NAME,
        temperature: TEMPERATURE,
        anthropicApiKey: config.ANTHROPIC_API_KEY,
      });

    case "google":
      if (!config.GOOGLE_API_KEY) {
        throw new Error("GOOGLE_API_KEY is required");
      }
      return new ChatGoogleGenerativeAI({
        modelName: MODEL_NAME,
        temperature: TEMPERATURE,
        maxOutputTokens: MAX_TOKENS, // Google uses different param name
        apiKey: config.GOOGLE_API_KEY,
      });

    case "ollama":
      return new ChatOllama({
        model: MODEL_NAME,
        temperature: TEMPERATURE,
        baseUrl: config.BASE_URL || "http://localhost:11434",
      });

    case "groq":
      if (!config.GROQ_API_KEY) {
        throw new Error("GROQ_API_KEY is required");
      }
      return new ChatGroq({
        modelName: MODEL_NAME,
        temperature: TEMPERATURE,
        apiKey: config.GROQ_API_KEY,
      });

    case "nvidia_nim":
      if (!config.NVIDIA_NIM_API_KEY) {
        throw new Error("NVIDIA_NIM_API_KEY is required for the nvidia_nim provider");
      }
      return new ChatOpenAI({
        modelName: MODEL_NAME,
        temperature: TEMPERATURE,
        maxTokens: MAX_TOKENS,
        openAIApiKey: config.NVIDIA_NIM_API_KEY,
        configuration: {
          baseURL: "https://integrate.api.nvidia.com/v1",
        },
      });

    default:
      throw new Error(`Unsupported model provider: ${MODEL_PROVIDER}`);
  }
}
