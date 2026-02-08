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
export { QdrantStore } from "./qdrant-store.js";
export { PreferenceExtractor } from "./preference-extractor.js";

// Types
export type {
  MemoryEntry,
  MemoryQuery,
  MemorySearchResult,
  UserPreferences,
  Preference,
  MemoryConfig,
  PrivacySettings,
} from "./types.js";
