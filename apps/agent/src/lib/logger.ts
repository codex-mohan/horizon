/**
 * Agent Logger
 *
 * Configured logger instance for the agent server.
 * Controlled by ENABLE_LOGGING and LOG_LEVEL env vars via agentConfig.
 */

import { createLogger, LogLevel } from "@horizon/shared-utils";
import { agentConfig } from "./config.js";

const LOG_LEVEL_MAP: Record<string, LogLevel> = {
  trace: LogLevel.TRACE,
  debug: LogLevel.DEBUG,
  info: LogLevel.INFO,
  warn: LogLevel.WARN,
  error: LogLevel.ERROR,
  fatal: LogLevel.FATAL,
};

const minLevel = agentConfig.ENABLE_LOGGING
  ? (LOG_LEVEL_MAP[agentConfig.LOG_LEVEL] ?? LogLevel.INFO)
  : LogLevel.FATAL + 1;

export const logger = createLogger("Agent", {
  minLevel,
});

export { LogLevel };
