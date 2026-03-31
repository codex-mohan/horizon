import { create } from "zustand";

export type WorkerStatus =
  | "pending"
  | "initializing"
  | "running"
  | "tool_call"
  | "completed"
  | "failed";

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

export interface WorkerStartedEvent {
  type: "worker_started";
  task_id: string;
  name: string;
  tools: string[];
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

export interface WorkerState {
  id: string;
  name: string;
  status: WorkerStatus;
  tools: string[];
  message: string;
  toolCall?: {
    name: string;
    args?: Record<string, unknown>;
  };
  output?: string;
  errors?: string[];
  executionTimeMs?: number;
  startTime?: number;
  endTime?: number;
}

export interface WorkerProgressState {
  sessionId: string;
  runMode: "parallel" | "sequential";
  workers: Record<string, WorkerState>;
  isActive: boolean;
  totalWorkers: number;
  completedWorkers: number;
  successCount: number;
  failureCount: number;
  finalResult?: {
    success: boolean;
    summary: string;
    results: WorkerCompletedEvent[];
  };
}

interface WorkerProgressStore {
  sessions: Record<string, WorkerProgressState>;
  activeSessionId: string | null;

  createSession: (runMode?: "parallel" | "sequential") => string;
  clearSession: (sessionId: string) => void;
  clearAllSessions: () => void;

  handleWorkerEvent: (event: WorkerEvent) => void;

