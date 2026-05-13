import { createMiddleware } from "hono/factory";
import type { User } from "../db/schema.js";

export const requireTier = (...allowedTiers: string[]) => {
  return createMiddleware(async (c, next) => {
    const user = c.get("user") as User | undefined;
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    if (!allowedTiers.includes(user.tier)) {
      return c.json(
        {
          error: "Pro feature required",
          code: "TIER_UPGRADE_REQUIRED",
          upgradeUrl: "/pricing",
        },
        403
      );
    }

    await next();
  });
};
