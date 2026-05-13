import type { Session, SessionStore, SessionFilter } from "@singularity-ai/spectra-app";
import type { Message, Model } from "@singularity-ai/spectra-ai";
import { eq, and, desc, asc } from "drizzle-orm";
import { db } from "../db/index.js";
import { sessions, messages } from "../db/schema.js";
import { createLogger } from "../lib/logger.js";

const logger = createLogger("DrizzleSessionStore");

function parseModel(modelStr: string): Model {
  const [provider, id] = modelStr.includes("/") ? modelStr.split("/") : ["openai", modelStr];
  return {
    id: id || modelStr,
    name: id || modelStr,
    provider: provider || "openai",
    api: provider === "anthropic" ? "anthropic" : "openai-completions",
  };
}

function serializeModel(model: Model): string {
  return `${model.provider}/${model.id}`;
}

function dbMessageToSpectra(dbMsg: typeof messages.$inferSelect): Message | null {
  try {
    const base = {
      timestamp: new Date(dbMsg.timestamp).getTime(),
    };

    if (dbMsg.role === "user") {
      return {
        role: "user",
        content: dbMsg.content,
        ...base,
      };
    }

    if (dbMsg.role === "assistant") {
      const content = (() => {
        try {
          const parsed = JSON.parse(dbMsg.content);
          if (Array.isArray(parsed)) return parsed as import("@singularity-ai/spectra-ai").AssistantMessage["content"];
        } catch { /* fall through */ }
        return [{ type: "text" as const, text: dbMsg.content }];
      })();
      return {
        role: "assistant",
        content,
        provider: "openai",
        model: "gpt-4o",
        usage: dbMsg.tokenUsage as import("@singularity-ai/spectra-ai").Usage ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0 },
        stopReason: "stop",
        ...base,
      };
    }

    if (dbMsg.role === "toolResult") {
      const content = (() => {
        try {
          const parsed = JSON.parse(dbMsg.content);
          if (Array.isArray(parsed)) return parsed as import("@singularity-ai/spectra-ai").ToolResultMessage["content"];
        } catch { /* fall through */ }
        return [{ type: "text" as const, text: dbMsg.content }];
      })();
      return {
        role: "toolResult",
        toolCallId: dbMsg.toolCallId ?? "",
        toolName: dbMsg.toolName ?? "",
        content,
        isError: dbMsg.isError ?? false,
        ...base,
      };
    }

    return null;
  } catch (err) {
    logger.error("Failed to parse message", { messageId: dbMsg.id, error: String(err) });
    return null;
  }
}

function spectraMessageToDb(sessionId: string, msg: Message): typeof messages.$inferInsert {
  const base = {
    sessionId,
    role: msg.role,
    timestamp: new Date(msg.timestamp),
    toolCallId: msg.role === "toolResult" ? msg.toolCallId : null,
    toolName: msg.role === "toolResult" ? msg.toolName : null,
    isError: msg.role === "toolResult" ? msg.isError : false,
        tokenUsage: msg.role === "assistant" ? (msg.usage as unknown as Record<string, unknown>) : null,
  };

  if (msg.role === "user") {
    return {
      ...base,
      content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
    };
  }

  if (msg.role === "assistant") {
    return {
      ...base,
      content: JSON.stringify(msg.content),
    };
  }

  return {
    ...base,
    content: JSON.stringify(msg.content),
  };
}

export class DrizzleSessionStore implements SessionStore {
  async create(session: Session): Promise<Session> {
    await db.insert(sessions).values({
      id: session.id,
      userId: session.metadata.userId || "anonymous",
      title: "New Session",
      model: serializeModel(session.model),
      createdAt: session.metadata.createdAt,
      updatedAt: session.metadata.updatedAt,
    });

    if (session.messages.length > 0) {
      await db.insert(messages).values(
        session.messages.map((msg) => spectraMessageToDb(session.id, msg))
      );
    }

    return session;
  }

  async load(id: string): Promise<Session | null> {
    const [dbSession] = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
    if (!dbSession) return null;

    const dbMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.sessionId, id))
      .orderBy(asc(messages.timestamp));

    const spectraMessages = dbMessages.map(dbMessageToSpectra).filter((m): m is Message => m !== null);

    return {
      id: dbSession.id,
      model: parseModel(dbSession.model),
      messages: spectraMessages,
      config: {
        model: parseModel(dbSession.model),
      } as Session["config"],
      metadata: {
        createdAt: dbSession.createdAt,
        updatedAt: dbSession.updatedAt,
        turnCount: spectraMessages.filter((m) => m.role === "user").length,
        tokenUsage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0 },
        isStreaming: false,
        userId: dbSession.userId,
      },
    };
  }

  async save(session: Session): Promise<void> {
    await db
      .update(sessions)
      .set({ updatedAt: new Date() })
      .where(eq(sessions.id, session.id));

    // Upsert messages: delete existing and re-insert for simplicity
    await db.delete(messages).where(eq(messages.sessionId, session.id));
    if (session.messages.length > 0) {
      await db.insert(messages).values(
        session.messages.map((msg) => spectraMessageToDb(session.id, msg))
      );
    }
  }

  async delete(id: string): Promise<void> {
    await db.delete(sessions).where(eq(sessions.id, id));
  }

  async list(filter?: SessionFilter): Promise<Session[]> {
    const limit = filter?.limit ?? 20;
    const offset = filter?.offset ?? 0;

    let query = db.select().from(sessions).orderBy(desc(sessions.updatedAt)).limit(limit).offset(offset);
    if (filter?.userId) {
      query = query.where(eq(sessions.userId, filter.userId)) as typeof query;
    }
    const dbSessions = await query;

    const result: Session[] = [];
    for (const dbSession of dbSessions) {
      const dbMessages = await db
        .select()
        .from(messages)
        .where(eq(messages.sessionId, dbSession.id))
        .orderBy(asc(messages.timestamp));

      const spectraMessages = dbMessages.map(dbMessageToSpectra).filter((m): m is Message => m !== null);

      result.push({
        id: dbSession.id,
        model: parseModel(dbSession.model),
        messages: spectraMessages,
        config: {
          model: parseModel(dbSession.model),
        } as Session["config"],
        metadata: {
          createdAt: dbSession.createdAt,
          updatedAt: dbSession.updatedAt,
          turnCount: spectraMessages.filter((m) => m.role === "user").length,
          tokenUsage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0 },
          isStreaming: false,
          userId: dbSession.userId,
        },
      });
    }

    return result;
  }
}
