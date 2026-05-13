import { Counter, Histogram, Gauge, Registry } from "prom-client";

export const register = new Registry();

// HTTP requests counter
export const httpRequestsTotal = new Counter({
  name: "horizon_http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "route", "status"],
  registers: [register],
});

// HTTP request duration
export const httpDurationSeconds = new Histogram({
  name: "horizon_http_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route"],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

// Chat requests counter
export const chatRequestsTotal = new Counter({
  name: "horizon_chat_requests_total",
  help: "Total chat requests",
  labelNames: ["user_tier", "model"],
  registers: [register],
});

// Chat duration
export const chatDurationSeconds = new Histogram({
  name: "horizon_chat_duration_seconds",
  help: "Chat request duration in seconds",
  labelNames: ["model"],
  buckets: [0.5, 1, 2, 5, 10, 30, 60],
  registers: [register],
});

// Tool executions
export const toolExecutionsTotal = new Counter({
  name: "horizon_tool_executions_total",
  help: "Total tool executions",
  labelNames: ["tool_name", "status"],
  registers: [register],
});

// Rate limit hits
export const rateLimitHitsTotal = new Counter({
  name: "horizon_rate_limit_hits_total",
  help: "Total rate limit hits",
  labelNames: ["user_tier"],
  registers: [register],
});

// Active sessions gauge
export const activeSessionsGauge = new Gauge({
  name: "horizon_active_sessions",
  help: "Number of active sessions",
  registers: [register],
});

// Active SSE connections
export const activeSseConnectionsGauge = new Gauge({
  name: "horizon_active_sse_connections",
  help: "Number of active SSE connections",
  registers: [register],
});

// Sandbox queue depth
export const sandboxQueueDepthGauge = new Gauge({
  name: "horizon_sandbox_queue_depth",
  help: "Sandbox job queue depth",
  registers: [register],
});

// Sandbox workers busy
export const sandboxWorkersBusyGauge = new Gauge({
  name: "horizon_sandbox_workers_busy",
  help: "Number of busy sandbox workers",
  registers: [register],
});
