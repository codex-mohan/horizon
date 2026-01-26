import { Client } from "@langchain/langgraph-sdk";

export interface Thread {
    thread_id: string;
    created_at: string;
    updated_at: string;
    metadata?: Record<string, unknown>;
}

export interface ThreadsClient {
    listThreads: () => Promise<Thread[]>;
    getThread: (threadId: string) => Promise<Thread | null>;
    createThread: (metadata?: Record<string, unknown>) => Promise<Thread>;
    deleteThread: (threadId: string) => Promise<void>;
    updateThread: (threadId: string, metadata: Record<string, unknown>) => Promise<Thread>;
}

export function createThreadsClient(apiUrl: string): ThreadsClient {
    const client = new Client({ apiUrl });

    return {
        async listThreads(): Promise<Thread[]> {
            try {
                // Use search with empty query to list all threads
                const response = await client.threads.search();
                return response.map((t) => ({
                    thread_id: t.thread_id,
                    created_at: t.created_at || new Date().toISOString(),
                    updated_at: t.updated_at || new Date().toISOString(),
                    metadata: t.metadata ?? undefined,
                }));
            } catch (error) {
                console.error("Failed to list threads:", error);
                return [];
            }
        },

        async getThread(threadId: string): Promise<Thread | null> {
            try {
                const thread = await client.threads.get(threadId);
                if (!thread) return null;
                return {
                    thread_id: thread.thread_id,
                    created_at: thread.created_at || new Date().toISOString(),
                    updated_at: thread.updated_at || new Date().toISOString(),
                    metadata: thread.metadata ?? undefined,
                };
            } catch (error) {
                console.error("Failed to get thread:", error);
                return null;
            }
        },

        async createThread(metadata?: Record<string, unknown>): Promise<Thread> {
            const thread = await client.threads.create({ metadata });
            return {
                thread_id: thread.thread_id,
                created_at: thread.created_at || new Date().toISOString(),
                updated_at: thread.updated_at || new Date().toISOString(),
                metadata: thread.metadata ?? undefined,
            };
        },

        async deleteThread(threadId: string): Promise<void> {
            try {
                await client.threads.delete(threadId);
            } catch (error) {
                console.error("Failed to delete thread:", error);
                throw error;
            }
        },

        async updateThread(threadId: string, metadata: Record<string, unknown>): Promise<Thread> {
            const thread = await client.threads.update(threadId, { metadata });
            return {
                thread_id: thread.thread_id,
                created_at: thread.created_at || new Date().toISOString(),
                updated_at: thread.updated_at || new Date().toISOString(),
                metadata: thread.metadata ?? undefined,
            };
        },
    };
}
