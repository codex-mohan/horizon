export interface Thread {
  thread_id: string;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, unknown>;
}

export interface ThreadsClient {
  listThreads: (userId?: string) => Promise<Thread[]>;
  getThread: (threadId: string) => Promise<Thread | null>;
  createThread: (userId: string, metadata?: Record<string, unknown>) => Promise<Thread>;
  deleteThread: (threadId: string) => Promise<void>;
  updateThread: (threadId: string, metadata: Record<string, unknown>) => Promise<Thread>;
}

export function createThreadsClient(apiUrl: string): ThreadsClient {
  return {
    async listThreads(userId?: string): Promise<Thread[]> {
      try {
        const body = userId ? { metadata: { user_id: userId } } : {};
        const response = await fetch(`${apiUrl}/threads/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!response.ok) return [];

        const threads = await response.json();
        return threads.map((t: any) => ({
          thread_id: t.thread_id,
          created_at: t.created_at || new Date().toISOString(),
          updated_at: t.updated_at || new Date().toISOString(),
          metadata: t.metadata ?? undefined,
        }));
      } catch {
        return [];
      }
    },

    async getThread(threadId: string): Promise<Thread | null> {
      try {
        const response = await fetch(`${apiUrl}/threads/${threadId}`);
        if (!response.ok) return null;
        const thread = await response.json();
        return {
          thread_id: thread.thread_id,
          created_at: thread.created_at || new Date().toISOString(),
          updated_at: thread.updated_at || new Date().toISOString(),
          metadata: thread.metadata ?? undefined,
        };
      } catch {
        return null;
      }
    },

    async createThread(userId: string, metadata?: Record<string, unknown>): Promise<Thread> {
      const response = await fetch(`${apiUrl}/threads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metadata: { ...metadata, user_id: userId },
        }),
      });
      const thread = await response.json();
      return {
        thread_id: thread.thread_id,
        created_at: thread.created_at || new Date().toISOString(),
        updated_at: thread.updated_at || new Date().toISOString(),
        metadata: thread.metadata ?? undefined,
      };
    },

    async deleteThread(threadId: string): Promise<void> {
      const response = await fetch(`${apiUrl}/threads/${threadId}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error(`Failed to delete thread: ${response.statusText}`);
      }
    },

    async updateThread(threadId: string, metadata: Record<string, unknown>): Promise<Thread> {
      const response = await fetch(`${apiUrl}/threads/${threadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metadata }),
      });
      const thread = await response.json();
      return {
        thread_id: thread.thread_id,
        created_at: thread.created_at || new Date().toISOString(),
        updated_at: thread.updated_at || new Date().toISOString(),
        metadata: thread.metadata ?? undefined,
      };
    },
  };
}
