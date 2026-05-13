import { createMiddleware } from "hono/factory";
import { jwtVerify } from "jose";
import * as jose from "jose";
import type { User } from "../db/schema.js";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { createLogger } from "../lib/logger.js";

const logger = createLogger("AuthMiddleware");

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "dev-secret-change-in-production"
);

export interface AuthContext {
  user: User;
}

export const authMiddleware = createMiddleware(async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const token = authHeader.substring(7);

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      clockTolerance: 60,
    });

    const userId = payload.sub;
    if (!userId) {
      return c.json({ error: "Invalid token" }, 401);
    }

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      return c.json({ error: "User not found" }, 401);
    }

    c.set("user", user);
    await next();
  } catch (err) {
    logger.warn("JWT verification failed", { error: err instanceof Error ? err.message : String(err) });
    return c.json({ error: "Invalid token" }, 401);
  }
});

export async function generateTokens(userId: string) {
  const accessToken = await new jose.SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(JWT_SECRET);

  const refreshToken = await new jose.SignJWT({ sub: userId, type: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);

  return { accessToken, refreshToken };
}

export { jose };
