import { createMiddleware } from "hono/factory";
import { redis } from "../lib/redis.js";
import { createLogger } from "../lib/logger.js";
import { rateLimitHitsTotal } from "../lib/metrics.js";
import type { User } from "../db/schema.js";

const logger = createLogger("RateLimit");
const isDev = process.env.NODE_ENV !== "production";

const TIER_LIMITS: Record<string, { rpm: number; rpd: number }> = {
  free: { rpm: 10, rpd: 50 },
  pro: { rpm: 60, rpd: Infinity },
  enterprise: { rpm: Infinity, rpd: Infinity },
};

export const rateLimitMiddleware = createMiddleware(async (c, next) => {
  const user = c.get("user") as User | undefined;
  const userId = user?.id || c.req.header("x-forwarded-for") || "anonymous";
  const tier = user?.tier || "free";
  const limits = (TIER_LIMITS[tier] ?? TIER_LIMITS.free) as { rpm: number; rpd: number };

  const now = Date.now();
  const minuteKey = `ratelimit:${userId}:minute`;
  const dayKey = `ratelimit:${userId}:day`;

  // Minute window (sliding window)
  const minutePipe = redis.pipeline();
  minutePipe.zremrangebyscore(minuteKey, 0, now - 60000);
  minutePipe.zcard(minuteKey);
  minutePipe.zadd(minuteKey, now, `${now}-${Math.random()}`);
  minutePipe.pexpire(minuteKey, 60000);
  const minuteResults = await minutePipe.exec();
  const minuteCount = (minuteResults?.[1]?.[1] as number) || 0;

  // Day window
  const dayPipe = redis.pipeline();
  dayPipe.zremrangebyscore(dayKey, 0, now - 86400000);
  dayPipe.zcard(dayKey);
  dayPipe.zadd(dayKey, now, `${now}-${Math.random()}`);
  dayPipe.pexpire(dayKey, 86400000);
  const dayResults = await dayPipe.exec();
  const dayCount = (dayResults?.[1]?.[1] as number) || 0;

  // In dev mode: unlimited for everyone, just track counts
  const effectiveRpm = isDev ? Infinity : limits.rpm;
  const effectiveRpd = isDev ? Infinity : limits.rpd;

  const remainingMinute = Math.max(0, effectiveRpm - minuteCount - 1);
  const remainingDay = Math.max(0, effectiveRpd - dayCount - 1);

  c.header("X-RateLimit-Limit-Minute", String(effectiveRpm));
  c.header("X-RateLimit-Remaining-Minute", String(remainingMinute));
  c.header("X-RateLimit-Limit-Day", String(effectiveRpd));
  c.header("X-RateLimit-Remaining-Day", String(remainingDay));

  if (minuteCount >= effectiveRpm || dayCount >= effectiveRpd) {
    rateLimitHitsTotal.inc({ user_tier: tier });
    logger.warn("Rate limit exceeded", { userId: user?.id, tier, minuteCount, dayCount });
    return c.json(
      { error: "Rate limit exceeded", code: "RATE_LIMITED" },
      429
    );
  }

  await next();
});
