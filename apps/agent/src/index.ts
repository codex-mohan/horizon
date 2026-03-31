import fs from "node:fs";
import path from "node:path";
import { serve } from "@hono/node-server";
import { getGlobalDataDir } from "@horizon/shared-utils";
import { ToolMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { v4 as uuidv4 } from "uuid";

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

import { checkpointer, graph } from "./agent/graph.js";
import type { ToolApprovalConfig } from "./agent/state.js";
import { type WorkerEvent, workerEventEmitter } from "./agent/subgraphs/events.js";
import { TOOL_CATEGORIES } from "./agent/tools/index.js";
import { assistantsDb } from "./assistants/db.js";
import assistantsRouter from "./assistants/router.js";
import type { Assistant } from "./assistants/types.js";
import { agentConfig } from "./lib/config.js";
import { getHorizonConfig, resolveWorkspacePath } from "./lib/config-loader.js";

// ---------------------------------------------------------------------------
// Thread Metadata Store — persists thread metadata to a JSON file
// The checkpointer stores conversation state but not thread-level metadata
// (title, user_id, created_at, etc.). This store fills that gap.
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
    } catch (e) {
      console.error("[ThreadMetadataStore] Failed to load:", e);
      this.threads = {};
    }
  }

  private save() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.threads, null, 2));
    } catch (e) {
      console.error("[ThreadMetadataStore] Failed to save:", e);
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
    // If thread doesn't exist in metadata store, create it
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

    // Apply metadata filter
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

    // Sort by updated_at descending (most recent first)
    results.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    return results.slice(offset, offset + limit);
  }

  /**
   * Ensure threads from the checkpointer are reflected here.
   * Call this on startup to sync any threads that exist in checkpoint storage
   * but not in the metadata store.
   */
  syncFromCheckpointer(threadIds: string[]) {
    this.load();
    let dirty = false;
    for (const id of threadIds) {
      if (!this.threads[id]) {
        this.threads[id] = {
          thread_id: id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          metadata: {},
          status: "idle",
        };
        dirty = true;
      }
    }
    if (dirty) {
      this.save();
    }
  }
}

const threadStore = new ThreadMetadataStore();
// Sync any pre-existing checkpoints into the thread metadata store
threadStore.syncFromCheckpointer(checkpointer.getThreadIds());

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

const APPROVAL_TOOL_NAME = "__approval__";

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

