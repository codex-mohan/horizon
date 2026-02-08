/**
 * Memory Types
 */

export interface MemoryEntry {
  id: string;
  user_id: string;
  thread_id: string;
  message_id: string;
  content: string;
  embedding?: number[];
  metadata: {
    timestamp: string;
    memory_type:
      | "conversation"
      | "fact"
      | "preference"
      | "document"
      | "summary";
    importance: number; // 0-1 score
    privacy_level: "public" | "private" | "sensitive";
    source: string;
    tags?: string[];
  };
}

export interface MemoryQuery {
  query: string;
  user_id: string;
  top_k?: number;
  memory_types?: MemoryEntry["metadata"]["memory_type"][];
  recency_weight?: number; // 0-1, how much to weight recent memories
  min_importance?: number; // minimum importance score
  tags?: string[];
}

export interface MemorySearchResult {
  entry: MemoryEntry;
  score: number;
  distance?: number;
}

export interface Preference {
  key: string;
  value: string;
  confidence: number; // 0-1
  source_message_id: string;
  extracted_at: string;
  category: "style" | "topic" | "tool" | "format" | "behavior";
}

export interface UserPreferences {
  user_id: string;
  preferences: Preference[];
  summary: string;
  last_updated: string;
}

export interface PrivacySettings {
  user_id: string;
  privacy_mode_enabled: boolean;
  auto_detect_sensitive: boolean;
  excluded_topics: string[];
  retention_days: number;
  allow_preference_learning: boolean;
}

export interface MemoryConfig {
  qdrant_url: string;
  collection_name: string;
  embedding_model?: string;
  embedding_dimension?: number;
  similarity_threshold?: number;
  default_top_k?: number;
}

export interface VectorPoint {
  id: string;
  vector: number[];
  payload: Record<string, any>;
}
