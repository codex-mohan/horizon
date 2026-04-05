import fs from "node:fs";
import path from "node:path";
import { serve } from "@hono/node-server";
import { getGlobalDataDir } from "@horizon/shared-utils";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { v4 as uuidv4 } from "uuid";

import { agentManager } from "./agent/agent-manager.js";
import { type WorkerEvent, workerEventEmitter } from "./agent/subgraphs/events.js";
import { TOOL_CATEGORIES } from "./agent/tools/index.js";
import { assistantsDb } from "./assistants/db.js";
import assistantsRouter from "./assistants/router.js";
import type { Assistant } from "./assistants/types.js";
import { DEFAULT_TOOL_APPROVAL_CONFIG, type ToolApprovalConfig } from "./lib/approval.js";
import { agentConfig } from "./lib/config.js";
import { getHorizonConfig, resolveWorkspacePath } from "./lib/config-loader.js";
import { conversationStore } from "./lib/conversation-db.js";
import { logger } from "./lib/logger.js";
import type { RuntimeModelConfig } from "./lib/model.js";

// ---------------------------------------------------------------------------
// Thread Metadata Store
// ---------------------------------------------------------------------------

interface ThreadMetadata {
  thread_id: string;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown>;
  status: string;
}

class ThreadMetadataStore {
  private readonly filePath: string;
  private threads: Record<string, ThreadMetadata> = {};

  constructor(filePath = ".thread-metadata.json") {
    this.filePath = path.resolve(getGlobalDataDir(), filePath);
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(this.filePath)) {
        this.threads = JSON.parse(fs.readFileSync(this.filePath, "utf-8"));
      }
    } catch {
      this.threads = {};
    }
  }

  private save() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.threads, null, 2));
    } catch {
      // ignore
    }
  }

  create(threadId: string, metadata: Record<string, unknown> = {}): ThreadMetadata {
    const now = new Date().toISOString();
    const thread: ThreadMetadata = {
      thread_id: threadId,
      created_at: now,
      updated_at: now,
      metadata,
      status: "idle",
    };
    this.threads[threadId] = thread;
    this.save();
    return thread;
  }

  get(threadId: string): ThreadMetadata | undefined {
    this.load();
    return this.threads[threadId];
  }

  update(threadId: string, metadata: Record<string, unknown>): ThreadMetadata {
    this.load();
    const existing = this.threads[threadId];
    if (existing) {
      existing.metadata = { ...existing.metadata, ...metadata };
      existing.updated_at = new Date().toISOString();
      this.save();
      return existing;
    }
    return this.create(threadId, metadata);
  }

  delete(threadId: string): boolean {
    this.load();
    if (this.threads[threadId]) {
      delete this.threads[threadId];
      this.save();
      return true;
    }
    return false;
  }

  search(metadataFilter?: Record<string, unknown>, limit = 100, offset = 0): ThreadMetadata[] {
    this.load();
    let results = Object.values(this.threads);

    if (metadataFilter && Object.keys(metadataFilter).length > 0) {
      results = results.filter((thread) => {
        for (const [key, value] of Object.entries(metadataFilter)) {
          if (thread.metadata[key] !== value) {
            return false;
          }
        }
        return true;
      });
    }

    results.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    return results.slice(offset, offset + limit);
  }
}

const threadMetadataStore = new ThreadMetadataStore();

// ---------------------------------------------------------------------------
// Hono App
// ---------------------------------------------------------------------------

interface Variables {
  db: {
    assistants: {
      findById: (id: string) => Assistant | undefined;
      findByUserId: (userId: string) => Assistant[];
      findDefault: (userId: string) => Assistant | undefined;
      findPublic: () => Assistant[];
      create: (assistant: Assistant) => Assistant;
      update: (id: string, updates: Partial<Assistant>) => Assistant | undefined;
      delete: (id: string) => boolean;
      setDefault: (userId: string, assistantId: string) => boolean;
    };
  };
}

const app = new Hono<{ Variables: Variables }>();

app.use(
  "/*",
  cors({
    origin: (origin) => origin,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "x-api-key"],
    exposeHeaders: ["Content-Length"],
    credentials: true,
  })
);

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

app.get("/health", (c) =>
  c.json({
    status: "healthy",
    service: "horizon-agent",
    version: "pi-mono-v1.0",
    features: {
      reasoning: true,
      human_in_the_loop: true,
      tool_approval: true,
      rate_limiting: agentConfig.ENABLE_RATE_LIMITING,
      token_tracking: agentConfig.ENABLE_TOKEN_TRACKING,
      pii_detection: agentConfig.ENABLE_PII_DETECTION,
      tool_retry: agentConfig.ENABLE_TOOL_RETRY,
    },
    tool_categories: TOOL_CATEGORIES,
  })
);

