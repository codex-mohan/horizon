/**
 * Assistants Store
 *
 * Manages assistant state and API interactions
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AssistantViewMode = "list" | "grid";
export type AssistantSortBy = "name" | "date" | "usage";

export interface Assistant {
  id: string;
  user_id: string;
  name: string;
  description: string;
  avatar_url?: string;
  system_prompt: string;
  model_provider: "openai" | "anthropic" | "groq" | "ollama";
  model_name: string;
  temperature: number;
  max_tokens: number;
  tools: string[];
  memory_enabled: boolean;
  is_default: boolean;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateAssistantData {
  name: string;
  description?: string;
  system_prompt: string;
  model_provider?: Assistant["model_provider"];
  model_name?: string;
  temperature?: number;
  max_tokens?: number;
  tools?: string[];
  memory_enabled?: boolean;
  is_public?: boolean;
  avatar_url?: string;
}

interface AssistantsState {
  assistants: Assistant[];
  selectedAssistant: Assistant | null;
  viewMode: AssistantViewMode;
  sortBy: AssistantSortBy;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchAssistants: (apiUrl: string, userId: string) => Promise<void>;
  createAssistant: (
    apiUrl: string,
    userId: string,
    data: CreateAssistantData
  ) => Promise<Assistant>;
  updateAssistant: (
    apiUrl: string,
    userId: string,
    id: string,
    data: Partial<CreateAssistantData>
  ) => Promise<void>;
  deleteAssistant: (
    apiUrl: string,
    userId: string,
    id: string
  ) => Promise<void>;
  setDefaultAssistant: (
    apiUrl: string,
    userId: string,
    id: string
  ) => Promise<void>;
  selectAssistant: (assistant: Assistant | null) => void;
  setViewMode: (mode: AssistantViewMode) => void;
  setSortBy: (sort: AssistantSortBy) => void;
  getDefaultAssistant: () => Assistant | null;
}

export const useAssistantsStore = create<AssistantsState>()(
  persist(
    (set, get) => ({
      assistants: [],
      selectedAssistant: null,
      viewMode: "grid",
      sortBy: "date",
      isLoading: false,
      error: null,

      fetchAssistants: async (apiUrl: string, userId: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch(
            `${apiUrl}/assistants?user_id=${userId}&include_public=true`
          );
          if (!response.ok) {
            throw new Error("Failed to fetch assistants");
          }
          const assistants = await response.json();
          set({ assistants, isLoading: false });
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false });
        }
      },

      createAssistant: async (
        apiUrl: string,
        userId: string,
        data: CreateAssistantData
      ) => {
        const response = await fetch(`${apiUrl}/assistants?user_id=${userId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!response.ok) {
          throw new Error("Failed to create assistant");
        }
        const assistant = await response.json();
        set((state) => ({ assistants: [...state.assistants, assistant] }));
        return assistant;
      },

      updateAssistant: async (
        apiUrl: string,
        userId: string,
        id: string,
        data: Partial<CreateAssistantData>
      ) => {
        const response = await fetch(
          `${apiUrl}/assistants/${id}?user_id=${userId}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          }
        );
        if (!response.ok) {
          throw new Error("Failed to update assistant");
        }
        const updated = await response.json();
        set((state) => ({
          assistants: state.assistants.map((a) => (a.id === id ? updated : a)),
        }));
      },

      deleteAssistant: async (apiUrl: string, userId: string, id: string) => {
        const response = await fetch(
          `${apiUrl}/assistants/${id}?user_id=${userId}`,
          {
            method: "DELETE",
          }
        );
        if (!response.ok) {
          throw new Error("Failed to delete assistant");
        }
        set((state) => ({
          assistants: state.assistants.filter((a) => a.id !== id),
          selectedAssistant:
            state.selectedAssistant?.id === id ? null : state.selectedAssistant,
        }));
      },

      setDefaultAssistant: async (
        apiUrl: string,
        userId: string,
        id: string
      ) => {
        const response = await fetch(
          `${apiUrl}/assistants/${id}/default?user_id=${userId}`,
          {
            method: "POST",
          }
        );
        if (!response.ok) {
          throw new Error("Failed to set default assistant");
        }
        set((state) => ({
          assistants: state.assistants.map((a) => ({
            ...a,
            is_default: a.user_id === userId ? a.id === id : a.is_default,
          })),
        }));
      },

      selectAssistant: (assistant: Assistant | null) => {
        set({ selectedAssistant: assistant });
      },

      setViewMode: (mode: AssistantViewMode) => {
        set({ viewMode: mode });
      },

      setSortBy: (sort: AssistantSortBy) => {
        set({ sortBy: sort });
      },

      getDefaultAssistant: () => {
        return get().assistants.find((a) => a.is_default) || null;
      },
    }),
    {
      name: "horizon-assistants",
      partialize: (state) => ({
        viewMode: state.viewMode,
        sortBy: state.sortBy,
      }),
    }
  )
);
