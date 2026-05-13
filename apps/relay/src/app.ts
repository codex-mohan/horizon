import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";
import { authMiddleware } from "./middleware/auth.js";
import { rateLimitMiddleware } from "./middleware/rate-limit.js";
import { register as promRegister } from "./lib/metrics.js";
import { createLogger } from "./lib/logger.js";
import { httpRequestsTotal, httpDurationSeconds } from "./lib/metrics.js";
import authRoutes from "./routes/auth.js";
import sessionRoutes from "./routes/sessions.js";
import chatRoutes from "./routes/chat.js";
import stripeRoutes from "./routes/stripe.js";
import modelsRoutes from "./routes/models.js";
import userRoutes from "./routes/user.js";
import apiKeysRoutes from "./routes/api-keys.js";

const logger = createLogger("App");

export function createApp(): Hono {
  const app = new Hono();

  // CORS
  app.use(
    cors({
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      credentials: true,
    })
  );

  // Request logging
  app.use(honoLogger((str) => logger.info(str)));

  // Metrics middleware
  app.use(async (c, next) => {
    const start = performance.now();
    await next();
    const duration = (performance.now() - start) / 1000;
    const route = c.req.routePath || "unknown";
    const status = c.res.status;
    httpRequestsTotal.inc({ method: c.req.method, route, status: String(status) });
    httpDurationSeconds.observe({ method: c.req.method, route }, duration);
  });

  // Health check
  app.get("/health", (c) => c.json({ status: "ok", timestamp: new Date().toISOString() }));

  // Prometheus metrics
  app.get("/metrics", async (c) => {
    const metrics = await promRegister.metrics();
    return c.text(metrics, 200, { "Content-Type": promRegister.contentType });
  });

  // Public routes
  app.route("/v1/auth", authRoutes);
  app.route("/v1/stripe", stripeRoutes);
  app.route("/v1/models", modelsRoutes);

  // Protected routes (auth + rate limit)
  app.use("/v1/*", authMiddleware);
  app.use("/v1/*", rateLimitMiddleware);

  app.route("/v1/sessions", sessionRoutes);
  app.route("/v1/chat", chatRoutes);
  app.route("/v1", userRoutes);
  app.route("/v1/api-keys", apiKeysRoutes);

  // Error handling
  app.onError((err, c) => {
    logger.error("Unhandled error", { error: err.message, stack: err.stack });
    return c.json({ error: "Internal server error", code: "INTERNAL_ERROR" }, 500);
  });

  return app;
}