// ---------------------------------------------------------------------------
// Worker Events SSE
// ---------------------------------------------------------------------------

app.get("/workers/events", (c) => {
  let eventCount = 0;

  return streamSSE(c, async (streamWriter) => {
    const sendEvent = (event: WorkerEvent) => {
      eventCount++;
      streamWriter.writeSSE({
        data: JSON.stringify(event),
        event: event.type,
        id: String(eventCount),
      });
    };

    const unsubscribe = workerEventEmitter.onWorkerEvent(sendEvent);

    streamWriter.writeSSE({
      data: JSON.stringify({ type: "connected", timestamp: Date.now() }),
      event: "connected",
    });

    try {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 60000);
      });
    } finally {
      unsubscribe();
    }
  });
});

// ---------------------------------------------------------------------------
// Thread Management Routes
// ---------------------------------------------------------------------------

app.post("/threads", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const threadId = body.thread_id || uuidv4();
  const metadata = body.metadata || {};
  const thread = threadMetadataStore.create(threadId, metadata);
  logger.info("Thread created", { threadId });
  return c.json(thread);
});

app.post("/threads/search", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const metadataFilter = body.metadata as Record<string, unknown> | undefined;
  const limit = body.limit || 100;
  const offset = body.offset || 0;
  const results = threadMetadataStore.search(metadataFilter, limit, offset);
  return c.json(results);
});

app.get("/threads/:threadId", async (c) => {
  const threadId = c.req.param("threadId");
  const thread = threadMetadataStore.get(threadId);
  if (thread) {
    return c.json(thread);
  }
  if (conversationStore.getConversation(threadId)) {
    const created = threadMetadataStore.create(threadId, {});
    return c.json(created);
  }
  return c.json({
    thread_id: threadId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    metadata: {},
    status: "idle",
  });
});

app.patch("/threads/:threadId", async (c) => {
  const threadId = c.req.param("threadId");
  const body = await c.req.json().catch(() => ({}));
  const metadata = body.metadata || {};
  const thread = threadMetadataStore.update(threadId, metadata);
  return c.json(thread);
});

app.delete("/threads/:threadId", async (c) => {
  const threadId = c.req.param("threadId");
  threadMetadataStore.delete(threadId);
  conversationStore.deleteConversation(threadId);
  await agentManager.destroy(threadId);
  logger.info("Thread deleted", { threadId });
  return c.json({ success: true });
});

// ---------------------------------------------------------------------------
// Thread State & History
// ---------------------------------------------------------------------------

app.get("/threads/:threadId/state", async (c) => {
  const threadId = c.req.param("threadId");
  const agent = agentManager.get(threadId);

  if (agent) {
    return c.json({
      messages: agent.getMessages(),
      next: [],
      tasks: [],
      isStreaming: agent.isStreaming,
      pendingToolCalls: [],
    });
  }

  const messages = conversationStore.getMessages(threadId);
  return c.json({
    messages,
    next: [],
    tasks: [],
    isStreaming: false,
    pendingToolCalls: [],
  });
});

app.get("/threads/:threadId/history", async (c) => {
  const threadId = c.req.param("threadId");
  const messages = conversationStore.getMessages(threadId);
  return c.json(messages);
});

