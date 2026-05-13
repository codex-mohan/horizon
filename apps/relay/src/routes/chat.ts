import { Hono } from "hono";
import { eq, and, asc } from "drizzle-orm";
import { Agent } from "@singularity-ai/spectra-agent";
import type { Message, Model, UserMessage, AssistantMessage, Usage } from "@singularity-ai/spectra-ai";
import type { AgentTool, ToolResult } from "@singularity-ai/spectra-agent";
import { db } from "../db/index.js";
import { sessions, messages, apiKeys, usageLogs, type User } from "../db/schema.js";
import { redis } from "../lib/redis.js";
import { createLogger } from "../lib/logger.js";
import {
  chatRequestsTotal,
  chatDurationSeconds,
  toolExecutionsTotal,
  activeSseConnectionsGauge,
} from "../lib/metrics.js";
import { decryptApiKey } from "../lib/crypto.js";

const logger = createLogger("Chat");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatBody {
  sessionId: string;
  message: string;
}

// ---------------------------------------------------------------------------
// Model resolution
// ---------------------------------------------------------------------------

function resolveModel(modelId: string): Model {
  // Format: "provider/model-name" — parse provider prefix explicitly
  if (modelId.includes("/")) {
    const slashIndex = modelId.indexOf("/");
    const providerPrefix = modelId.slice(0, slashIndex);
    const modelName = modelId.slice(slashIndex + 1);

    if (providerPrefix === "openai") {
      return { id: modelName, name: modelName, provider: "openai-completions", api: "openai" };
    }
    if (providerPrefix === "anthropic") {
      return { id: modelName, name: modelName, provider: "anthropic", api: "anthropic-messages" };
    }
    if (providerPrefix === "groq") {
      return { id: modelName, name: modelName, provider: "groq", api: "groq" };
    }
    // Everything else with a / goes through OpenRouter
    return { id: modelId, name: modelId, provider: "openrouter", api: "openrouter" };
  }

  // Legacy bare model IDs (backward compatible)
  if (modelId.startsWith("claude")) {
    return { id: modelId, name: modelId, provider: "anthropic", api: "anthropic-messages" };
  }
  if (modelId.startsWith("gpt-") || modelId.startsWith("o1") || modelId.startsWith("o3")) {
    return { id: modelId, name: modelId, provider: "openai-completions", api: "openai" };
  }
  // Default to OpenRouter for unknown models
  return { id: modelId, name: modelId, provider: "openrouter", api: "openrouter" };
}

// ---------------------------------------------------------------------------
// Tool registry (stubs — sandbox integration will be added later)
// ---------------------------------------------------------------------------

function textResult(text: string): ToolResult {
  return { content: [{ type: "text", text }] };
}

const webSearchTool: AgentTool = {
  name: "web_search",
  description: "Search the web for information",
  parameters: {
    type: "object",
    properties: { query: { type: "string", description: "The search query" } },
    required: ["query"],
  },
  execute: async (_toolCallId, args) => {
    const query = String(args.query ?? "");
    return textResult(`[Mock web search results for: ${query}]\n1. Result A\n2. Result B`);
  },
};

const calculatorTool: AgentTool = {
  name: "calculator",
  description: "Evaluate mathematical expressions",
  parameters: {
    type: "object",
    properties: { expression: { type: "string", description: "Math expression to evaluate" } },
    required: ["expression"],
  },
  execute: async (_toolCallId, args) => {
    const expression = String(args.expression ?? "");
    return textResult(`[Mock calculator result: ${expression} = 42]`);
  },
};

const getTimeTool: AgentTool = {
  name: "get_time",
  description: "Get the current date and time",
  parameters: {
    type: "object",
    properties: { timezone: { type: "string", description: "Optional timezone" } },
  },
  execute: async (_toolCallId, args) => {
    const timezone = String(args.timezone ?? "UTC");
    return textResult(`Current time: ${new Date().toISOString()} (${timezone})`);
  },
};

