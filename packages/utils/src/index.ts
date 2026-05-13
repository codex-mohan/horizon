import type { LogEntry, LogLevel } from "@horizon/types";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export function createLogger(name: string, minLevel: LogLevel = "debug") {
  const min = LOG_LEVELS[minLevel];

  function log(level: LogLevel, message: string, context?: Record<string, unknown>) {
    if (LOG_LEVELS[level] < min) return;
    const entry: LogEntry = { level, message, timestamp: Date.now(), context };
    const prefix = `[${level.toUpperCase()}] [${name}]`;
    const ts = new Date(entry.timestamp).toISOString();
    switch (level) {
      case "error":
        console.error(`${ts} ${prefix} ${message}`, context ?? "");
        break;
      case "warn":
        console.warn(`${ts} ${prefix} ${message}`, context ?? "");
        break;
      default:
        console.log(`${ts} ${prefix} ${message}`, context ?? "");
    }
  }

  return {
    debug: (msg: string, ctx?: Record<string, unknown>) => log("debug", msg, ctx),
    info: (msg: string, ctx?: Record<string, unknown>) => log("info", msg, ctx),
    warn: (msg: string, ctx?: Record<string, unknown>) => log("warn", msg, ctx),
    error: (msg: string, ctx?: Record<string, unknown>) => log("error", msg, ctx),
  };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${value}`);
}

export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

export function generateId(): string {
  return crypto.randomUUID();
}
