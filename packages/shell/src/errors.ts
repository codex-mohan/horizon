/**
 * Error types for shell execution
 */

export interface ErrorContext {
  command?: string;
  exitCode?: number;
  signal?: string;
  cwd?: string;
  env?: Record<string, string>;
  duration?: number;
}

/**
 * Base error class for shell operations
 */
export class ShellError extends Error {
  public readonly context: ErrorContext;
  public readonly cause?: Error;

  constructor(message: string, context: ErrorContext = {}, cause?: Error) {
    super(message);
    this.name = "ShellError";
    this.context = context;
    this.cause = cause;

    // Maintain proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ShellError);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      context: this.context,
      cause: this.cause?.message,
    };
  }
}

/**
 * Error thrown when command execution times out
 */
export class TimeoutError extends ShellError {
  public readonly timeout: number;

  constructor(command: string, timeout: number, context: ErrorContext = {}) {
    super(`Command timed out after ${timeout}ms: ${command}`, {
      ...context,
      command,
    });
    this.name = "TimeoutError";
    this.timeout = timeout;
  }
}

/**
 * Error thrown when command requires approval but wasn't approved
 */
export class PermissionError extends ShellError {
  public readonly reason: string;

  constructor(command: string, reason: string, context: ErrorContext = {}) {
    super(`Permission denied: ${reason}`, { ...context, command });
    this.name = "PermissionError";
    this.reason = reason;
  }
}

/**
 * Error thrown when command exits with non-zero status
 */
export class ExitError extends ShellError {
  public readonly exitCode: number;
  public readonly stderr: string;
  public readonly stdout: string;

  constructor(
    command: string,
    exitCode: number,
    stderr: string = "",
    stdout: string = "",
    context: ErrorContext = {},
  ) {
    const message = stdout
      ? `Command failed with exit code ${exitCode}: ${command}\n\nSTDOUT:\n${stdout}\n\nSTDERR:\n${stderr}`
      : stderr
        ? `Command failed with exit code ${exitCode}: ${command}\n\nSTDERR:\n${stderr}`
        : `Command failed with exit code ${exitCode}: ${command}`;

    super(message, {
      ...context,
      command,
      exitCode,
    });
    this.name = "ExitError";
    this.exitCode = exitCode;
    this.stderr = stderr;
    this.stdout = stdout;
  }
}

/**
 * Error thrown when command is killed by a signal
 */
export class SignalError extends ShellError {
  public readonly signal: string;

  constructor(command: string, signal: string, context: ErrorContext = {}) {
    super(`Command killed by signal ${signal}: ${command}`, {
      ...context,
      command,
      signal,
    });
    this.name = "SignalError";
    this.signal = signal;
  }
}
