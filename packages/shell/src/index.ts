/**
 * @horizon/shell - Cross-platform shell execution library
 *
 * This module provides sophisticated shell execution capabilities using Bun's
 * built-in shell ($`command`) which works cross-platform (Windows, macOS, Linux).
 *
 * Features:
 * - Cross-platform shell commands (Unix-style commands work on Windows)
 * - Interactive and non-interactive execution modes
 * - Command output streaming
 * - Timeout and resource management
 * - Command history tracking
 * - Safe execution with approval modes
 *
 * @module @horizon/shell
 */

export {
  type ErrorContext,
  PermissionError,
  ShellError,
  TimeoutError,
} from "./errors.js";
export {
  type ExecutionResult,
  type ShellConfig,
  ShellExecutor,
} from "./executor.js";
export { CommandHistory, type HistoryEntry } from "./history.js";
export {
  type InteractiveConfig,
  InteractiveShell,
  type SessionState,
} from "./interactive.js";
export { detectOS, getPlatformInfo, type PlatformInfo } from "./platform.js";
