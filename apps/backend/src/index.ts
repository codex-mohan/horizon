import { serve } from "@hono/node-server";
import { Command } from "@langchain/langgraph";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { v4 as uuidv4 } from "uuid";
// Import graph
import { graph } from "./agent/graph.js";
import { assistantsDb } from "./assistants/db.js";
// Import assistants
import assistantsRouter from "./assistants/router.js";
import type { Assistant } from "./assistants/types.js";
import { agentConfig } from "./lib/config.js";

// Define app types
interface Variables {
  db: {
    assistants: {
      findById: (id: string) => Assistant | undefined;
      findByUserId: (userId: string) => Assistant[];
      findDefault: (userId: string) => Assistant | undefined;
      findPublic: () => Assistant[];
      create: (assistant: Assistant) => Assistant;
      update: (
        id: string,
        updates: Partial<Assistant>
      ) => Assistant | undefined;
      delete: (id: string) => boolean;
      setDefault: (userId: string, assistantId: string) => boolean;
    };
  };
}

const app = new Hono<{ Variables: Variables }>();

// Persistence configured in graph.compile()

// CORS
app.use(
  "/*",
  cors({
    origin: (origin) => origin, // Allow all origins for dev, or fetch from config
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "x-api-key"],
    exposeHeaders: ["Content-Length"],
    credentials: true,
  })
);

// Health Check
app.get("/health", (c) =>
  c.json({
    status: "healthy",
    service: "backend-ts",
    version: "enhanced-v1.0",
    features: {
      reasoning: true,
      human_in_the_loop: true,
      tool_approval: true,
      rate_limiting: agentConfig.ENABLE_RATE_LIMITING,
      token_tracking: agentConfig.ENABLE_TOKEN_TRACKING,
      pii_detection: agentConfig.ENABLE_PII_DETECTION,
      tool_retry: agentConfig.ENABLE_TOOL_RETRY,
    },
  })
);

/**
 * Create a Thread
 * POST /threads
 */
app.post("/threads", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const threadId = body.thread_id || uuidv4();
  return c.json({ thread_id: threadId });
});

/**
 * Get Thread State
 * GET /threads/:threadId/state
 */
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

/**
 * Get Thread History
 * GET /threads/:threadId/history
 */
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

/**
 * Run Stream with Enhanced Features
 * POST /threads/:threadId/runs/stream
 *
 * Supports:
 * - Human-in-the-Loop interrupts
 * - Command resume (for interrupt approval/rejection)
 * - Tool approval flow
 * - Streaming updates
 */
app.post("/threads/:threadId/runs/stream", async (c) => {
  const threadId = c.req.param("threadId");
  const body = await c.req.json();

  const input = body.input || null;
  const config = body.config || {};
  const command = body.command; // For resume after interrupt

  // Recursive helper to find checkpoint_id anywhere in the object
  const findCheckpointId = (obj: any): string | undefined => {
    if (!obj || typeof obj !== "object") {
      return undefined;
    }

    if (obj.checkpoint_id && typeof obj.checkpoint_id === "string") {
      return obj.checkpoint_id;
    }

    for (const key in obj) {
      if (Object.hasOwn(obj, key)) {
        const result = findCheckpointId(obj[key]);
        if (result) {
          return result;
        }
      }
    }
    return undefined;
  };

  // Extract checkpoint information to support branching
  const checkpointId = findCheckpointId(body);

  console.log(`[POST /runs/stream] Thread: ${threadId}`);
  console.log(
    `[POST /runs/stream] Extracted Checkpoint ID (Recursive): ${checkpointId}`
  );
  console.log(`[POST /runs/stream] Has Command: ${!!command}`);

  // Construct the configuration for the graph run
  // Include "custom" stream mode to receive UI events during tool execution
  const streamMode = body.stream_mode || ["updates", "messages", "custom"];

  console.log("[POST /runs/stream] Stream Mode:", streamMode);

  const runConfig = {
    configurable: {
      ...config.configurable,
      thread_id: threadId,
      user_id: config.configurable?.user_id,
      requires_approval: config.configurable?.requires_approval ||
        process.env.TOOLS_REQUIRE_APPROVAL?.split(",") || [
          "shell_execute",
          "file_write",
          "file_delete",
        ],
      enable_reasoning: config.configurable?.enable_reasoning ?? true,
      enable_interrupt:
        config.configurable?.enable_interrupt ??
        agentConfig.ENABLE_TOOL_APPROVAL,
      ...(checkpointId ? { checkpoint_id: checkpointId } : {}),
    },
    streamMode,
  };

  console.log(
    "[POST /runs/stream] Final Run Config:",
    JSON.stringify(runConfig, null, 2)
  );

  try {
    let stream;

    // If we have a command (e.g., resume after interrupt), use it
    if (command) {
      console.log("[POST /runs/stream] Resuming with command:", command);
      const resumeCommand = new Command(command);
      stream = await graph.stream(resumeCommand, runConfig);
    } else {
      stream = await graph.stream(input, runConfig);
    }

    return streamSSE(c, async (streamWriter) => {
      try {
        for await (const chunk of stream) {
          // Check if the chunk follows the event/data format
          const eventType = (chunk as any).event;
          const eventData = (chunk as any).data;

          if (eventType && eventData !== undefined) {
            // Check for interrupt events
            if (
              eventType === "__interrupt__" ||
              (eventData as any)?.__interrupt__
            ) {
              console.log("[POST /runs/stream] Interrupt event detected");
            }

            await streamWriter.writeSSE({
              data: JSON.stringify(eventData),
              event: eventType,
            });
          } else {
            // Fallback for single mode
            await streamWriter.writeSSE({
              data: JSON.stringify(chunk),
              event: "data",
            });
          }
        }
      } catch (streamError: any) {
        console.error("Stream processing error:", streamError);
        await streamWriter.writeSSE({
          data: JSON.stringify({ error: streamError.message }),
          event: "error",
        });
      }
    });
  } catch (error: any) {
    console.error("Stream error:", error);
    return c.json({ error: error.message, stack: error.stack }, 500);
  }
});

