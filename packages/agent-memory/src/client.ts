import { OpenAIEmbeddings } from "@langchain/openai";
import { v4 as uuidv4 } from "uuid";
import { QdrantStore } from "./qdrant-store.js";
import type {
  MemoryEntry,
  MemoryQuery,
  MemorySearchResult,
  MemoryConfig,
  PrivacySettings,
} from "./types.js";

// Type for embeddings interface
interface EmbeddingsInterface {
  embedQuery(text: string): Promise<number[]>;
  embedDocuments(texts: string[]): Promise<number[][]>;
}

/**
 * Main Memory Client
 *
 * High-level interface for storing and retrieving memories.
 * Handles embedding generation and privacy controls.
 */
export class MemoryClient {
  private store: QdrantStore;
  private embeddings: EmbeddingsInterface | null = null;
  private config: MemoryConfig;
  private privacySettings: Map<string, PrivacySettings> = new Map();
  private embeddingsAvailable: boolean = false;

  constructor(config: MemoryConfig) {
    this.config = config;
    this.store = new QdrantStore(config);

    // Initialize embeddings based on available API keys
    this.initializeEmbeddings();
  }

  /**
   * Initialize embeddings provider based on available API keys
   */
  private initializeEmbeddings(): void {
    const openaiKey = process.env.OPENAI_API_KEY;
    const ollamaUrl = process.env.OLLAMA_BASE_URL;

    if (openaiKey) {
      // Use OpenAI if key is available
      this.embeddings = new OpenAIEmbeddings({
        modelName: this.config.embedding_model || "text-embedding-3-small",
      });
      this.embeddingsAvailable = true;
      console.log("[MemoryClient] Using OpenAI embeddings");
    } else if (ollamaUrl) {
      // Use Ollama for local embeddings (dynamically import)
      this.initializeOllamaEmbeddings(ollamaUrl);
    } else {
      // No embeddings available - memory will store but not be searchable
      console.warn(
        "[MemoryClient] No embedding provider available. Memory will store but not be searchable.",
      );
      console.warn(
        "[MemoryClient] Set OPENAI_API_KEY or OLLAMA_BASE_URL to enable semantic search.",
      );
      this.embeddingsAvailable = false;
    }
  }

  /**
   * Initialize Ollama embeddings (async)
   */
  private async initializeOllamaEmbeddings(baseUrl: string): Promise<void> {
    try {
      const { OllamaEmbeddings } = await import("@langchain/ollama");
      this.embeddings = new OllamaEmbeddings({
        model: this.config.embedding_model || "nomic-embed-text",
        baseUrl: baseUrl,
      });
      this.embeddingsAvailable = true;
      console.log("[MemoryClient] Using Ollama embeddings");
    } catch (error) {
      console.error(
        "[MemoryClient] Failed to initialize Ollama embeddings:",
        error,
      );
      this.embeddingsAvailable = false;
    }
  }

  /**
   * Check if embeddings are available
   */
  hasEmbeddings(): boolean {
    return this.embeddingsAvailable && this.embeddings !== null;
  }

  /**
   * Initialize the memory system
   */
  async initialize(): Promise<void> {
    await this.store.initialize();
    console.log("[MemoryClient] Initialized successfully");
  }

  /**
   * Set privacy settings for a user
   */
  setPrivacySettings(settings: PrivacySettings): void {
    this.privacySettings.set(settings.user_id, settings);
  }

  /**
   * Get privacy settings for a user
   */
  getPrivacySettings(userId: string): PrivacySettings {
    return (
      this.privacySettings.get(userId) || {
        user_id: userId,
        privacy_mode_enabled: false,
        auto_detect_sensitive: true,
        excluded_topics: [],
        retention_days: 365,
        allow_preference_learning: true,
      }
    );
  }

  /**
   * Store a conversation turn as memory
   */
  async storeConversationTurn({
    user_id,
    thread_id,
    message_id,
    content,
    importance = 0.5,
    privacy_level = "public",
  }: {
    user_id: string;
    thread_id: string;
    message_id: string;
    content: string;
    importance?: number;
    privacy_level?: MemoryEntry["metadata"]["privacy_level"];
  }): Promise<MemoryEntry | null> {
    const settings = this.getPrivacySettings(user_id);

    // Check if privacy mode is enabled
    if (settings.privacy_mode_enabled) {
      console.log(
        `[MemoryClient] Privacy mode enabled for user ${user_id}, skipping storage`,
      );
      return null;
    }

    // Check if content should be excluded
    if (this.shouldExclude(content, settings)) {
      console.log(`[MemoryClient] Content excluded based on privacy settings`);
      return null;
    }

    // Generate embedding if available
    let embedding: number[] | undefined;
    if (this.hasEmbeddings()) {
      try {
        embedding = await this.embeddings!.embedQuery(content);
      } catch (error) {
        console.warn("[MemoryClient] Failed to generate embedding:", error);
      }
    }

    const entry: MemoryEntry = {
      id: uuidv4(),
      user_id,
      thread_id,
      message_id,
      content,
      embedding,
      metadata: {
        timestamp: new Date().toISOString(),
        memory_type: "conversation",
        importance,
        privacy_level,
        source: "user_message",
      },
    };

    await this.store.store(entry);
    return entry;
  }