app.post("/threads/:threadId/history", async (c) => {
  const threadId = c.req.param("threadId");
  const messages = conversationStore.getMessages(threadId);
  return c.json(messages);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDefaultToolApprovalConfig(): ToolApprovalConfig {
  return DEFAULT_TOOL_APPROVAL_CONFIG;
}

// ---------------------------------------------------------------------------
// SSE Stream — Main Chat Endpoint
// ---------------------------------------------------------------------------

app.post("/threads/:threadId/runs/stream", async (c) => {
  const threadId = c.req.param("threadId");
  const body = await c.req.json();

  const input = body.input || null;
  const config = body.config || {};

  const modelConfigFromBody =
    body.configurable?.model_config ?? body.model_config ?? config?.configurable?.model_config;

  const toolApprovalConfig: ToolApprovalConfig =
    config.configurable?.tool_approval || getDefaultToolApprovalConfig();

  if (!input?.messages?.length) {
    return c.json({ error: "No messages provided" }, 400);
  }

  const lastMessage = input.messages[input.messages.length - 1];
  const userContent = lastMessage?.content || "";

  logger.info("Stream request", { threadId });

  const agent = agentManager.getOrCreate({
    threadId,
    modelConfig: modelConfigFromBody as RuntimeModelConfig,
    toolApproval: toolApprovalConfig,
    onEvent: () => {},
  });

  const runId = uuidv4();

  return streamSSE(c, async (streamWriter) => {
    await streamWriter.writeSSE({
      event: "metadata",
      data: JSON.stringify({ run_id: runId }),
    });

    try {
      const eventQueue: { type: string; data: unknown }[] = [];

      const drainEvents = async () => {
        while (eventQueue.length > 0) {
          const event = eventQueue.shift()!;

          if (event.type === "interrupt") {
            await streamWriter.writeSSE({
              event: "interrupt",
              data: JSON.stringify(event.data),
            });
          } else if (event.type === "tool_execution_end") {
            await streamWriter.writeSSE({
              event: "tool_execution_end",
              data: JSON.stringify(event.data),
            });
          } else if (event.type === "message_update" || event.type === "text_delta") {
            await streamWriter.writeSSE({
              event: "message_update",
              data: JSON.stringify(event.data),
            });
          } else if (event.type === "agent_end" || event.type === "turn_end") {
            await streamWriter.writeSSE({
              event: "agent_end",
              data: JSON.stringify(event.data),
            });
          } else if (event.type === "error") {
            await streamWriter.writeSSE({
              event: "error",
              data: JSON.stringify(event.data),
            });
          }
        }
      };

      const unsubscribe = agent.subscribe(async (event: unknown) => {
        const typedEvent = event as { type: string };
        eventQueue.push({ type: typedEvent.type, data: event });
        await drainEvents();
      });

      try {
        let textContent = "";
        const images: { data: string; mimeType: string }[] = [];

        if (typeof userContent === "string") {
          textContent = userContent;
        } else if (Array.isArray(userContent)) {
          for (const block of userContent) {
            if (block.type === "text") {
              textContent += block.text;
            } else if (block.type === "image_url" || block.type === "image") {
              const url = (block as any).image_url?.url || block.data;
              const mimeType = (block as any).image_url
                ? (block as any).image_url.url?.includes("data:")
                  ? (block as any).image_url.url.split(";")[0].split(":")[1]
                  : "image/png"
                : block.mimeType || "image/png";
              images.push({ data: url, mimeType });
            }
          }
        }

        await agent.prompt(textContent, images.length > 0 ? images : undefined);
        await agent.waitForIdle();
        await agent.saveState();

        await streamWriter.writeSSE({
          event: "agent_end",
          data: JSON.stringify({
            messages: agent.getMessages(),
          }),
        });
      } catch (error) {
        const err = error as Error;
        logger.error("Stream error", { threadId, error: err.message });
        await streamWriter.writeSSE({
          event: "error",
          data: JSON.stringify({ error: err.message, type: err.name }),
        });
      } finally {
        unsubscribe();
      }
    } catch (streamError: unknown) {
      const error = streamError as Error;
      logger.error("Stream connection error", { threadId, error: error.message });
      await streamWriter.writeSSE({
        event: "error",
        data: JSON.stringify({ error: error.message, type: error.name }),
      });
    }
  });
});

// ---------------------------------------------------------------------------
// Resume — Tool Approval
// ---------------------------------------------------------------------------

interface ApprovalPayload {
  approved: boolean;
  reason?: string;
  approved_tools?: string[];
}

app.post("/threads/:threadId/runs/resume", async (c) => {
  const threadId = c.req.param("threadId");
  const body = await c.req.json();

  const approval = body.approval as ApprovalPayload | undefined;
  const agent = agentManager.get(threadId);

  if (!agent) {
    return c.json({ error: "No active agent found for this thread" }, 404);
  }

  if (approval?.approved) {
    logger.info("Tool call approved", { threadId });
    agent.approvePendingToolCall();
  } else {
    logger.info("Tool call rejected", { threadId });
    agent.rejectPendingToolCall();
  }

  const runId = uuidv4();

  return streamSSE(c, async (streamWriter) => {
    await streamWriter.writeSSE({
      event: "metadata",
      data: JSON.stringify({ run_id: runId }),
    });

    try {
      await agent.waitForIdle();
      await agent.saveState();

      await streamWriter.writeSSE({
        event: "agent_end",
        data: JSON.stringify({
          messages: agent.getMessages(),
        }),
      });
    } catch (error) {
      const err = error as Error;
      logger.error("Resume error", { threadId, error: err.message });
      await streamWriter.writeSSE({
        event: "error",
        data: JSON.stringify({ error: err.message }),
      });
    }
  });
});

// ---------------------------------------------------------------------------
// Non-streaming Invoke
// ---------------------------------------------------------------------------

app.post("/threads/:threadId/runs", async (c) => {
  const threadId = c.req.param("threadId");
  const body = await c.req.json();
  const input = body.input || {};
  const config = body.config || {};

  const modelConfigFromBody =
    body.configurable?.model_config ?? body.model_config ?? config?.configurable?.model_config;
  const toolApprovalConfig: ToolApprovalConfig =
    config.configurable?.tool_approval || getDefaultToolApprovalConfig();

  if (!input?.messages?.length) {
    return c.json({ error: "No messages provided" }, 400);
  }

  const lastMessage = input.messages[input.messages.length - 1];
  const userContent = lastMessage?.content || "";

  const agent = agentManager.getOrCreate({
    threadId,
    modelConfig: modelConfigFromBody as RuntimeModelConfig,
    toolApproval: toolApprovalConfig,
    onEvent: () => {},
  });

  try {
    let textContent = "";
    if (typeof userContent === "string") {
      textContent = userContent;
    } else if (Array.isArray(userContent)) {
      textContent = userContent
        .filter((b: any) => b.type === "text")
        .map((b: any) => b.text)
        .join("\n");
    }

    await agent.prompt(textContent);
    await agent.waitForIdle();
    await agent.saveState();

    return c.json({
      messages: agent.getMessages(),
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error("Run error", { threadId, error: err.message });
    return c.json({ error: err.message }, 500);
  }
});

// ---------------------------------------------------------------------------
// Ollama
// ---------------------------------------------------------------------------

interface OllamaModel {
  name: string;
  model: string;
  modified_at: string;
  size: number;
}

interface OllamaPullProgress {
  status: string;
  digest?: string;
  total?: number;
  completed?: number;
}

app.get("/ollama/models", async (c) => {
  const baseUrl = agentConfig.OLLAMA_BASE_URL || "http://localhost:11434";

  try {
    const response = await fetch(`${baseUrl}/api/tags`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      return c.json({ error: "Failed to fetch models from Ollama" });
    }

    const data = (await response.json()) as { models: OllamaModel[] };
    const models = data.models.map((m) => m.name);

    return c.json({ models });
  } catch {
    return c.json({ error: "Failed to connect to Ollama" }, { status: 500 });
  }
});

app.post("/ollama/pull", async (c) => {
  const baseUrl = agentConfig.OLLAMA_BASE_URL || "http://localhost:11434";

  const body = await c.req.json().catch(() => ({}));
  const modelName = body.model as string | undefined;

  if (!modelName) {
    return c.json({ error: "Model name is required" }, 400);
  }

  return streamSSE(c, async (stream) => {
    try {
      const response = await fetch(`${baseUrl}/api/pull`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: modelName, stream: true }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        stream.write(
          `${JSON.stringify({ status: "error", error: `Failed to pull model: ${errorText}` })}\n`
        );
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        stream.write(`${JSON.stringify({ status: "error", error: "No response body" })}\n`);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.trim()) {
            try {
              const data = JSON.parse(line) as OllamaPullProgress;
              stream.write(`${JSON.stringify(data)}\n`);
            } catch {
              stream.write(`${JSON.stringify({ status: line })}\n`);
            }
          }
        }
      }

      stream.write(`${JSON.stringify({ status: "complete", model: modelName })}\n`);
    } catch (error) {
      const err = error as Error;
      logger.error("Ollama pull error", { error: err.message });
      stream.write(`${JSON.stringify({ status: "error", error: err.message })}\n`);
    }
  });
});

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

app.get("/config", (c) => {
  return c.json({
    model_provider: agentConfig.MODEL_PROVIDER,
    model_name: agentConfig.MODEL_NAME,
    features: {
      reasoning: true,
      human_in_the_loop: true,
      tool_approval: true,
      rate_limiting: agentConfig.ENABLE_RATE_LIMITING,
      token_tracking: agentConfig.ENABLE_TOKEN_TRACKING,
      pii_detection: agentConfig.ENABLE_PII_DETECTION,
      tool_retry: agentConfig.ENABLE_TOOL_RETRY,
      assistants: true,
    },
    limits: {
      max_model_calls: agentConfig.MAX_MODEL_CALLS,
      max_tool_calls: agentConfig.MAX_TOOL_CALLS,
      max_retries: agentConfig.MAX_RETRIES,
    },
    tool_categories: TOOL_CATEGORIES,
  });
});

// ---------------------------------------------------------------------------
// Assistants
// ---------------------------------------------------------------------------

app.use("/assistants/*", async (c, next) => {
  c.set("db", { assistants: assistantsDb });
  await next();
});
app.route("/assistants", assistantsRouter);

// ---------------------------------------------------------------------------
// Start Server
// ---------------------------------------------------------------------------

const horizonConfig = getHorizonConfig();
const workspacePath = resolveWorkspacePath(horizonConfig);

logger.info("Horizon agent starting", {
  port: agentConfig.PORT,
  workspace: workspacePath,
  logging: agentConfig.ENABLE_LOGGING,
  logLevel: agentConfig.LOG_LEVEL,
});

serve({
  fetch: app.fetch,
  port: agentConfig.PORT,
});