/**
 * Update State
 * POST /threads/:threadId/state
 */
app.post("/threads/:threadId/state", async (c) => {
  const threadId = c.req.param("threadId");
  const body = await c.req.json();
  const values = body.values;
  const asNode = body.asNode;

  const config = { configurable: { thread_id: threadId } };

  try {
    // graph.updateState returns the new configuration (checkpoint)
    const result = await graph.updateState(config, values, asNode);
    return c.json(result);
  } catch (error: any) {
    console.error("Update state error:", error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * Resume After Interrupt
 * POST /threads/:threadId/runs/resume
 *
 * Dedicated endpoint for resuming after human-in-the-loop interrupt
 */
app.post("/threads/:threadId/runs/resume", async (c) => {
  const threadId = c.req.param("threadId");
  const body = await c.req.json();

  const resumeValue = body.resume || "approved";
  const checkpointId = body.checkpoint_id;

  console.log(
    `[POST /runs/resume] Thread: ${threadId}, Resume: ${resumeValue}`
  );

  const runConfig = {
    configurable: {
      thread_id: threadId,
      ...(checkpointId ? { checkpoint_id: checkpointId } : {}),
    },
    streamMode: body.stream_mode || ["updates", "messages"],
  };

  try {
    // Create resume command
    const resumeCommand = new Command({ resume: resumeValue });

    if (body.stream !== false) {
      // Streaming response
      const stream = await graph.stream(resumeCommand, runConfig);

      return streamSSE(c, async (streamWriter) => {
        try {
          for await (const chunk of stream) {
            const eventType = (chunk as any).event;
            const eventData = (chunk as any).data;

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
        } catch (streamError: any) {
          console.error("Resume stream error:", streamError);
          await streamWriter.writeSSE({
            data: JSON.stringify({ error: streamError.message }),
            event: "error",
          });
        }
      });
    }
    // Non-streaming response
    const result = await graph.invoke(resumeCommand, runConfig);
    return c.json(result);
  } catch (error: any) {
    console.error("Resume error:", error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * Simple Run (Non-streaming) - Fallback
 * POST /threads/:threadId/runs
 */
app.post("/threads/:threadId/runs", async (c) => {
  const threadId = c.req.param("threadId");
  const body = await c.req.json();
  const input = body.input || {};
  const config = body.config || {};
  const checkpointId = body.checkpoint_id || config.configurable?.checkpoint_id;
  const command = body.command;

  const runConfig = {
    configurable: {
      thread_id: threadId,
      user_id: config.configurable?.user_id,
      requires_approval: config.configurable?.requires_approval,
      enable_reasoning: config.configurable?.enable_reasoning ?? true,
      enable_interrupt:
        config.configurable?.enable_interrupt ??
        agentConfig.ENABLE_TOOL_APPROVAL,
      ...(checkpointId ? { checkpoint_id: checkpointId } : {}),
    },
  };

  try {
    let result;

    if (command) {
      // Resume with command
      const resumeCommand = new Command(command);
      result = await graph.invoke(resumeCommand, runConfig);
    } else {
      result = await graph.invoke(input, runConfig);
    }

    return c.json(result);
  } catch (error: any) {
    console.error("Run error:", error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * Get Agent Configuration
 * GET /config
 */
app.get("/config", (c) => {
  // Return non-sensitive configuration
  return c.json({
    model_provider: agentConfig.MODEL_PROVIDER,
    model_name: agentConfig.MODEL_NAME,
    features: {
      reasoning: true,
      human_in_the_loop: agentConfig.ENABLE_TOOL_APPROVAL,
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
  });
});

/**
 * Assistants API
 * Mount assistants router with database context
 */
app.use("/assistants/*", async (c, next) => {
  // Inject database into context
  c.set("db", { assistants: assistantsDb });
  await next();
});
app.route("/assistants", assistantsRouter);

console.log(`Server running on port ${agentConfig.PORT}`);
console.log("Assistants API: /assistants");
console.log("Enhanced Agent Features:");
console.log("  - ReAct Pattern: Enabled");
console.log(
  `  - Human-in-the-Loop: ${agentConfig.ENABLE_TOOL_APPROVAL ? "Enabled" : "Disabled"}`
);
console.log(
  `  - Tool Approval: ${agentConfig.ENABLE_TOOL_APPROVAL ? "Enabled" : "Disabled"}`
);
console.log(
  `  - Rate Limiting: ${agentConfig.ENABLE_RATE_LIMITING ? "Enabled" : "Disabled"}`
);
console.log(
  `  - Token Tracking: ${agentConfig.ENABLE_TOKEN_TRACKING ? "Enabled" : "Disabled"}`
);
console.log(
  `  - PII Detection: ${agentConfig.ENABLE_PII_DETECTION ? "Enabled" : "Disabled"}`
);
console.log(
  `  - Tool Retry: ${agentConfig.ENABLE_TOOL_RETRY ? "Enabled" : "Disabled"}`
);

serve({
  fetch: app.fetch,
  port: agentConfig.PORT,
});
