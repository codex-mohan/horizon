import fs from "node:fs";
import path from "node:path";
import { getGlobalDataDir } from "@horizon/shared-utils";
import type { RunnableConfig } from "@langchain/core/runnables";
import {
  BaseCheckpointSaver,
  type Checkpoint,
  type CheckpointMetadata,
  type CheckpointTuple,
} from "@langchain/langgraph";

interface StoredCheckpoint {
  checkpoint: Checkpoint;
  metadata: CheckpointMetadata;
  parentConfig: RunnableConfig | null;
  createdAt: number;
}

interface ThreadCheckpoints {
  checkpoints: Record<string, StoredCheckpoint>;
  latestId: string | null;
}

/**
 * A file-system based checkpointer for development.
 * Persists checkpoints to a JSON file to survive server restarts.
 *
 * Key features for branching support:
 * - Properly tracks parent checkpoint relationships
 * - Stores checkpoint metadata for building conversation tree
 * - Returns checkpoints in proper order for history display
 */
export class FileSystemCheckpointer extends BaseCheckpointSaver {
  private readonly filePath: string;
  private checkpoints: Record<string, ThreadCheckpoints> = {};

  constructor(filePath = ".checkpoints.json") {
    super();
    this.filePath = path.resolve(getGlobalDataDir(), filePath);
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(this.filePath)) {
        this.checkpoints = JSON.parse(fs.readFileSync(this.filePath, "utf-8"));
      }
    } catch (e) {
      console.error("[FileSystemCheckpointer] Failed to load checkpoints:", e);
      this.checkpoints = {};
    }
  }

  private save() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.checkpoints, null, 2));
    } catch (e) {
      console.error("[FileSystemCheckpointer] Failed to save checkpoints:", e);
    }
  }

  async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
    const thread_id = config.configurable?.thread_id;
    const checkpoint_id = config.configurable?.checkpoint_id;

    if (!thread_id) {
      return undefined;
    }

    this.load();

    const threadData = this.checkpoints[thread_id];
    if (!threadData) {
      return undefined;
    }

    if (checkpoint_id) {
      const stored = threadData.checkpoints[checkpoint_id];
      if (stored) {
        return {
          config: { configurable: { thread_id, checkpoint_id } },
          checkpoint: stored.checkpoint,
          metadata: stored.metadata,
          parentConfig: stored.parentConfig ?? undefined,
        };
      }
    } else {
      // Get latest checkpoint
      if (threadData.latestId) {
        const stored = threadData.checkpoints[threadData.latestId];
        if (stored) {
          return {
            config: { configurable: { thread_id, checkpoint_id: threadData.latestId } },
            checkpoint: stored.checkpoint,
            metadata: stored.metadata,
            parentConfig: stored.parentConfig ?? undefined,
          };
        }
      }
    }

    return undefined;
  }

  async *list(
    config: RunnableConfig,
    options?: { limit?: number; before?: RunnableConfig }
  ): AsyncGenerator<CheckpointTuple> {
    const thread_id = config.configurable?.thread_id;
    if (!thread_id) {
      return;
    }

    this.load();

    const threadData = this.checkpoints[thread_id];
    if (!threadData) {
      return;
    }

    const checkpointIds = Object.keys(threadData.checkpoints);
    const limit = options?.limit ?? 100;

    // Sort by createdAt (oldest first for history)
    checkpointIds.sort((a, b) => {
      const aTime = threadData.checkpoints[a].createdAt;
      const bTime = threadData.checkpoints[b].createdAt;
      return aTime - bTime;
    });

    // If 'before' is specified, only return checkpoints before that one
    let beforeId: string | undefined;
    if (options?.before?.configurable?.checkpoint_id) {
      beforeId = options.before.configurable.checkpoint_id;
    }

    let count = 0;
    for (const checkpointId of checkpointIds) {
      if (count >= limit) break;
      if (beforeId && checkpointId === beforeId) break;

      const stored = threadData.checkpoints[checkpointId];
      yield {
        config: { configurable: { thread_id, checkpoint_id: checkpointId } },
        checkpoint: stored.checkpoint,
        metadata: stored.metadata,
        parentConfig: stored.parentConfig ?? undefined,
      };
      count++;
    }
  }

  async put(
    config: RunnableConfig,
    checkpoint: Checkpoint,
    metadata: Record<string, unknown>,
    _newVersions?: Record<string, unknown>
  ): Promise<RunnableConfig> {
    const thread_id = config.configurable?.thread_id;
    if (!thread_id) {
      return { configurable: {} };
    }

    if (!this.checkpoints[thread_id]) {
      this.checkpoints[thread_id] = {
        checkpoints: {},
        latestId: null,
      };
    }

    const threadData = this.checkpoints[thread_id];

    // Store the parent config - this is the config passed to this call,
    // which is the checkpoint we branched FROM
    const parentConfig = config.configurable?.checkpoint_id
      ? (threadData.checkpoints[config.configurable.checkpoint_id]?.parentConfig ?? config)
      : null;

    const stored: StoredCheckpoint = {
      checkpoint,
      metadata: metadata as CheckpointMetadata,
      parentConfig,
      createdAt: Date.now(),
    };

    threadData.checkpoints[checkpoint.id] = stored;
    threadData.latestId = checkpoint.id;

    this.save();

    return {
      configurable: {
        thread_id,
        checkpoint_id: checkpoint.id,
      },
    };
  }

  async putWrites(
    _config: RunnableConfig,
    _writes: Array<[string, unknown]>,
    _taskId: string
  ): Promise<void> {
    // No-op for simple dev persistence
  }

  async deleteThread(thread_id: string): Promise<void> {
    if (this.checkpoints[thread_id]) {
      delete this.checkpoints[thread_id];
      this.save();
    }
  }

  getThreadIds(): string[] {
    this.load();
    return Object.keys(this.checkpoints);
  }

  hasThread(thread_id: string): boolean {
    this.load();
    return thread_id in this.checkpoints;
  }

  /**
   * Get all checkpoint IDs for a thread (useful for debugging)
   */
  getCheckpointIds(thread_id: string): string[] {
    this.load();
    const threadData = this.checkpoints[thread_id];
    if (!threadData) return [];
    return Object.keys(threadData.checkpoints);
  }

  /**
   * Get checkpoint by ID (useful for debugging)
   */
  getCheckpoint(thread_id: string, checkpoint_id: string): StoredCheckpoint | undefined {
    this.load();
    return this.checkpoints[thread_id]?.checkpoints[checkpoint_id];
  }
}
