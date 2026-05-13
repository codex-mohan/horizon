import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { db } from "../db/index.js";
import { apiKeys, type User } from "../db/schema.js";
import { encryptApiKey, decryptApiKey } from "../lib/crypto.js";
import { createLogger } from "../lib/logger.js";

const logger = createLogger("ApiKeys");

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

const apiKeysRouter = new Hono<{ Variables: { user: User } }>();

interface ApiKeyResponse {
  id: string;
  provider: string;
  isDefault: boolean;
  createdAt: string;
  // Never return the actual key
}

function toResponse(key: typeof apiKeys.$inferSelect): ApiKeyResponse {
  return {
    id: key.id,
    provider: key.provider,
    isDefault: !!key.isDefault,
    createdAt: key.createdAt ? new Date(key.createdAt).toISOString() : new Date().toISOString(),
  };
}

// GET /v1/api-keys — list user's API keys
apiKeysRouter.get("/", async (c) => {
  const user = c.get("user");

  try {
    const keys = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.userId, user.id))
      .orderBy(apiKeys.createdAt);

    return c.json({ keys: keys.map(toResponse) });
  } catch (err) {
    logger.error("Failed to list API keys", {
      userId: user.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return c.json({ error: "Failed to list API keys" }, 500);
  }
});

// POST /v1/api-keys — add a new API key
apiKeysRouter.post("/", async (c) => {
  const user = c.get("user");

  if (!ENCRYPTION_KEY) {
    logger.error("ENCRYPTION_KEY not configured");
    return c.json({ error: "Server encryption not configured" }, 500);
  }

  try {
    const body = await c.req.json<{
      provider: string;
      key: string;
      isDefault?: boolean;
    }>();

    const { provider, key, isDefault } = body;

    if (!provider || typeof provider !== "string") {
      return c.json({ error: "Provider is required" }, 400);
    }

    if (!key || typeof key !== "string" || key.length < 10) {
      return c.json({ error: "Valid API key is required" }, 400);
    }

    // Normalize provider name
    const normalizedProvider = provider.toLowerCase().trim();

    // Encrypt the key
    const encrypted = encryptApiKey(key, ENCRYPTION_KEY);

    // If setting as default, unset other defaults for this provider
    if (isDefault) {
      await db
        .update(apiKeys)
        .set({ isDefault: false })
        .where(eq(apiKeys.userId, user.id));
    }

    const [created] = await db
      .insert(apiKeys)
      .values({
        userId: user.id,
        provider: normalizedProvider,
        keyEncrypted: encrypted,
        isDefault: isDefault ?? false,
      })
      .returning();

    if (!created) {
      return c.json({ error: "Failed to save API key" }, 500);
    }

    logger.info("API key saved", { userId: user.id, provider: normalizedProvider });

    return c.json({ key: toResponse(created) }, 201);
  } catch (err) {
    logger.error("Failed to save API key", {
      userId: user.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return c.json({ error: "Failed to save API key" }, 500);
  }
});

// PATCH /v1/api-keys/:id/default — set as default
apiKeysRouter.patch("/:id/default", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  try {
    // Verify ownership
    const [existing] = await db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, user.id)))
      .limit(1);

    if (!existing) {
      return c.json({ error: "API key not found" }, 404);
    }

    // Unset all defaults for this user
    await db
      .update(apiKeys)
      .set({ isDefault: false })
      .where(eq(apiKeys.userId, user.id));

    // Set this one as default
    const [updated] = await db
      .update(apiKeys)
      .set({ isDefault: true })
      .where(eq(apiKeys.id, id))
      .returning();

    if (!updated) {
      return c.json({ error: "Failed to update API key" }, 500);
    }

    return c.json({ key: toResponse(updated) });
  } catch (err) {
    logger.error("Failed to set default API key", {
      userId: user.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return c.json({ error: "Failed to update API key" }, 500);
  }
});

// DELETE /v1/api-keys/:id — remove an API key
apiKeysRouter.delete("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  try {
    const [existing] = await db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, user.id)))
      .limit(1);

    if (!existing) {
      return c.json({ error: "API key not found" }, 404);
    }

    await db.delete(apiKeys).where(eq(apiKeys.id, id));

    logger.info("API key deleted", { userId: user.id, keyId: id });

    return c.json({ success: true });
  } catch (err) {
    logger.error("Failed to delete API key", {
      userId: user.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return c.json({ error: "Failed to delete API key" }, 500);
  }
});

export default apiKeysRouter;