  /**
   * Store an important fact
   */
  async storeFact({
    user_id,
    content,
    importance = 0.8,
    source,
  }: {
    user_id: string;
    content: string;
    importance?: number;
    source: string;
  }): Promise<MemoryEntry | null> {
    const settings = this.getPrivacySettings(user_id);

    if (settings.privacy_mode_enabled || !settings.allow_preference_learning) {
      return null;
    }

    // Generate embedding if available
    let embedding: number[] | undefined;
    if (this.hasEmbeddings()) {
      try {
        embedding = await this.embeddings!.embedQuery(content);
      } catch (error) {
        console.warn("[MemoryClient] Failed to generate embedding:", error);
      }
    }

    const entry: MemoryEntry = {
      id: uuidv4(),
      user_id,
      thread_id: "facts",
      message_id: uuidv4(),
      content,
      embedding,
      metadata: {
        timestamp: new Date().toISOString(),
        memory_type: "fact",
        importance,
        privacy_level: "private",
        source,
      },
    };

    await this.store.store(entry);
    return entry;
  }

  /**
   * Retrieve relevant memories for a query
   */
  async retrieve(query: MemoryQuery): Promise<MemorySearchResult[]> {
    const settings = this.getPrivacySettings(query.user_id);

    if (settings.privacy_mode_enabled) {
      return [];
    }

    // If no embeddings available, return empty results
    if (!this.hasEmbeddings()) {
      console.warn(
        "[MemoryClient] Cannot retrieve memories: no embedding provider available",
      );
      return [];
    }

    // Generate query embedding
    const queryVector = await this.embeddings!.embedQuery(query.query);

    // Get semantic search results
    let results = await this.store.search(queryVector, query);

    // Apply recency weighting if specified
    if (query.recency_weight && query.recency_weight > 0) {
      results = this.applyRecencyWeighting(results, query.recency_weight);
    }

    return results;
  }

  /**
   * Get recent memories for a user
   */
  async getRecentMemories(
    userId: string,
    limit: number = 10,
  ): Promise<MemoryEntry[]> {
    // Get all memories for user and sort by recency
    const query: MemoryQuery = {
      query: "recent", // Dummy query
      user_id: userId,
      top_k: limit * 3, // Get more and filter
    };

    // If no embeddings, just get from store directly
    if (!this.hasEmbeddings()) {
      // Return empty for now - could implement non-semantic retrieval
      return [];
    }

    const queryVector = await this.embeddings!.embedQuery(
      "recent conversations",
    );
    const results = await this.store.search(queryVector, query);

    return results
      .map((r) => r.entry)
      .sort(
        (a, b) =>
          new Date(b.metadata.timestamp).getTime() -
          new Date(a.metadata.timestamp).getTime(),
      )
      .slice(0, limit);
  }

  /**
   * Delete all memories for a thread
   */
  async deleteThread(userId: string, threadId: string): Promise<number> {
    return this.store.deleteByThread(userId, threadId);
  }

  /**
   * Delete all memories for a user
   */
  async deleteAllForUser(userId: string): Promise<number> {
    return this.store.deleteAllForUser(userId);
  }

  /**
   * Get memory statistics
   */
  async getStats(): Promise<{ totalPoints: number }> {
    return this.store.getStats();
  }

  /**
   * Check if memory system is healthy
   */
  async health(): Promise<boolean> {
    return this.store.health();
  }

  /**
   * Check if content should be excluded based on privacy settings
   */
  private shouldExclude(content: string, settings: PrivacySettings): boolean {
    if (settings.excluded_topics.length === 0) return false;

    const lowerContent = content.toLowerCase();
    return settings.excluded_topics.some((topic) =>
      lowerContent.includes(topic.toLowerCase()),
    );
  }

  /**
   * Apply recency weighting to search results
   */
  private applyRecencyWeighting(
    results: MemorySearchResult[],
    weight: number,
  ): MemorySearchResult[] {
    const now = Date.now();
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days in ms

    return results
      .map((result) => {
        const age = now - new Date(result.entry.metadata.timestamp).getTime();
        const recencyScore = Math.max(0, 1 - age / maxAge);
        const combinedScore =
          result.score * (1 - weight) + recencyScore * weight;

        return {
          ...result,
          score: combinedScore,
        };
      })
      .sort((a, b) => b.score - a.score);
  }
}