  getActiveSession: () => WorkerProgressState | null;
  getWorker: (sessionId: string, workerId: string) => WorkerState | undefined;
  getSessionWorkers: (sessionId: string) => WorkerState[];
}

function generateSessionId(): string {
  return `worker-session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export const useWorkerProgressStore = create<WorkerProgressStore>((set, get) => ({
  sessions: {},
  activeSessionId: null,

  createSession: (runMode = "parallel") => {
    const sessionId = generateSessionId();
    const state: WorkerProgressState = {
      sessionId,
      runMode,
      workers: {},
      isActive: true,
      totalWorkers: 0,
      completedWorkers: 0,
      successCount: 0,
      failureCount: 0,
    };

    set((s) => ({
      sessions: { ...s.sessions, [sessionId]: state },
      activeSessionId: sessionId,
    }));

    return sessionId;
  },

  clearSession: (sessionId: string) => {
    set((s) => {
      const { [sessionId]: _, ...rest } = s.sessions;
      return {
        sessions: rest,
        activeSessionId: s.activeSessionId === sessionId ? null : s.activeSessionId,
      };
    });
  },

  clearAllSessions: () => {
    set({ sessions: {}, activeSessionId: null });
  },

  handleWorkerEvent: (event: WorkerEvent) => {
    const { activeSessionId, sessions } = get();
    if (!activeSessionId) return;

    const session = sessions[activeSessionId];
    if (!session) return;

    switch (event.type) {
      case "worker_started": {
        const worker: WorkerState = {
          id: event.task_id,
          name: event.name,
          status: "initializing",
          tools: event.tools,
          message: "Starting worker...",
          startTime: event.timestamp,
        };

        set((s) => ({
          sessions: {
            ...s.sessions,
            [activeSessionId]: {
              ...s.sessions[activeSessionId],
              workers: {
                ...s.sessions[activeSessionId].workers,
                [event.task_id]: worker,
              },
              totalWorkers: s.sessions[activeSessionId].totalWorkers + 1,
            },
          },
        }));
        break;
      }

      case "worker_progress": {
        const existingWorker = session.workers[event.task_id];
        if (!existingWorker) return;

        const statusMap: Record<string, WorkerStatus> = {
          initializing: "initializing",
          running: "running",
          tool_call: "tool_call",
          completed: "completed",
        };

        set((s) => ({
          sessions: {
            ...s.sessions,
            [activeSessionId]: {
              ...s.sessions[activeSessionId],
              workers: {
                ...s.sessions[activeSessionId].workers,
                [event.task_id]: {
                  ...existingWorker,
                  status: statusMap[event.status] || "running",
                  message: event.message || existingWorker.message,
                  toolCall: event.tool_call,
                },
              },
            },
          },
        }));
        break;
      }

      case "worker_completed": {
        const existingWorker = session.workers[event.task_id];
        if (!existingWorker) return;

        const newCompleted = session.completedWorkers + 1;
        const newSuccess = session.successCount + (event.status === "success" ? 1 : 0);
        const newFailure = session.failureCount + (event.status === "failure" ? 1 : 0);

        set((s) => ({
          sessions: {
            ...s.sessions,
            [activeSessionId]: {
              ...s.sessions[activeSessionId],
              workers: {
                ...s.sessions[activeSessionId].workers,
                [event.task_id]: {
                  ...existingWorker,
                  status: event.status === "success" ? "completed" : "failed",
                  output: event.output,
                  errors: event.errors,
                  executionTimeMs: event.execution_time_ms,
                  endTime: event.timestamp,
                },
              },
              completedWorkers: newCompleted,
              successCount: newSuccess,
              failureCount: newFailure,
            },
          },
        }));
        break;
      }

      case "worker_failed": {
        const existingWorker = session.workers[event.task_id];
        if (!existingWorker) return;

        set((s) => ({
          sessions: {
            ...s.sessions,
            [activeSessionId]: {
              ...s.sessions[activeSessionId],
              workers: {
                ...s.sessions[activeSessionId].workers,
                [event.task_id]: {
                  ...existingWorker,
                  status: "failed",
                  errors: [event.error],
                  endTime: event.timestamp,
                },
              },
              completedWorkers: session.completedWorkers + 1,
              failureCount: session.failureCount + 1,
            },
          },
        }));
        break;
      }

      case "all_workers_started": {
        set((s) => ({
          sessions: {
            ...s.sessions,
            [activeSessionId]: {
              ...s.sessions[activeSessionId],
              totalWorkers: event.count,
            },
          },
        }));
        break;
      }

      case "all_workers_completed": {
        set((s) => ({
          sessions: {
            ...s.sessions,
            [activeSessionId]: {
              ...s.sessions[activeSessionId],
              isActive: false,
              finalResult: {
                success: event.failure_count === 0,
                summary: event.summary,
                results: event.results,
              },
            },
          },
        }));
        break;
      }
    }
  },

  getActiveSession: () => {
    const { activeSessionId, sessions } = get();
    if (!activeSessionId) return null;
    return sessions[activeSessionId] || null;
  },

  getWorker: (sessionId: string, workerId: string) => {
    const session = get().sessions[sessionId];
    if (!session) return undefined;
    return session.workers[workerId];
  },

  getSessionWorkers: (sessionId: string) => {
    const session = get().sessions[sessionId];
    if (!session) return [];
    return Object.values(session.workers);
  },
}));

let eventSource: EventSource | null = null;
let isConnected = false;

export function connectToWorkerEvents(apiUrl: string): void {
  if (isConnected) return;

  const url = `${apiUrl}/workers/events`;
  eventSource = new EventSource(url);

  eventSource.addEventListener("connected", () => {
    isConnected = true;
    console.log("[WorkerStore] Connected to worker events stream");
  });

  eventSource.addEventListener("worker_started", (e: MessageEvent) => {
    try {
      const event = JSON.parse(e.data as string) as WorkerStartedEvent;
      useWorkerProgressStore.getState().handleWorkerEvent(event);
    } catch (err) {
      console.error("[WorkerStore] Failed to parse worker_started event:", err);
    }
  });

  eventSource.addEventListener("worker_progress", (e: MessageEvent) => {
    try {
      const event = JSON.parse(e.data as string) as WorkerProgressEvent;
      useWorkerProgressStore.getState().handleWorkerEvent(event);
    } catch (err) {
      console.error("[WorkerStore] Failed to parse worker_progress event:", err);
    }
  });

  eventSource.addEventListener("worker_completed", (e: MessageEvent) => {
    try {
      const event = JSON.parse(e.data as string) as WorkerCompletedEvent;
      useWorkerProgressStore.getState().handleWorkerEvent(event);
    } catch (err) {
      console.error("[WorkerStore] Failed to parse worker_completed event:", err);
    }
  });

  eventSource.addEventListener("worker_failed", (e: MessageEvent) => {
    try {
      const event = JSON.parse(e.data as string) as WorkerFailedEvent;
      useWorkerProgressStore.getState().handleWorkerEvent(event);
    } catch (err) {
      console.error("[WorkerStore] Failed to parse worker_failed event:", err);
    }
  });

  eventSource.addEventListener("all_workers_started", (e: MessageEvent) => {
    try {
      const event = JSON.parse(e.data as string) as AllWorkersStartedEvent;
      useWorkerProgressStore.getState().handleWorkerEvent(event);
    } catch (err) {
      console.error("[WorkerStore] Failed to parse all_workers_started event:", err);
    }
  });

  eventSource.addEventListener("all_workers_completed", (e: MessageEvent) => {
    try {
      const event = JSON.parse(e.data as string) as AllWorkersCompletedEvent;
      useWorkerProgressStore.getState().handleWorkerEvent(event);
    } catch (err) {
      console.error("[WorkerStore] Failed to parse all_workers_completed event:", err);
    }
  });

  eventSource.onerror = (err) => {
    console.error("[WorkerStore] EventSource error:", err);
    isConnected = false;
  };
}

export function disconnectFromWorkerEvents(): void {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
    isConnected = false;
    console.log("[WorkerStore] Disconnected from worker events stream");
  }
}
