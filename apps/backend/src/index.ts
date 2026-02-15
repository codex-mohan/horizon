import { serve } from "@hono/node-server";
import { ToolMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { v4 as uuidv4 } from "uuid";
import { graph } from "./agent/graph.js";
import type { ToolApprovalConfig } from "./agent/state.js";
import { TOOL_CATEGORIES } from "./agent/tools/index.js";
import { assistantsDb } from "./assistants/db.js";
import assistantsRouter from "./assistants/router.js";
import type { Assistant } from "./assistants/types.js";
import { agentConfig } from "./lib/config.js";

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
    allowMethods: ["GET", "POST", "OPTIONS"],
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

app.post("/threads", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const threadId = body.thread_id || uuidv4();
  return c.json({ thread_id: threadId });
});

app.get("/threads/:threadId/state", async (c) => {
  const threadId = c.req.param("threadId");
  try {
    const state = await graph.getState({
      configurable: { thread_id: threadId },
    });
    return c.json(state);
  } catch (_e) {
    return c.json({ values: {}, next: [], tasks: [] });
  }
});

app.get("/threads/:threadId/history", async (c) => {
  const threadId = c.req.param("threadId");
  try {
    const history = [];
    for await (const state of graph.getStateHistory({
      configurable: { thread_id: threadId },
    })) {
      history.push(state);
    }
    return c.json(history);
  } catch (_e) {
    return c.json([]);
  }
});

function findCheckpointId(obj: unknown): string | undefined {
  if (!obj || typeof obj !== "object") {
    return undefined;
  }

  const record = obj as Record<string, unknown>;
  if (record.checkpoint_id && typeof record.checkpoint_id === "string") {
    return record.checkpoint_id;
  }

  for (const key in record) {
    if (Object.hasOwn(record, key)) {
      const result = findCheckpointId(record[key]);
      if (result) {
        return result;
      }
    }
  }
  return undefined;
}

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

  const checkpointId = findCheckpointId(body);

  console.log(`[POST /runs/stream] Thread: ${threadId}`);
  console.log(`[POST /runs/stream] Checkpoint ID: ${checkpointId}`);
  console.log(`[POST /runs/stream] Has Command: ${!!command}`);

  const streamMode = body.stream_mode || ["updates", "messages", "custom"];

  const toolApprovalConfig: ToolApprovalConfig =
    config.configurable?.tool_approval || getDefaultToolApprovalConfig();

  console.log("[POST /runs/stream] Tool Approval Config:", JSON.stringify(toolApprovalConfig));

  const runConfig = {
    configurable: {
      thread_id: threadId,
      user_id: config.configurable?.user_id,
      tool_approval: toolApprovalConfig,
      ...(checkpointId ? { checkpoint_id: checkpointId } : {}),
    },
    streamMode,
  };

  try {
    let stream;

    if (command) {
      console.log("[POST /runs/stream] Resuming with command:", JSON.stringify(command));
      const resumeCommand = new Command(command);
      stream = await graph.stream(resumeCommand, runConfig);
    } else {
      stream = await graph.stream(input, runConfig);
    }

    return streamSSE(c, async (streamWriter) => {
      try {
        for await (const chunk of stream) {
          const chunkRecord = chunk as Record<string, unknown>;

          // Check for __interrupt__ in the chunk (LangGraph interrupt format)
          if (chunkRecord.__interrupt__) {
            console.log(
              "[POST /runs/stream] Interrupt detected:",
              JSON.stringify(chunkRecord.__interrupt__)
            );

            // Extract interrupt value from LangGraph Interrupt object
            const interruptValue =
              (chunkRecord.__interrupt__ as any)?.value || chunkRecord.__interrupt__;

            await streamWriter.writeSSE({
              data: JSON.stringify(interruptValue),
              event: "__interrupt__",
            });
            return; // Stream ends after interrupt
          }

          // Check for updates mode with node names as keys
          const keys = Object.keys(chunkRecord);
          for (const key of keys) {
            if (key === "__interrupt__") {
              const interruptValue = (chunkRecord[key] as any)?.value || chunkRecord[key];
              console.log(
                "[POST /runs/stream] Interrupt in updates:",
                JSON.stringify(interruptValue)
              );

              await streamWriter.writeSSE({
                data: JSON.stringify(interruptValue),
                event: "__interrupt__",
              });
              return;
            }
          }

          // Normal chunk processing
          const eventType = chunkRecord.event as string | undefined;
          const eventData = chunkRecord.data;

          if (eventType && eventData !== undefined) {
            await streamWriter.writeSSE({
              data: JSON.stringify(eventData),
              event: eventType,
            });
          } else {
            // For updates mode, the chunk is { nodeName: updateData }
            await streamWriter.writeSSE({
              data: JSON.stringify(chunk),
              event: "updates",
            });
          }
        }
      } catch (streamError: unknown) {
        const error = streamError as Error;
        console.error("Stream processing error:", error);
        await streamWriter.writeSSE({
          data: JSON.stringify({ error: error.message }),
          event: "error",
        });
      }
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Stream error:", err);
    return c.json({ error: err.message }, 500);
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

  console.log(`[POST /runs/resume] Thread: ${threadId}`);
  console.log(`[POST /runs/resume] Checkpoint ID: ${checkpointId}`);
  console.log(`[POST /runs/resume] Approval:`, JSON.stringify(approval));

  const runConfig = {
    configurable: {
      thread_id: threadId,
      ...(checkpointId ? { checkpoint_id: checkpointId } : {}),
    },
    streamMode: body.stream_mode || ["updates", "messages", "custom"],
  };

  try {
    if (approval) {
      const toolMessage = new ToolMessage({
        name: APPROVAL_TOOL_NAME,
        content: JSON.stringify({
          approved: approval.approved,
          reason: approval.reason,
          approved_tools: approval.approved_tools,
        }),
        tool_call_id: APPROVAL_TOOL_NAME,
      });

      console.log("[POST /runs/resume] Injecting approval ToolMessage");
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
            const chunkRecord = chunk as Record<string, unknown>;
            const eventType = chunkRecord.event as string | undefined;
            const eventData = chunkRecord.data;

            if (eventType && eventData !== undefined) {
              await streamWriter.writeSSE({
                data: JSON.stringify(eventData),
                event: eventType,
              });
            } else {
              await streamWriter.writeSSE({
                data: JSON.stringify(chunk),
                event: "data",
              });
            }
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
      ...(checkpointId ? { checkpoint_id: checkpointId } : {}),
    },
  };

  try {
    let result;

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

console.log(`Server running on port ${agentConfig.PORT}`);
console.log("Assistants API: /assistants");
console.log("Enhanced Agent Features:");
console.log("  - ReAct Pattern: Enabled");
console.log("  - Human-in-the-Loop: Enabled");
console.log("  - Tool Approval: Enabled (with configurable modes)");
console.log(`  - Rate Limiting: ${agentConfig.ENABLE_RATE_LIMITING ? "Enabled" : "Disabled"}`);
console.log(`  - Token Tracking: ${agentConfig.ENABLE_TOKEN_TRACKING ? "Enabled" : "Disabled"}`);
console.log(`  - PII Detection: ${agentConfig.ENABLE_PII_DETECTION ? "Enabled" : "Disabled"}`);
console.log(`  - Tool Retry: ${agentConfig.ENABLE_TOOL_RETRY ? "Enabled" : "Disabled"}`);

serve({
  fetch: app.fetch,
  port: agentConfig.PORT,
});
