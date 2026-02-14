import type { Context, Next } from "hono";
import { agentConfig } from "../lib/config.js";

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};
const WINDOW_MS = agentConfig.RATE_LIMIT_WINDOW * 1000;
const MAX_REQUESTS = 100; // Default limit, can be configurable

/**
 * Simple In-Memory Rate Limiter Middleware
 */
export const rateLimiter = async (c: Context, next: Next) => {
  if (!agentConfig.ENABLE_RATE_LIMITING) {
    return await next();
  }

  const ip = c.req.header("x-forwarded-for") || "unknown";
  const now = Date.now();

  if (!store[ip] || now > store[ip].resetTime) {
    store[ip] = {
      count: 1,
      resetTime: now + WINDOW_MS,
    };
  } else {
    store[ip].count += 1;
  }

  if (store[ip].count > MAX_REQUESTS) {
    return c.json({ error: "Too many requests" }, 429);
  }

  await next();
};