app.get("/health", (c) =>
  c.json({
    status: "healthy",
    service: "backend-ts",
    version: "enhanced-v2.0",
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
// Thread Management Routes — implements the LangGraph Platform Thread API
// These are the endpoints that @langchain/langgraph-sdk client expects.
// ---------------------------------------------------------------------------

/** POST /threads — Create a new thread */
app.post("/threads", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const threadId = body.thread_id || uuidv4();
  const metadata = body.metadata || {};
  const thread = threadStore.create(threadId, metadata);
  return c.json(thread);
});

/** POST /threads/search — Search/list threads with optional metadata filter */
app.post("/threads/search", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const metadataFilter = body.metadata as Record<string, unknown> | undefined;
  const limit = body.limit || 100;
  const offset = body.offset || 0;
  const results = threadStore.search(metadataFilter, limit, offset);
  return c.json(results);
});

/** GET /threads/:threadId — Get a single thread */
app.get("/threads/:threadId", async (c) => {
  const threadId = c.req.param("threadId");
  const thread = threadStore.get(threadId);
  if (thread) {
    return c.json(thread);
  }
  // Thread might exist in checkpointer but not metadata store
  if (checkpointer.hasThread(threadId)) {
    const created = threadStore.create(threadId, {});
    return c.json(created);
  }
  // Return a synthetic thread so the SDK doesn't crash
  return c.json({
    thread_id: threadId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    metadata: {},
    status: "idle",
  });
});

/** PATCH /threads/:threadId — Update thread metadata */
app.patch("/threads/:threadId", async (c) => {
  const threadId = c.req.param("threadId");
  const body = await c.req.json().catch(() => ({}));
  const metadata = body.metadata || {};
  const thread = threadStore.update(threadId, metadata);
  return c.json(thread);
});

/** DELETE /threads/:threadId — Delete a thread */
app.delete("/threads/:threadId", async (c) => {
  const threadId = c.req.param("threadId");
  threadStore.delete(threadId);
  await checkpointer.deleteThread(threadId);
  return c.json({ success: true });
});

// ---------------------------------------------------------------------------
// Helper: Convert LangGraph.js StateSnapshot → LangGraph Platform ThreadState
// The SDK's useStream expects the Platform API format (checkpoint.checkpoint_id,
// created_at, parent_checkpoint) — not the LangGraph.js internal StateSnapshot
// format (config.configurable.checkpoint_id, createdAt, parentConfig).
// Returning the wrong format causes onSuccess() to wipe stream values and the
// UI to revert to an empty state after every response.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Helper: Serialize messages to LangGraph Platform format
// LangChain BaseMessage objects have a .toJSON() that returns {"lc": 1, ...}
// but the SDK UI expects raw objects like { type: "human", content: "..." }.
// ---------------------------------------------------------------------------
function serializeMessage(msg: any): any {
  if (!msg) return msg;

  if (msg.lc === 1 && msg.type === "constructor" && Array.isArray(msg.id)) {
    const className = msg.id[msg.id.length - 1];
    let type = "system";
    if (className.includes("Human")) type = "human";
    else if (className.includes("AI")) type = "ai";
    else if (className.includes("Tool")) type = "tool";

    return {
      type,
      id: msg.kwargs?.id ?? msg.id,
      content: msg.kwargs?.content ?? "",
      name: msg.kwargs?.name,
      tool_calls: msg.kwargs?.tool_calls ?? msg.kwargs?.tool_call_chunks,
      tool_call_id: msg.kwargs?.tool_call_id,
      additional_kwargs: msg.kwargs?.additional_kwargs,
      response_metadata: msg.kwargs?.response_metadata,
      invalid_tool_calls: msg.kwargs?.invalid_tool_calls,
      usage_metadata: msg.kwargs?.usage_metadata,
    };
  }

  const type = typeof msg._getType === "function" ? msg._getType() : msg.type;
  return {
    type: type || "unknown",
    id: msg.id,
    content: msg.content ?? "",
    name: msg.name,
    tool_calls: msg.tool_calls ?? msg.tool_call_chunks,
    tool_call_id: msg.tool_call_id,
    additional_kwargs: msg.additional_kwargs,
    response_metadata: msg.response_metadata,
    invalid_tool_calls: msg.invalid_tool_calls,
    usage_metadata: msg.usage_metadata,
  };
}

function serializeMessagesInObject(obj: any): any {
  if (!obj || typeof obj !== "object") return obj;
  const result = { ...obj };
  if (Array.isArray(result.messages)) {
    result.messages = result.messages.map(serializeMessage);
  } else if (result.messages) {
    result.messages = serializeMessage(result.messages);
  }
  return result;
}

function snapshotToThreadState(snapshot: {
  values: unknown;
  next: string[];
  config?: {
    configurable?: { thread_id?: string; checkpoint_id?: string; checkpoint_ns?: string };
  };
  metadata?: unknown;
  createdAt?: string;
  parentConfig?: { configurable?: { thread_id?: string; checkpoint_id?: string } };
  tasks?: unknown[];
}) {
  const cfg = snapshot.config?.configurable ?? {};
  const parentCfg = snapshot.parentConfig?.configurable;
  return {
    values: serializeMessagesInObject(snapshot.values ?? {}),
    next: snapshot.next ?? [],
    config: snapshot.config,
    checkpoint: {
      checkpoint_id: cfg.checkpoint_id,
      thread_id: cfg.thread_id,
      checkpoint_ns: cfg.checkpoint_ns ?? "",
    },
    metadata: snapshot.metadata ?? {},
    created_at: snapshot.createdAt ?? new Date().toISOString(),
    parent_checkpoint: parentCfg
      ? {
          checkpoint_id: parentCfg.checkpoint_id,
          thread_id: parentCfg.thread_id,
          checkpoint_ns: "",
        }
      : null,
    tasks: snapshot.tasks ?? [],
  };
}

/** GET /threads/:threadId/state — Get current thread state */
app.get("/threads/:threadId/state", async (c) => {
  const threadId = c.req.param("threadId");
  try {
    const state = await graph.getState({
      configurable: { thread_id: threadId },
    });

    return c.json(snapshotToThreadState(state as any));
  } catch (_e) {
    return c.json({
      values: {},
      next: [],
      tasks: [],
      checkpoint: null,
      metadata: {},
      created_at: new Date().toISOString(),
    });
  }
});

/** GET & POST /threads/:threadId/history — Get state history */
const getHistoryHandler = async (c: any) => {
  const threadId = c.req.param("threadId");
  try {
    const body = await c.req.json().catch(() => ({}));
    const limit = body.limit ?? 100;
    const history = [];
    for await (const state of graph.getStateHistory(
      { configurable: { thread_id: threadId } },
      { limit }
    )) {
      history.push(snapshotToThreadState(state as any));
    }
    return c.json(history);
  } catch (_e) {
    return c.json([]);
  }
};

app.get("/threads/:threadId/history", getHistoryHandler);
app.post("/threads/:threadId/history", getHistoryHandler);

function getDefaultToolApprovalConfig(): ToolApprovalConfig {
  return {
    mode: "dangerous_only",
    auto_approve_tools: [],
    never_approve_tools: [],
  };
}

app.post("/threads/:threadId/runs/stream", async (c) => {
  const threadId = c.req.param("threadId");
  const body = await c.req.json();

  const input = body.input || null;
  const config = body.config || {};
  const command = body.command;

  // ---------------------------------------------------------------------------
  // Normalize stream_mode: the SDK sends LangGraph Platform-specific mode names
  // (e.g. "messages-tuple") that LangGraph.js doesn't understand. Map them.
  // Also always include "values" so the SDK's setStreamValues() gets called,
  // which populates stream.values.messages — required for renders to show messages.
  // ---------------------------------------------------------------------------
  const PLATFORM_TO_LGJS: Record<string, string> = {
    "messages-tuple": "messages",
  };
  const VALID_LGJS_MODES = new Set(["values", "updates", "messages", "debug", "custom"]);

  const requestedModes: string[] = Array.isArray(body.stream_mode)
    ? body.stream_mode
    : body.stream_mode
      ? [body.stream_mode]
      : ["updates", "messages", "custom"];

  const normalizedModeSet = new Set<string>();
  for (const m of requestedModes) {
    const mapped = PLATFORM_TO_LGJS[m] ?? m;
    if (VALID_LGJS_MODES.has(mapped)) normalizedModeSet.add(mapped);
  }
  // Always include "values" — this is what the SDK uses to render messages
  normalizedModeSet.add("values");

  const streamMode = [...normalizedModeSet];

  // Try multiple paths to find model_config - LangGraph SDK might send it differently
  const modelConfigFromBody =
    body.configurable?.model_config ?? body.model_config ?? config?.configurable?.model_config;

  const toolApprovalConfig: ToolApprovalConfig =
    config.configurable?.tool_approval || getDefaultToolApprovalConfig();

  const runConfig = {
    configurable: {
      thread_id: threadId,
      user_id: config.configurable?.user_id,
      tool_approval: toolApprovalConfig,
      model_config: modelConfigFromBody,
    },
    streamMode: streamMode as any,
    recursionLimit: 150,
  };

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let stream: any;

    if (command) {
      const resumeCommand = new Command(command);
      stream = await graph.stream(resumeCommand, runConfig);
    } else {
      stream = await graph.stream(input, runConfig);
    }

    const runId = uuidv4();
    return streamSSE(c, async (streamWriter) => {
      // Send metadata event first — the SDK uses this to initialize run tracking
      await streamWriter.writeSSE({
        event: "metadata",
        data: JSON.stringify({ run_id: runId }),
      });
      try {
        for await (const chunk of stream) {
          // When multiple streamModes are used (e.g. ["updates", "messages", "custom"]),
          // graph.stream() yields [eventName, payload] tuples.
          // When a single streamMode is used, it yields the payload directly.
          let eventName: string;
          let payload: unknown;

          if (Array.isArray(chunk) && chunk.length === 2 && typeof chunk[0] === "string") {
            // Multi-mode: chunk is [eventName, payload]
            [eventName, payload] = chunk;
          } else {
            // Single-mode fallback: treat the whole chunk as an "updates" payload
            eventName = "updates";
            payload = chunk;
          }

          // Serialize message objects to simple POJOs
          if (eventName === "values") {
            payload = serializeMessagesInObject(payload);
          } else if (eventName === "updates") {
            const newPayload: any = {};
            for (const key in payload as any) {
              newPayload[key] = serializeMessagesInObject((payload as any)[key]);
            }
            payload = newPayload;
          } else if (eventName === "messages" && Array.isArray(payload) && payload.length >= 1) {
            payload = [serializeMessage(payload[0]), ...payload.slice(1)];
          }

          await streamWriter.writeSSE({
            data: JSON.stringify(payload),
            event: eventName,
          });
        }
      } catch (streamError: unknown) {
        const error = streamError as Error;
        console.error(`[stream] thread=${threadId} error during streaming:`, error.message);
        if (error.stack) console.error(error.stack);
        await streamWriter.writeSSE({
          data: JSON.stringify({ error: error.message, type: error.name }),
          event: "error",
        });
      }
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error(`[stream] thread=${threadId} failed to start:`, err.message);
    if (err.stack) console.error(err.stack);
    return c.json({ error: err.message, type: err.name }, 500);
  }
});

app.post("/threads/:threadId/state", async (c) => {
  const threadId = c.req.param("threadId");
  const body = await c.req.json();
  const values = body.values;
  const asNode = body.asNode;

  const config = { configurable: { thread_id: threadId } };

  try {
    const result = await graph.updateState(config, values, asNode);
    return c.json(result);
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Update state error:", err);
    return c.json({ error: err.message }, 500);
  }
});

interface ApprovalPayload {
  approved: boolean;
  reason?: string;
  approved_tools?: string[];
}

app.post("/threads/:threadId/runs/resume", async (c) => {
  const threadId = c.req.param("threadId");
  const body = await c.req.json();

  const approval = body.approval as ApprovalPayload | undefined;
  const checkpointId = body.checkpoint_id;

  const runConfig = {
    configurable: {
      thread_id: threadId,
      model_config: body.config?.configurable?.model_config,
      ...(checkpointId ? { checkpoint_id: checkpointId } : {}),
    },
    streamMode: body.stream_mode || ["updates", "messages", "custom"],
    recursionLimit: 150,
  };

  try {
    if (approval) {
      const toolMessage = new ToolMessage(
        JSON.stringify({
          approved: approval.approved,
          reason: approval.reason,
          approved_tools: approval.approved_tools,
        }),
        APPROVAL_TOOL_NAME,
        APPROVAL_TOOL_NAME
      );

      await graph.updateState(
        { configurable: { thread_id: threadId } },
        { messages: [toolMessage] }
      );
    }

    const resumeCommand = new Command({ resume: true });

    if (body.stream !== false) {
      const stream = await graph.stream(resumeCommand, runConfig);

      return streamSSE(c, async (streamWriter) => {
        try {
          for await (const chunk of stream) {
            let eventName: string;
            let payload: unknown;

            if (Array.isArray(chunk) && chunk.length === 2 && typeof chunk[0] === "string") {
              [eventName, payload] = chunk;
            } else {
              eventName = "updates";
              payload = chunk;
            }

            // Serialize message objects to simple POJOs
            if (eventName === "values") {
              payload = serializeMessagesInObject(payload);
            } else if (eventName === "updates") {
              const newPayload: any = {};
              for (const key in payload as any) {
                newPayload[key] = serializeMessagesInObject((payload as any)[key]);
              }
              payload = newPayload;
            } else if (eventName === "messages" && Array.isArray(payload) && payload.length >= 1) {
              payload = [serializeMessage(payload[0]), ...payload.slice(1)];
            }

            await streamWriter.writeSSE({
              data: JSON.stringify(payload),
              event: eventName,
            });
          }
        } catch (streamError: unknown) {
          const error = streamError as Error;
          console.error("Resume stream error:", error);
          await streamWriter.writeSSE({
            data: JSON.stringify({ error: error.message }),
            event: "error",
          });
        }
      });
    }

    const result = await graph.invoke(resumeCommand, runConfig);
    return c.json(result);
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Resume error:", err);
    return c.json({ error: err.message }, 500);
  }
});

app.post("/threads/:threadId/runs", async (c) => {
  const threadId = c.req.param("threadId");
  const body = await c.req.json();
  const input = body.input || {};
  const config = body.config || {};
  const checkpointId = body.checkpoint_id || config.configurable?.checkpoint_id;
  const command = body.command;

  const toolApprovalConfig: ToolApprovalConfig =
    config.configurable?.tool_approval || getDefaultToolApprovalConfig();

  const runConfig = {
    configurable: {
      thread_id: threadId,
      user_id: config.configurable?.user_id,
      tool_approval: toolApprovalConfig,
      model_config: config.configurable?.model_config,
      ...(checkpointId ? { checkpoint_id: checkpointId } : {}),
    },
    recursionLimit: 150,
  };

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let result: any;

    if (command) {
      const resumeCommand = new Command(command);
      result = await graph.invoke(resumeCommand, runConfig);
    } else {
      result = await graph.invoke(input, runConfig);
    }

    return c.json(result);
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Run error:", err);
    return c.json({ error: err.message }, 500);
  }
});

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
  } catch (error) {
    console.error("Ollama list models error:", error);
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
      console.error("Ollama pull error:", err);
      stream.write(`${JSON.stringify({ status: "error", error: err.message })}\n`);
    }
  });
});

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

app.use("/assistants/*", async (c, next) => {
  c.set("db", { assistants: assistantsDb });
  await next();
});
app.route("/assistants", assistantsRouter);

// Log workspace configuration
const horizonConfig = getHorizonConfig();
const workspacePath = resolveWorkspacePath(horizonConfig);

console.log(`Horizon agent running on port ${agentConfig.PORT} | workspace: ${workspacePath}`);

serve({
  fetch: app.fetch,
  port: agentConfig.PORT,
});
