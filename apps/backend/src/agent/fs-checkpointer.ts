import fs from "node:fs";
import path from "node:path";
import type { RunnableConfig } from "@langchain/core/runnables";
import { BaseCheckpointSaver, type Checkpoint, type CheckpointTuple } from "@langchain/langgraph";

/**
 * A simple file-system based checkpointer for development.
 * Persists checkpoints to a JSON file to survive server restarts.
 */
export class FileSystemCheckpointer extends BaseCheckpointSaver {
  private readonly filePath: string;
  private checkpoints: Record<string, any> = {};

  constructor(filePath = ".checkpoints.json") {
    super();
    this.filePath = path.resolve(process.cwd(), filePath);
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(this.filePath)) {
        this.checkpoints = JSON.parse(fs.readFileSync(this.filePath, "utf-8"));
      }
    } catch (e) {
      console.error("Failed to load checkpoints:", e);
      this.checkpoints = {};
    }
  }

  private save() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.checkpoints, null, 2));
    } catch (e) {
      console.error("Failed to save checkpoints:", e);
    }
  }

  async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
    const thread_id = config.configurable?.thread_id;
    const checkpoint_id = config.configurable?.checkpoint_id;

    if (!thread_id) {
      return undefined;
    }

    this.load(); // Reload to get latest state from other processes if needed

    const threadChecks = this.checkpoints[thread_id] || [];

    if (checkpoint_id) {
      const found = threadChecks.find((c: any) => c.checkpoint.id === checkpoint_id);
      if (found) {
        return {
          config: { configurable: { thread_id, checkpoint_id } },
          checkpoint: found.checkpoint,
          metadata: found.metadata,
          parentConfig: found.parentConfig,
        };
      }
    } else {
      // Get latest
      if (threadChecks.length > 0) {
        const last = threadChecks.at(-1);
        return {
          config: {
            configurable: { thread_id, checkpoint_id: last.checkpoint.id },
          },
          checkpoint: last.checkpoint,
          metadata: last.metadata,
          parentConfig: last.parentConfig,
        };
      }
    }

    return undefined;
  }

  async *list(config: RunnableConfig, _options?: any): AsyncGenerator<CheckpointTuple> {
    const thread_id = config.configurable?.thread_id;
    if (!thread_id) {
      return;
    }

    this.load();
    const threadChecks = this.checkpoints[thread_id] || [];

    for (const c of threadChecks) {
      yield {
        config: { configurable: { thread_id, checkpoint_id: c.checkpoint.id } },
        checkpoint: c.checkpoint,
        metadata: c.metadata,
        parentConfig: c.parentConfig,
      };
    }
  }

  async put(
    config: RunnableConfig,
    checkpoint: Checkpoint,
    metadata: any,
    _newVersions: any
  ): Promise<RunnableConfig> {
    const thread_id = config.configurable?.thread_id;
    if (!thread_id) {
      return { configurable: {} };
    }

    if (!this.checkpoints[thread_id]) {
      this.checkpoints[thread_id] = [];
    }

    const nextConfig = {
      configurable: {
        thread_id,
        checkpoint_id: checkpoint.id,
      },
    };

    this.checkpoints[thread_id].push({
      checkpoint,
      metadata,
      parentConfig: config, // approximate
    });

    this.save();
    return nextConfig;
  }

  // Not implementing writes as they are deprecated/handled differently in newer versions or unused for basic chat
  async putWrites(_config: RunnableConfig, _writes: any[], _taskId: string): Promise<void> {
    // No-op for simple dev persistence
  }
}
