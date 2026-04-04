import { EventEmitter } from "node:events";
import type { SubAgentConfig, SubAgentResult } from "./types.js";

export type WorkerEventType =
  | "worker_started"
  | "worker_progress"
  | "worker_completed"
  | "worker_failed"
  | "all_workers_started"
  | "all_workers_completed";

export interface WorkerStartedEvent {
  type: "worker_started";
  task_id: string;
  name: string;
  tools: string[];
  timestamp: number;
}

export interface WorkerProgressEvent {
  type: "worker_progress";
  task_id: string;
  name: string;
  status: "initializing" | "running" | "tool_call" | "completed";
  message?: string;
  tool_call?: {
    name: string;
    args?: Record<string, unknown>;
  };
  timestamp: number;
}

export interface WorkerCompletedEvent {
  type: "worker_completed";
  task_id: string;
  name: string;
  status: "success" | "failure";
  output: string;
  errors?: string[];
  execution_time_ms?: number;
  timestamp: number;
}

export interface WorkerFailedEvent {
  type: "worker_failed";
  task_id: string;
  name: string;
  error: string;
  timestamp: number;
}

export interface AllWorkersStartedEvent {
  type: "all_workers_started";
  count: number;
  timestamp: number;
}

export interface AllWorkersCompletedEvent {
  type: "all_workers_completed";
  results: WorkerCompletedEvent[];
  summary: string;
  success_count: number;
  failure_count: number;
  timestamp: number;
}

export type WorkerEvent =
  | WorkerStartedEvent
  | WorkerProgressEvent
  | WorkerCompletedEvent
  | WorkerFailedEvent
  | AllWorkersStartedEvent
  | AllWorkersCompletedEvent;

export class WorkerEventEmitter extends EventEmitter {
  private static instance: WorkerEventEmitter | null = null;

  private constructor() {
    super();
    this.setMaxListeners(100);
  }

  static getInstance(): WorkerEventEmitter {
    if (!WorkerEventEmitter.instance) {
      WorkerEventEmitter.instance = new WorkerEventEmitter();
    }
    return WorkerEventEmitter.instance;
  }

  emitWorkerStarted(config: SubAgentConfig): void {
    const event: WorkerStartedEvent = {
      type: "worker_started",
      task_id: config.id,
      name: config.name,
      tools: config.tools,
      timestamp: Date.now(),
    };
    this.emit("worker_event", event);
  }

  emitWorkerProgress(
    taskId: string,
    name: string,
    status: WorkerProgressEvent["status"],
    message?: string,
    toolCall?: { name: string; args?: Record<string, unknown> }
  ): void {
    const event: WorkerProgressEvent = {
      type: "worker_progress",
      task_id: taskId,
      name,
      status,
      message,
      tool_call: toolCall,
      timestamp: Date.now(),
    };
    this.emit("worker_event", event);
  }

  emitWorkerCompleted(result: SubAgentResult, name: string): void {
    const event: WorkerCompletedEvent = {
      type: "worker_completed",
      task_id: result.task_id,
      name,
      status: result.status,
      output: result.output,
      errors: result.errors,
      execution_time_ms: result.metrics?.execution_time_ms,
      timestamp: Date.now(),
    };
    this.emit("worker_event", event);
  }

  emitWorkerFailed(taskId: string, name: string, error: string): void {
    const event: WorkerFailedEvent = {
      type: "worker_failed",
      task_id: taskId,
      name,
      error,
      timestamp: Date.now(),
    };
    this.emit("worker_event", event);
  }

  emitAllWorkersStarted(count: number): void {
    const event: AllWorkersStartedEvent = {
      type: "all_workers_started",
      count,
      timestamp: Date.now(),
    };
    this.emit("worker_event", event);
  }

  emitAllWorkersCompleted(
    results: WorkerCompletedEvent[],
    successCount: number,
    failureCount: number
  ): void {
    const event: AllWorkersCompletedEvent = {
      type: "all_workers_completed",
      results,
      summary: `Completed ${results.length} workers: ${successCount} succeeded, ${failureCount} failed`,
      success_count: successCount,
      failure_count: failureCount,
      timestamp: Date.now(),
    };
    this.emit("worker_event", event);
  }

  onWorkerEvent(callback: (event: WorkerEvent) => void): () => void {
    const handler = (event: WorkerEvent) => callback(event);
    this.on("worker_event", handler);
    return () => {
      this.off("worker_event", handler);
    };
  }
}

export const workerEventEmitter = WorkerEventEmitter.getInstance();
