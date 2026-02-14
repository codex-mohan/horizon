/**
 * Agent Memory - Long-term memory with Qdrant vector store
 *
 * Features:
 * - Per-user memory isolation
 * - Privacy mode support
 * - User preference extraction and storage
 * - Hybrid retrieval (semantic + recency)
 */

export { MemoryClient } from "./client.js";
export { PreferenceExtractor } from "./preference-extractor.js";
export { QdrantStore } from "./qdrant-store.js";

// Types
export type {
  MemoryConfig,
  MemoryEntry,
  MemoryQuery,
  MemorySearchResult,
  Preference,
  PrivacySettings,
  UserPreferences,
} from "./types.js";
