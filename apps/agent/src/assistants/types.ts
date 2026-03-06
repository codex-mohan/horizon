/**
 * Assistants Types
 */

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

export interface CreateAssistantRequest {
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

export interface UpdateAssistantRequest {
  name?: string;
  description?: string;
  system_prompt?: string;
  model_provider?: Assistant["model_provider"];
  model_name?: string;
  temperature?: number;
  max_tokens?: number;
  tools?: string[];
  memory_enabled?: boolean;
  is_public?: boolean;
  avatar_url?: string;
}

export interface AssistantUsage {
  id: string;
  assistant_id: string;
  user_id: string;
  thread_id: string;
  message_count: number;
  token_usage: {
    input: number;
    output: number;
    total: number;
  };
  last_used: string;
}

export interface AvatarGenerationRequest {
  name: string;
  description?: string;
  style?: "modern" | "minimalist" | "colorful" | "professional" | "playful";
}

export type AssistantViewMode = "list" | "grid";
export type AssistantSortBy = "name" | "date" | "usage";
