import { Hono } from "hono";
import { SessionManager } from "@singularity-ai/spectra-app";
import { eq, and, desc, asc } from "drizzle-orm";
import { db } from "../db/index.js";
import { sessions as sessionsTable, messages, type User } from "../db/schema.js";
import { redis } from "../lib/redis.js";
import { createLogger } from "../lib/logger.js";
import { DrizzleSessionStore } from "../services/drizzle-session-store.js";

const logger = createLogger("Sessions");
const sessionStore = new DrizzleSessionStore();
const sessionManager = new SessionManager(sessionStore);

const sessionsRouter = new Hono<{ Variables: { user: User } }>();

// POST / - Create session
sessionsRouter.post("/", async (c) => {
  const user = c.get("user");
  const body = await c.req.json<{ title?: string; model?: string }>();

  const [dbSession] = await db
    .insert(sessionsTable)
    .values({
      userId: user.id,
      title: body.title ?? "New Session",
      model: body.model ?? "gpt-4o",
    })
    .returning();

  if (!dbSession) {
    return c.json({ error: "Failed to create session" }, 500);
  }

  await redis.setex(`session:${dbSession.id}`, 300, JSON.stringify(dbSession));

  logger.info("Session created", { sessionId: dbSession.id, userId: user.id });
  return c.json(dbSession, 201);
});

// GET / - List user sessions
sessionsRouter.get("/", async (c) => {
  const user = c.get("user");
  const limit = Math.min(Number(c.req.query("limit") ?? 20), 100);
  const offset = Number(c.req.query("offset") ?? 0);

  const list = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.userId, user.id))
    .orderBy(desc(sessionsTable.updatedAt))
    .limit(limit)
    .offset(offset);

  return c.json(list);
});

// GET /:id - Get session with messages
sessionsRouter.get("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  // Use Spectra SessionManager to load full session with messages
  const session = await sessionManager.load(id);
  if (!session || session.metadata.userId !== user.id) {
    return c.json({ error: "Session not found" }, 404);
  }

  // Also return the DB session record for metadata
  const [dbSession] = await db
    .select()
    .from(sessionsTable)
    .where(and(eq(sessionsTable.id, id), eq(sessionsTable.userId, user.id)))
    .limit(1);

  return c.json({
    session: dbSession,
    messages: session.messages,
    spectraSession: session,
  });
});

// DELETE /:id - Delete session
sessionsRouter.delete("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  const [existing] = await db
    .select({ id: sessionsTable.id })
    .from(sessionsTable)
    .where(and(eq(sessionsTable.id, id), eq(sessionsTable.userId, user.id)))
    .limit(1);

  if (!existing) {
    return c.json({ error: "Session not found" }, 404);
  }

  await sessionManager.delete(id);
  await redis.del(`session:${id}`);

  logger.info("Session deleted", { sessionId: id, userId: user.id });
  return c.json({ success: true });
});

export default sessionsRouter;
