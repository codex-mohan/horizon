import { Hono } from "hono";
import { hash, compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import type { User } from "../db/schema.js";
import { createLogger } from "../lib/logger.js";

const logger = createLogger("User");

const userRouter = new Hono<{ Variables: { user: User } }>();

// GET /v1/me — current user
userRouter.get("/me", async (c) => {
  const user = c.get("user");
  return c.json({
    id: user.id,
    email: user.email,
    name: user.name,
    tier: user.tier,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
  });
});

// PATCH /v1/me — update profile
userRouter.patch("/me", async (c) => {
  const user = c.get("user");

  try {
    const body = await c.req.json<{ name?: string; email?: string }>();

    const updates: Partial<typeof users.$inferInsert> = {};

    if (body.name !== undefined) {
      if (typeof body.name !== "string") {
        return c.json({ error: "Name must be a string" }, 400);
      }
      if (body.name.length > 255) {
        return c.json({ error: "Name too long (max 255 chars)" }, 400);
      }
      updates.name = body.name || null;
    }

    if (body.email !== undefined) {
      if (typeof body.email !== "string") {
        return c.json({ error: "Email must be a string" }, 400);
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(body.email)) {
        return c.json({ error: "Invalid email format" }, 400);
      }

      // Check if email is already taken by another user
      const [existing] = await db
        .select()
        .from(users)
        .where(eq(users.email, body.email))
        .limit(1);

      if (existing && existing.id !== user.id) {
        return c.json({ error: "Email already in use" }, 409);
      }

      updates.email = body.email;
    }

    if (Object.keys(updates).length === 0) {
      return c.json({ error: "No fields to update" }, 400);
    }

    const [updated] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, user.id))
      .returning();

    if (!updated) {
      return c.json({ error: "Failed to update user" }, 500);
    }

    logger.info("User profile updated", { userId: user.id });

    return c.json({
      id: updated.id,
      email: updated.email,
      name: updated.name,
      tier: updated.tier,
      avatarUrl: updated.avatarUrl,
    });
  } catch (err) {
    logger.error("Profile update failed", {
      userId: user.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return c.json({ error: "Internal server error" }, 500);
  }
});

// POST /v1/me/password — update password
userRouter.post("/me/password", async (c) => {
  const user = c.get("user");

  try {
    const body = await c.req.json<{ currentPassword: string; newPassword: string }>();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || typeof currentPassword !== "string") {
      return c.json({ error: "Current password is required" }, 400);
    }

    if (!newPassword || typeof newPassword !== "string") {
      return c.json({ error: "New password is required" }, 400);
    }

    if (newPassword.length < 8) {
      return c.json({ error: "New password must be at least 8 characters" }, 400);
    }

    // Users who signed up via OAuth may not have a password
    if (!user.passwordHash) {
      return c.json({ error: "Password cannot be changed for OAuth accounts" }, 400);
    }

    const valid = await compare(currentPassword, user.passwordHash);
    if (!valid) {
      return c.json({ error: "Current password is incorrect" }, 401);
    }

    const newHash = await hash(newPassword, 10);

    await db
      .update(users)
      .set({ passwordHash: newHash })
      .where(eq(users.id, user.id));

    logger.info("User password updated", { userId: user.id });

    return c.json({ success: true });
  } catch (err) {
    logger.error("Password update failed", {
      userId: user.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default userRouter;