const executePythonTool: AgentTool = {
  name: "execute_python",
  description: "Execute Python code in a sandboxed environment",
  parameters: {
    type: "object",
    properties: { code: { type: "string", description: "Python code to execute" } },
    required: ["code"],
  },
  execute: async (_toolCallId, args) => {
    const code = String(args.code ?? "");
    return textResult(`[Mock Python execution]\n\`\`\`python\n${code}\n\`\`\`\nOutput: Hello from Python sandbox`);
  },
};

const executeBashTool: AgentTool = {
  name: "execute_bash",
  description: "Execute bash commands in a sandboxed environment",
  parameters: {
    type: "object",
    properties: { command: { type: "string", description: "Bash command to execute" } },
    required: ["command"],
  },
  execute: async (_toolCallId, args) => {
    const command = String(args.command ?? "");
    return textResult(`[Mock Bash execution]\n\`\`\`bash\n${command}\n\`\`\`\nOutput: hello world`);
  },
};

const executeNodeTool: AgentTool = {
  name: "execute_node",
  description: "Execute Node.js code in a sandboxed environment",
  parameters: {
    type: "object",
    properties: { code: { type: "string", description: "Node.js code to execute" } },
    required: ["code"],
  },
  execute: async (_toolCallId, args) => {
    const code = String(args.code ?? "");
    return textResult(`[Mock Node.js execution]\n\`\`\`javascript\n${code}\n\`\`\`\nOutput: Hello from Node sandbox`);
  },
};

function getToolsForTier(tier: string): AgentTool[] {
  const safeTools = [webSearchTool, calculatorTool, getTimeTool];
  if (tier === "pro" || tier === "enterprise") {
    return [...safeTools, executePythonTool, executeBashTool, executeNodeTool];
  }
  return safeTools;
}

// ---------------------------------------------------------------------------
// API key resolution
// ---------------------------------------------------------------------------

