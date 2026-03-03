import { create } from "zustand";

export interface OllamaPullProgress {
  status: string;
  digest?: string;
  total?: number;
  completed?: number;
  error?: string;
  model?: string;
}

interface OllamaState {
  models: string[];
  isLoadingModels: boolean;
  modelsError: string | null;
  pullProgress: OllamaPullProgress | null;
  isPulling: boolean;
  pullError: string | null;
  pullComplete: boolean;
  fetchModels: (baseUrl?: string) => Promise<void>;
  pullModel: (modelName: string, baseUrl?: string) => Promise<void>;
  clearPullState: () => void;
}

const DEFAULT_BASE_URL = "/api/ollama";

export const useOllamaStore = create<OllamaState>()((set, get) => ({
  models: [],
  isLoadingModels: false,
  modelsError: null,
  pullProgress: null,
  isPulling: false,
  pullError: null,
  pullComplete: false,

  fetchModels: async (baseUrl = DEFAULT_BASE_URL) => {
    set({ isLoadingModels: true, modelsError: null });
    try {
      const isCustomUrl = baseUrl.includes("?baseUrl=");
      const url = isCustomUrl
        ? baseUrl.replace("/api/ollama", "/api/ollama/models")
        : `${baseUrl}/models`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to fetch models or Ollama not running");
      }
      const data = (await response.json()) as { models: string[]; available?: boolean };
      set({ models: data.models || [], isLoadingModels: false });
    } catch (error) {
      const err = error as Error;
      set({ modelsError: err.message, isLoadingModels: false });
    }
  },

  pullModel: async (modelName: string, baseUrl = DEFAULT_BASE_URL) => {
    set({
      isPulling: true,
      pullError: null,
      pullProgress: { status: "starting" },
      pullComplete: false,
    });

    try {
      const isCustomUrl = baseUrl.includes("?baseUrl=");
      const url = isCustomUrl
        ? baseUrl.replace("/api/ollama", "/api/ollama/pull")
        : `${baseUrl}/pull`;

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: modelName }),
      });

      if (!response.ok) {
        throw new Error("Failed to start pull");
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.trim()) {
            try {
              const data = JSON.parse(line) as OllamaPullProgress;
              set({ pullProgress: data });

              if (data.status === "error" || data.status === "complete") {
                if (data.status === "error") {
                  set({ pullError: data.error || "Pull failed", isPulling: false });
                } else {
                  set({ pullComplete: true, isPulling: false });
                  get().fetchModels(baseUrl);
                }
                return;
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }

      set({ isPulling: false });
    } catch (error) {
      const err = error as Error;
      set({ pullError: err.message, isPulling: false });
    }
  },

  clearPullState: () => {
    set({
      pullProgress: null,
      isPulling: false,
      pullError: null,
      pullComplete: false,
    });
  },
}));
