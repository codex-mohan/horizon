import { Client } from "@langchain/langgraph-sdk";

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

/**
 * Creates a threads client for managing LangGraph conversations.
 * 
 * Threads are associated with users via metadata.user_id.
 * LangGraph's checkpointer stores all conversation state (messages, tool calls, etc.)
 * in its own database, so we don't need to duplicate this data.
 */
export function createThreadsClient(apiUrl: string): ThreadsClient {
    const client = new Client({ apiUrl });

    return {
        /**
         * List all threads for a specific user.
         * If no userId is provided, lists all threads (admin use).
         */
        async listThreads(userId?: string): Promise<Thread[]> {
            try {
                // Use search with metadata filter to get user's threads
                const searchOptions = userId
                    ? { metadata: { user_id: userId } }
                    : {};

                const response = await client.threads.search(searchOptions);
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

        /**
         * Create a new thread for a user.
         * The user_id is stored in metadata for filtering.
         */
        async createThread(userId: string, metadata?: Record<string, unknown>): Promise<Thread> {
            const thread = await client.threads.create({
                metadata: {
                    ...metadata,
                    user_id: userId, // Always include user_id for filtering
                },
            });
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
            // First get existing metadata to merge with new values
            // This ensures we don't lose user_id or other important fields
            let existingMetadata: Record<string, unknown> = {};
            try {
                const existing = await client.threads.get(threadId);
                if (existing?.metadata) {
                    existingMetadata = existing.metadata as Record<string, unknown>;
                }
            } catch {
                // Thread might not exist yet, continue with empty metadata
            }

            const mergedMetadata = { ...existingMetadata, ...metadata };
            const thread = await client.threads.update(threadId, { metadata: mergedMetadata });
            return {
                thread_id: thread.thread_id,
                created_at: thread.created_at || new Date().toISOString(),
                updated_at: thread.updated_at || new Date().toISOString(),
                metadata: thread.metadata ?? undefined,
            };
        },
    };
}