async function resolveApiKey(user: User, provider: string): Promise<string | undefined> {
  // 1. BYOK — find key matching the requested provider, or fallback to default
  const userKeys = await db.select().from(apiKeys).where(eq(apiKeys.userId, user.id));

  if (userKeys.length > 0) {
    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!encryptionKey) {
      logger.error("ENCRYPTION_KEY not configured");
      return undefined;
    }

    // Try to find a key matching the provider first
    const matchingKey = userKeys.find(
      (k) => k.provider.toLowerCase() === provider.toLowerCase()
    ) ?? userKeys.find((k) => k.isDefault) ?? userKeys[0]!;

    try {
      const key = decryptApiKey(matchingKey.keyEncrypted, encryptionKey);
      logger.info("Using BYOK key", { userId: user.id, provider: matchingKey.provider, requestedProvider: provider });
      return key;
    } catch (err) {
      logger.error("Failed to decrypt BYOK key", {
        userId: user.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // 2. Server keys (Pro / Enterprise / Free with limits)
  let serverKey: string | undefined;
  if (provider === "anthropic") {
    serverKey = process.env.ANTHROPIC_API_KEY;
  } else if (provider === "groq") {
    serverKey = process.env.GROQ_API_KEY;
  } else if (provider === "openrouter") {
    serverKey = process.env.OPENROUTER_API_KEY;
  } else {
    serverKey = process.env.OPENAI_API_KEY;
  }

  if (serverKey) {
    logger.info("Using server key", { userId: user.id, provider });
  } else {
    logger.warn("No API key found", { userId: user.id, provider });
  }
  return serverKey;
}

// ---------------------------------------------------------------------------
// Message helpers
// ---------------------------------------------------------------------------

function dbMessageToSpectra(dbMsg: typeof messages.$inferSelect, model: Model): Message {
  const timestamp = dbMsg.timestamp ? new Date(dbMsg.timestamp).getTime() : Date.now();

  if (dbMsg.role === "user") {
    return { role: "user", content: dbMsg.content, timestamp };
  }

  if (dbMsg.role === "assistant") {
    return {
      role: "assistant",
      content: [{ type: "text", text: dbMsg.content }],
      provider: model.provider,
      model: model.id,
      usage: (dbMsg.tokenUsage as Usage | null) ?? {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
      },
      stopReason: "stop",
      timestamp,
    };
  }

  if (dbMsg.role === "tool" || dbMsg.role === "toolResult") {
    return {
      role: "toolResult",
      toolCallId: dbMsg.toolCallId ?? "",
      toolName: dbMsg.toolName ?? "",
      content: [{ type: "text", text: dbMsg.content }],
      isError: dbMsg.isError ?? false,
      timestamp,
    };
  }

  // Fallback
  return { role: "user", content: dbMsg.content, timestamp };
}

function getMessageText(msg: Message): string {
  if (msg.role === "user") {
    return typeof msg.content === "string"
      ? msg.content
      : msg.content.map((c) => ("text" in c ? c.text : "")).join("");
  }
  if (msg.role === "assistant") {
    return msg.content
      .filter((c): c is Extract<typeof c, { type: "text" }> => c.type === "text")
      .map((c) => c.text)
      .join("\n");
  }
  if (msg.role === "toolResult") {
    return msg.content
      .filter((c): c is Extract<typeof c, { type: "text" }> => c.type === "text")
      .map((c) => c.text)
      .join("\n");
  }
  return "";
}

function extractDbFields(msg: Message) {
  const base = {
    role: msg.role === "toolResult" ? "tool" : msg.role,
    content: msg.role === "assistant" ? JSON.stringify(msg.content) : getMessageText(msg),
  };

  if (msg.role === "toolResult") {
    return {
      ...base,
      toolCallId: msg.toolCallId,
      toolName: msg.toolName,
      isError: msg.isError,
    };
  }

  if (msg.role === "assistant") {
    return {
      ...base,
      tokenUsage: msg.usage,
    };
  }

  return base;
}

// ---------------------------------------------------------------------------
// SSE helper
// ---------------------------------------------------------------------------

function formatSse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const chatRouter = new Hono<{ Variables: { user: User } }>();

chatRouter.post("/stream", async (c) => {
  const startTime = performance.now();
  const user = c.get("user");

  let body: ChatBody;
  try {
    const raw = await c.req.json<Record<string, unknown>>();
    if (!raw.sessionId || typeof raw.sessionId !== "string") {
      return c.json({ error: "sessionId is required" }, 400);
    }
    if (!raw.message || typeof raw.message !== "string") {
      return c.json({ error: "message is required" }, 400);
    }
    body = { sessionId: raw.sessionId, message: raw.message };
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const { sessionId, message } = body;

  // Load and verify session ownership
  const [session] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, user.id)))
    .limit(1);

  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }

  // Load historical messages (ascending order)
  const dbMessages = await db
    .select()
    .from(messages)
    .where(eq(messages.sessionId, sessionId))
    .orderBy(asc(messages.timestamp));

  const model = resolveModel(session.model ?? "gpt-4o");
  const history: Message[] = dbMessages.map((m) => dbMessageToSpectra(m, model));
  logger.info("Chat stream started", {
    userId: user.id,
    sessionId,
    model: model.id,
    provider: model.provider,
    tier: user.tier,
    messageCount: history.length,
  });

  // Persist the user message immediately
  const insertResult = await db
    .insert(messages)
    .values({
      sessionId,
      role: "user",
      content: message,
      timestamp: new Date(),
    })
    .returning();
  const savedUserMsg = insertResult[0];

  // Invalidate session cache so updatedAt / message list stays fresh
  await redis.del(`session:${sessionId}`);

  // Metrics
  chatRequestsTotal.inc({ user_tier: user.tier, model: model.id });
  activeSseConnectionsGauge.inc();

  const abortSignal = c.req.raw.signal;
  let agent: Agent | undefined;

  const readable = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(new TextEncoder().encode(formatSse(event, data)));
        } catch {
          // Stream already closed — swallow
        }
      };

      let totalUsage = { input: 0, output: 0, totalTokens: 0 };

      try {
        const tools = getToolsForTier(user.tier);

        agent = new Agent({
          model,
          tools,
          getApiKey: (provider) => resolveApiKey(user, provider),
          streamOptions: {
            signal: abortSignal,
          },
        });

        agent.restoreHistory(history);

        // Track tool executions for metrics
        agent.subscribe(async (event) => {
          if (event.type === "tool_execution_end") {
            toolExecutionsTotal.inc({
              tool_name: event.toolName,
              status: event.isError ? "error" : "success",
            });
          }
        });

        const userMessage: UserMessage = {
          role: "user",
          content: message,
          timestamp: Date.now(),
        };

        for await (const event of agent.run(userMessage)) {
          if (abortSignal.aborted) {
            break;
          }

          switch (event.type) {
            case "message_start": {
              const text = getMessageText(event.message);
              send("message_start", {
                role: event.message.role,
                content: text,
                id: event.message.role === "user" ? savedUserMsg?.id : undefined,
              });
              break;
            }

            case "message_update": {
              if (event.message.role === "assistant") {
                const text = getMessageText(event.message);
                send("message_delta", { content: text });
              }
              break;
            }

            case "message_end": {
              const text = getMessageText(event.message);
              if (event.message.role === "assistant") {
                const am = event.message as AssistantMessage;
                if (am.stopReason === "error" || am.errorMessage) {
                  send("error", {
                    error: am.errorMessage || "Assistant encountered an error",
                    content: text,
                  });
                } else {
                  totalUsage.input += am.usage.input;
                  totalUsage.output += am.usage.output;
                  totalUsage.totalTokens += am.usage.totalTokens;
                  send("message_end", {
                    role: "assistant",
                    content: text,
                    usage: am.usage,
                  });
                }
              } else {
                send("message_end", { role: event.message.role, content: text });
              }
              break;
            }

            case "tool_execution_start": {
              send("tool_start", {
                toolCallId: event.toolCallId,
                toolName: event.toolName,
                args: event.args,
              });
              break;
            }

            case "tool_execution_end": {
              send("tool_end", {
                toolCallId: event.toolCallId,
                toolName: event.toolName,
                result: event.result,
                isError: event.isError,
              });
              break;
            }

            case "agent_end": {
              send("done", {});
              break;
            }
          }
        }

        if (abortSignal.aborted) {
          send("done", { aborted: true });
        }
      } catch (err) {
        logger.error("Chat stream error", {
          userId: user.id,
          sessionId,
          error: err instanceof Error ? err.message : String(err),
        });
        send("error", {
          error: err instanceof Error ? err.message : "Stream error",
        });
        send("done", {});
      } finally {
        // Persist any newly generated messages
        if (agent) {
          const allMessages = agent.messages;
          const newMessages = allMessages.slice(history.length + 1); // +1 for the user message we added

          for (const msg of newMessages) {
            const fields = extractDbFields(msg);
            await db.insert(messages).values({
              sessionId,
              ...fields,
              timestamp: new Date(),
            } as typeof messages.$inferInsert);
          }

          // Update session timestamp
          await db
            .update(sessions)
            .set({ updatedAt: new Date() })
            .where(eq(sessions.id, sessionId));

          // Track usage
          if (totalUsage.totalTokens > 0) {
            await db.insert(usageLogs).values({
              userId: user.id,
              sessionId,
              model: model.id,
              inputTokens: totalUsage.input,
              outputTokens: totalUsage.output,
              totalTokens: totalUsage.totalTokens,
              timestamp: new Date(),
            });
          }
        }

        const duration = (performance.now() - startTime) / 1000;
        chatDurationSeconds.observe({ model: model.id }, duration);
        activeSseConnectionsGauge.dec();

        logger.info("Chat stream completed", {
          userId: user.id,
          sessionId,
          model: model.id,
          durationSeconds: duration.toFixed(2),
          totalTokens: totalUsage.totalTokens,
        });

        try {
          controller.close();
        } catch {
          // Already closed
        }
      }
    },
  });

  return c.body(readable, 200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
});

export default chatRouter;
