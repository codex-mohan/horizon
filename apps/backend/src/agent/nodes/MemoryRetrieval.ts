import { MemoryClient } from "@horizon/agent-memory";
import type { HumanMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import type { AgentState } from "../state.js";

let memoryClient: MemoryClient | null = null;
let memoryInitialized = false;

export function initializeMemory(): MemoryClient | null {
  if (memoryClient) {
    return memoryClient;
  }

  memoryClient = new MemoryClient({
    qdrant_url: process.env.QDRANT_URL || "http://localhost:6333",
    collection_name: "horizon_memories",
    embedding_model: "text-embedding-3-small",
    embedding_dimension: 1536,
  });

  memoryClient
    .initialize()
    .then(() => {
      memoryInitialized = true;
      console.log("[Memory] Initialized");
    })
    .catch((err) => console.warn("[Memory] Unavailable:", err.message));

  return memoryClient;
}

export function getMemoryClient(): MemoryClient | null {
  return memoryClient;
}

export function isMemoryInitialized(): boolean {
  return memoryInitialized;
}

export async function MemoryRetrieval(
  state: AgentState,
  config: RunnableConfig
): Promise<Partial<AgentState>> {
  const updates: Partial<AgentState> = {};

  if (!(memoryInitialized && memoryClient)) {
    return updates;
  }

  const userId = config.configurable?.user_id as string | undefined;
  if (!userId) {
    return updates;
  }

  const lastUserMessage = [...state.messages]
    .reverse()
    .find((msg) => msg._getType() === "human") as HumanMessage | undefined;

  if (!lastUserMessage) {
    return updates;
  }

  const content =
    typeof lastUserMessage.content === "string"
      ? lastUserMessage.content
      : JSON.stringify(lastUserMessage.content);

  console.log("[MemoryRetrieval] Searching...");

  try {
    const memories = await memoryClient.retrieve({
      query: content,
      user_id: userId,
      top_k: 3,
      recency_weight: 0.3,
    });

    if (memories.length > 0) {
      console.log(`[MemoryRetrieval] Found ${memories.length} memories`);
      updates.metadata = {
        ...state.metadata,
        retrieved_memories: memories.map((m) => ({
          content: m.entry.content,
          score: m.score,
          timestamp: m.entry.metadata.timestamp,
        })),
      };
    }
  } catch (error) {
    console.warn("[MemoryRetrieval] Error:", error);
  }

  return updates;
}
