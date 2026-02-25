import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ModelProvider = "openai" | "anthropic" | "groq" | "nvidia_nim" | "google" | "ollama";

export interface ProviderConfig {
  apiKey: string;
  baseUrl?: string;
  enabled: boolean;
}

export interface ModelConfig {
  provider: ModelProvider;
  modelName: string;
  temperature: number;
  maxTokens: number;
  enableReasoning: boolean;
  providers: Record<ModelProvider, ProviderConfig>;
}

interface ModelConfigState {
  config: ModelConfig;
  setProvider: (provider: ModelProvider) => void;
  setModelName: (modelName: string) => void;
  setTemperature: (temperature: number) => void;
  setMaxTokens: (maxTokens: number) => void;
  setEnableReasoning: (enable: boolean) => void;
  setProviderApiKey: (provider: ModelProvider, apiKey: string) => void;
  setProviderBaseUrl: (provider: ModelProvider, baseUrl: string | undefined) => void;
  setProviderEnabled: (provider: ModelProvider, enabled: boolean) => void;
  getProviderConfig: (provider: ModelProvider) => ProviderConfig;
  isCurrentProviderConfigured: () => boolean;
}

export const DEFAULT_MODELS: Record<ModelProvider, string[]> = {
  nvidia_nim: [
    "qwen/qwen3.5-397b-a17b",
    "meta/llama-3.1-70b-instruct",
    "meta/llama-3.3-70b-instruct",
    "nvidia/llama-3.1-nemotron-70b-instruct",
    "mistralai/mixtral-8x7b-instruct-v0.1",
    "deepseek-ai/deepseek-r1",
  ],
  openai: [
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-4-turbo",
    "gpt-4",
    "gpt-3.5-turbo",
    "o1-preview",
    "o1-mini",
  ],
  anthropic: [
    "claude-3-5-sonnet-20241022",
    "claude-3-5-haiku-20241022",
    "claude-3-opus-20240229",
    "claude-3-sonnet-20240229",
    "claude-3-haiku-20240307",
  ],
  groq: [
    "llama-3.3-70b-versatile",
    "llama-3.1-70b-versatile",
    "llama-3.1-8b-instant",
    "mixtral-8x7b-32768",
    "gemma2-9b-it",
  ],
  google: ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-1.5-flash-8b", "gemini-pro"],
  ollama: ["llama3.2", "llama3.1", "llama3", "mistral", "codellama", "deepseek-r1", "qwen2.5"],
};

export const PROVIDER_INFO: Record<
  ModelProvider,
  { name: string; icon: string; requiresApiKey: boolean; supportsReasoning: boolean }
> = {
  nvidia_nim: {
    name: "NVIDIA NIM",
    icon: "nvidia",
    requiresApiKey: true,
    supportsReasoning: true,
  },
  openai: {
    name: "OpenAI",
    icon: "openai",
    requiresApiKey: true,
    supportsReasoning: true,
  },
  anthropic: {
    name: "Anthropic",
    icon: "anthropic",
    requiresApiKey: true,
    supportsReasoning: true,
  },
  groq: {
    name: "Groq",
    icon: "groq",
    requiresApiKey: true,
    supportsReasoning: false,
  },
  google: {
    name: "Google",
    icon: "google",
    requiresApiKey: true,
    supportsReasoning: false,
  },
  ollama: {
    name: "Ollama (Local)",
    icon: "ollama",
    requiresApiKey: false,
    supportsReasoning: true,
  },
};

export const REASONING_MODELS = ["o1-preview", "o1-mini", "deepseek-ai/deepseek-r1", "deepseek-r1"];

export function supportsReasoning(modelName: string, provider: ModelProvider): boolean {
  if (PROVIDER_INFO[provider].supportsReasoning) {
    return true;
  }
  return REASONING_MODELS.some((rm) => modelName.toLowerCase().includes(rm.toLowerCase()));
}

export const useModelConfig = create<ModelConfigState>()(
  persist(
    (set, get) => ({
      config: {
        provider: "nvidia_nim",
        modelName: "qwen/qwen3.5-397b-a17b",
        temperature: 0.7,
        maxTokens: 4096,
        enableReasoning: false,
        providers: {
          nvidia_nim: { apiKey: "", baseUrl: "https://integrate.api.nvidia.com/v1", enabled: true },
          openai: { apiKey: "", baseUrl: undefined, enabled: false },
          anthropic: { apiKey: "", baseUrl: undefined, enabled: false },
          groq: { apiKey: "", baseUrl: undefined, enabled: false },
          google: { apiKey: "", baseUrl: undefined, enabled: false },
          ollama: { apiKey: "", baseUrl: "http://localhost:11434", enabled: false },
        },
      },
      setProvider: (provider) =>
        set((state) => {
          const defaultModel = DEFAULT_MODELS[provider][0];
          return {
            config: {
              ...state.config,
              provider,
              modelName: defaultModel,
            },
          };
        }),
      setModelName: (modelName) =>
        set((state) => ({
          config: { ...state.config, modelName },
        })),
      setTemperature: (temperature) =>
        set((state) => ({
          config: { ...state.config, temperature },
        })),
      setMaxTokens: (maxTokens) =>
        set((state) => ({
          config: { ...state.config, maxTokens },
        })),
      setEnableReasoning: (enableReasoning) =>
        set((state) => ({
          config: { ...state.config, enableReasoning },
        })),
      setProviderApiKey: (provider, apiKey) =>
        set((state) => ({
          config: {
            ...state.config,
            providers: {
              ...state.config.providers,
              [provider]: { ...state.config.providers[provider], apiKey },
            },
          },
        })),
      setProviderBaseUrl: (provider, baseUrl) =>
        set((state) => ({
          config: {
            ...state.config,
            providers: {
              ...state.config.providers,
              [provider]: { ...state.config.providers[provider], baseUrl },
            },
          },
        })),
      setProviderEnabled: (provider, enabled) =>
        set((state) => ({
          config: {
            ...state.config,
            providers: {
              ...state.config.providers,
              [provider]: { ...state.config.providers[provider], enabled },
            },
          },
        })),
      getProviderConfig: (provider) => get().config.providers[provider],
      isCurrentProviderConfigured: () => {
        const { provider, providers } = get().config;
        const providerConfig = providers[provider];
        if (PROVIDER_INFO[provider].requiresApiKey) {
          return providerConfig.enabled && providerConfig.apiKey.length > 0;
        }
        return providerConfig.enabled;
      },
    }),
    {
      name: "horizon-model-config",
    }
  )
);
