import { QdrantClient } from "@qdrant/js-client-rest";
import type {
  MemoryEntry,
  MemoryQuery,
  MemorySearchResult,
  MemoryConfig,
  VectorPoint,
} from "./types.js";

/**
 * Qdrant Vector Store for Agent Memory
 *
 * Handles all vector operations:
 * - Collection management
 * - Point (memory) storage and retrieval
 * - Semantic search with filtering
 */
export class QdrantStore {
  private client: QdrantClient;
  private config: MemoryConfig;
  private initialized: boolean = false;

  constructor(config: MemoryConfig) {
    this.config = {
      embedding_dimension: 1536, // OpenAI default
      similarity_threshold: 0.7,
      default_top_k: 5,
      ...config,
    };

    this.client = new QdrantClient({
      url: config.qdrant_url,
    });
  }

  /**
   * Initialize the collection if it doesn't exist
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const collections = await this.client.getCollections();
      const exists = collections.collections.some(
        (c: { name: string }) => c.name === this.config.collection_name,
      );

      if (!exists) {
        console.log(
          `[Qdrant] Creating collection: ${this.config.collection_name}`,
        );
        await this.client.createCollection(this.config.collection_name, {
          vectors: {
            size: this.config.embedding_dimension!,
            distance: "Cosine",
          },
          optimizers_config: {
            default_segment_number: 2,
          },
          replication_factor: 1,
        });

        // Create indexes for common filters
        await this.client.createPayloadIndex(this.config.collection_name, {
          field_name: "user_id",
          field_schema: "keyword",
        });

        await this.client.createPayloadIndex(this.config.collection_name, {
          field_name: "metadata.memory_type",
          field_schema: "keyword",
        });

        await this.client.createPayloadIndex(this.config.collection_name, {
          field_name: "metadata.timestamp",
          field_schema: "datetime",
        });

        console.log("[Qdrant] Collection and indexes created");
      }

      this.initialized = true;
    } catch (error) {
      console.error("[Qdrant] Failed to initialize:", error);
      throw error;
    }
  }

  /**
   * Store a memory entry with its embedding
   */
  async store(entry: MemoryEntry): Promise<void> {
    await this.initialize();

    if (!entry.embedding) {
      throw new Error("Memory entry must have an embedding");
    }

    const point: VectorPoint = {
      id: entry.id,
      vector: entry.embedding,
      payload: {
        user_id: entry.user_id,
        thread_id: entry.thread_id,
        message_id: entry.message_id,
        content: entry.content,
        metadata: entry.metadata,
      },
    };

    await this.client.upsert(this.config.collection_name, {
      points: [point],
    });
  }

  /**
   * Store multiple memory entries
   */
  async storeBatch(entries: MemoryEntry[]): Promise<void> {
    await this.initialize();

    const points: VectorPoint[] = entries
      .filter((e) => e.embedding)
      .map((entry) => ({
        id: entry.id,
        vector: entry.embedding!,
        payload: {
          user_id: entry.user_id,
          thread_id: entry.thread_id,
          message_id: entry.message_id,
          content: entry.content,
          metadata: entry.metadata,
        },
      }));

    if (points.length === 0) return;

    await this.client.upsert(this.config.collection_name, {
      points,
    });
  }

  /**
   * Search memories by vector with filters
   */
  async search(
    queryVector: number[],
    query: MemoryQuery,
  ): Promise<MemorySearchResult[]> {
    await this.initialize();

    const topK = query.top_k || this.config.default_top_k!;

    // Build filter conditions
    const mustConditions: any[] = [
      {
        key: "user_id",
        match: { value: query.user_id },
      },
    ];

    if (query.memory_types && query.memory_types.length > 0) {
      mustConditions.push({
        key: "metadata.memory_type",
        match: { any: query.memory_types },
      });
    }

    if (query.min_importance !== undefined) {
      mustConditions.push({
        key: "metadata.importance",
        range: { gte: query.min_importance },
      });
    }

    if (query.tags && query.tags.length > 0) {
      mustConditions.push({
        key: "metadata.tags",
        match: { any: query.tags },
      });
    }

    const results = await this.client.search(this.config.collection_name, {
      vector: queryVector,
      limit: topK,
      with_payload: true,
      with_vector: false,
      filter: mustConditions.length > 0 ? { must: mustConditions } : undefined,
    });

    return results.map((result) => ({
      entry: {
        id: result.id as string,
        user_id: result.payload?.user_id as string,
        thread_id: result.payload?.thread_id as string,
        message_id: result.payload?.message_id as string,
        content: result.payload?.content as string,
        metadata: result.payload?.metadata as MemoryEntry["metadata"],
      },
      score: result.score || 0,
      distance: result.score,
    }));
  }

  /**
   * Get memories by thread ID
   */
  async getByThread(
    userId: string,
    threadId: string,
    limit: number = 100,
  ): Promise<MemoryEntry[]> {
    await this.initialize();

    const results = await this.client.scroll(this.config.collection_name, {
      filter: {
        must: [
          { key: "user_id", match: { value: userId } },
          { key: "thread_id", match: { value: threadId } },
        ],
      },
      limit,
      with_payload: true,
    });

    return results.points.map((point) => ({
      id: point.id as string,
      user_id: point.payload?.user_id as string,
      thread_id: point.payload?.thread_id as string,
      message_id: point.payload?.message_id as string,
      content: point.payload?.content as string,
      metadata: point.payload?.metadata as MemoryEntry["metadata"],
    }));
  }

  /**
   * Delete memories by thread ID
   */
  async deleteByThread(userId: string, threadId: string): Promise<number> {
    await this.initialize();

    const results = await this.client.scroll(this.config.collection_name, {
      filter: {
        must: [
          { key: "user_id", match: { value: userId } },
          { key: "thread_id", match: { value: threadId } },
        ],
      },
      limit: 1000,
    });

    const ids = results.points.map((p) => p.id);

    if (ids.length > 0) {
      await this.client.delete(this.config.collection_name, {
        points: ids,
      });
    }

    return ids.length;
  }

  /**
   * Delete a specific memory
   */
  async delete(userId: string, memoryId: string): Promise<void> {
    await this.initialize();

    await this.client.delete(this.config.collection_name, {
      points: [memoryId],
    });
  }

  /**
   * Delete all memories for a user
   */
  async deleteAllForUser(userId: string): Promise<number> {
    await this.initialize();

    const results = await this.client.scroll(this.config.collection_name, {
      filter: {
        must: [{ key: "user_id", match: { value: userId } }],
      },
      limit: 10000,
    });

    const ids = results.points.map((p) => p.id);

    if (ids.length > 0) {
      await this.client.delete(this.config.collection_name, {
        points: ids,
      });
    }

    return ids.length;
  }

  /**
   * Get collection stats
   */
  async getStats(): Promise<{ totalPoints: number }> {
    await this.initialize();

    const info = await this.client.getCollection(this.config.collection_name);
    return {
      totalPoints: info.points_count || 0,
    };
  }

  /**
   * Check if store is healthy
   */
  async health(): Promise<boolean> {
    try {
      await this.client.getCollections();
      return true;
    } catch {
      return false;
    }
  }
}
