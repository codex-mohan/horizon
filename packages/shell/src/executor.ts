/**
 * Shell Executor - Core command execution engine using Bun's shell
 *
 * Bun's shell ($`command`) provides cross-platform shell execution:
 * - Unix-style commands work on Windows (ls, cat, grep, etc.)
 * - Proper escaping and interpolation
 * - Streaming output support
 * - Pipe and redirection support
 */

// import { $ } from "bun"; // Removed for cross-runtime support
import * as child_process from "node:child_process";
import { ExitError, PermissionError, ShellError, TimeoutError } from "./errors.js";
import { CommandHistory } from "./history.js";
import { getPlatformInfo, type PlatformInfo } from "./platform.js";

/**
 * Execution approval modes
 */
export type ApprovalMode =
  | "always" // Always require approval
  | "never" // Never require approval (auto-approve)
  | "dangerous" // Only require approval for dangerous commands
  | "custom"; // Use custom approval function

/**
 * Shell executor configuration
 */
export interface ShellConfig {
  /** Working directory for commands */
  cwd?: string;

  /** Environment variables */
  env?: Record<string, string>;

  /** Default timeout in milliseconds (0 = no timeout) */
  timeout?: number;

  /** Maximum output size in bytes before truncation */
  maxOutputSize?: number;

  /** Approval mode for command execution */
  approvalMode?: ApprovalMode;

  /** Custom approval function (required if approvalMode is 'custom') */
  approvalFn?: (command: string, context: ApprovalContext) => Promise<boolean>;

  /** List of dangerous command patterns (regex) */
  dangerousPatterns?: RegExp[];

  /** Enable command history tracking */
  trackHistory?: boolean;

  /** Maximum history entries to keep */
  maxHistoryEntries?: number;

  /** Callback for streaming stdout */
  onStdout?: (data: string) => void;

  /** Callback for streaming stderr */
  onStderr?: (data: string) => void;

  /** Callback when command starts */
  onStart?: (command: string, id: string) => void;

  /** Callback when command completes */
  onComplete?: (result: ExecutionResult) => void;
}

/**
 * Context provided to approval function
 */
export interface ApprovalContext {
  command: string;
  cwd: string;
  env: Record<string, string>;
  isDangerous: boolean;
  matchedPatterns: string[];
  platform: PlatformInfo;
}

/**
 * Result of command execution
 */
export interface ExecutionResult {
  /** Unique execution ID */
  id: string;

  /** The executed command */
  command: string;

  /** Exit code (0 = success) */
  exitCode: number;

  /** Standard output */
  stdout: string;

  /** Standard error output */
  stderr: string;

  /** Combined stdout + stderr in order received */
  combined: string;

  /** Whether the command succeeded (exitCode === 0) */
  success: boolean;

  /** Execution duration in milliseconds */
  duration: number;

  /** Working directory */
  cwd: string;

  /** Whether output was truncated */
  truncated: boolean;

  /** Signal that killed the process (if any) */
  signal?: string;

  /** Whether the command was approved (if approval was required) */
  approved?: boolean;
}

/**
 * Default dangerous command patterns
 */
const DEFAULT_DANGEROUS_PATTERNS: RegExp[] = [
  // Destructive file operations
  /\brm\s+(-rf?|--recursive|--force)/i,
  /\brmdir\s+/i,
  /\bdel\s+\/[sfq]/i, // Windows del with flags
  /\brd\s+\/s/i, // Windows rmdir

  // System modifications
  /\bsudo\s+/i,
  /\bchmod\s+/i,
  /\bchown\s+/i,
  /\bmkfs\s+/i,
  /\bdd\s+/i,

  // Network operations
  /\bcurl\s+.*(-X\s*(POST|PUT|DELETE)|--data|-d\s)/i,
  /\bwget\s+.*-O\s+/i,

  // Package managers with install
  /\b(npm|yarn|pnpm|bun)\s+(install|add|remove|uninstall)/i,
  /\b(pip|pip3)\s+install/i,
  /\b(apt|apt-get|yum|dnf|pacman)\s+(install|remove|update|upgrade)/i,

  // Git destructive operations
  /\bgit\s+(push|reset\s+--hard|clean\s+-[fd]|checkout\s+--)/i,

  // Database operations
  /\b(DROP|DELETE|TRUNCATE|ALTER)\s+(TABLE|DATABASE|INDEX)/i,

  // Process killing
  /\bkill\s+(-9|-KILL)/i,
  /\btaskkill\s+/i,

  // Registry (Windows)
  /\breg\s+(add|delete)/i,

  // Environment modification
  /\bexport\s+\w+=/,
  /\bsetx?\s+\w+/i,
];

/**
 * Shell Executor - Main class for command execution
 */
export class ShellExecutor {
  private readonly config: Required<
    Omit<ShellConfig, "approvalFn" | "onStdout" | "onStderr" | "onStart" | "onComplete">
  > &
    Pick<ShellConfig, "approvalFn" | "onStdout" | "onStderr" | "onStart" | "onComplete">;
  private readonly history: CommandHistory;
  private readonly platform: PlatformInfo;

  constructor(config: ShellConfig = {}) {
    this.platform = getPlatformInfo();

    this.config = {
      cwd: config.cwd ?? process.cwd(),
      env: { ...process.env, ...config.env } as Record<string, string>,
      timeout: config.timeout ?? 30_000,
      maxOutputSize: config.maxOutputSize ?? 1024 * 1024, // 1MB
      approvalMode: config.approvalMode ?? "dangerous",
      approvalFn: config.approvalFn,
      dangerousPatterns: config.dangerousPatterns ?? DEFAULT_DANGEROUS_PATTERNS,
      trackHistory: config.trackHistory ?? true,
      maxHistoryEntries: config.maxHistoryEntries ?? 1000,
      onStdout: config.onStdout,
      onStderr: config.onStderr,
      onStart: config.onStart,
      onComplete: config.onComplete,
    };

    this.history = new CommandHistory({
      maxEntries: this.config.maxHistoryEntries,
      maxOutputSize: this.config.maxOutputSize,
    });
  }

  /**
   * Check if a command matches dangerous patterns
   */
  private checkDangerous(command: string): {
    isDangerous: boolean;
    matchedPatterns: string[];
  } {
    const matchedPatterns: string[] = [];

    for (const pattern of this.config.dangerousPatterns) {
      if (pattern.test(command)) {
        matchedPatterns.push(pattern.source);
      }
    }

    return {
      isDangerous: matchedPatterns.length > 0,
      matchedPatterns,
    };
  }

  /**
   * Request approval for command execution
   */
  private async requestApproval(command: string, context: ApprovalContext): Promise<boolean> {
    const { approvalMode, approvalFn } = this.config;

    switch (approvalMode) {
      case "never":
        return true;

      case "always":
        if (!approvalFn) {
          throw new PermissionError(command, "Approval required but no approval function provided");
        }
        return approvalFn(command, context);

      case "dangerous":
        if (!context.isDangerous) {
          return true;
        }
        if (!approvalFn) {
          throw new PermissionError(
            command,
            `Dangerous command requires approval: ${context.matchedPatterns.join(", ")}`
          );
        }
        return approvalFn(command, context);

      case "custom":
        if (!approvalFn) {
          throw new PermissionError(command, "Custom approval mode requires approval function");
        }
        return approvalFn(command, context);

      default:
        return true;
    }
  }

  /**
   * Execute a command using Bun's shell
   */
  async execute(
    command: string,
    options: {
      cwd?: string;
      env?: Record<string, string>;
      timeout?: number;
      skipApproval?: boolean;
    } = {}
  ): Promise<ExecutionResult> {
    const cwd = options.cwd ?? this.config.cwd;
    const env = { ...this.config.env, ...options.env };
    const timeout = options.timeout ?? this.config.timeout;

    // Check for dangerous commands
    const { isDangerous, matchedPatterns } = this.checkDangerous(command);

    // Request approval if needed
    if (!options.skipApproval) {
      const context: ApprovalContext = {
        command,
        cwd,
        env,
        isDangerous,
        matchedPatterns,
        platform: this.platform,
      };

      const approved = await this.requestApproval(command, context);
      if (!approved) {
        throw new PermissionError(command, "Command execution not approved", {
          command,
          cwd,
        });
      }
    }

    // Start history tracking
    const historyId = this.config.trackHistory
      ? this.history.start(command, cwd)
      : `exec-${Date.now()}`;

    this.config.onStart?.(command, historyId);

    const startTime = Date.now();
    let stdout = "";
    let stderr = "";
    let combined = "";
    let exitCode = 0;
    let signal: string | undefined;
    let truncated = false;

    try {
      // Detect runtime
      const isBun = typeof process !== "undefined" && !!process.versions && !!process.versions.bun;

      let execPromise: Promise<{
        stdout: string;
        stderr: string;
        exitCode: number;
      }>;

      if (isBun) {
        // Use Bun's shell with proper configuration via dynamic import
        // This prevents Node.js from crashing on the "bun" module import
        execPromise = (async () => {
          const { $ } = await import("bun");
          // Use proper Bun shell template literal syntax
          const proc = $`sh -c ${command}`.cwd(cwd).env(env).quiet();

          const res = await proc;
          return {
            stdout: res.stdout.toString(),
            stderr: res.stderr.toString(),
            exitCode: res.exitCode,
          };
        })();
      } else {
        // Node.js fallback using child_process
        execPromise = new Promise((resolve, reject) => {
          const child = child_process.spawn(command, {
            cwd,
            env,
            shell: true,
            stdio: ["ignore", "pipe", "pipe"],
          });

          const stdoutChunks: Buffer[] = [];
          const stderrChunks: Buffer[] = [];

          child.stdout?.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
          child.stderr?.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

          child.on("error", (err: Error) => reject(err));

          child.on("close", (code: number | null) => {
            resolve({
              stdout: Buffer.concat(stdoutChunks).toString(),
              stderr: Buffer.concat(stderrChunks).toString(),
              exitCode: code ?? 1,
            });
          });
        });
      }

      // Handle timeout
      let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        if (timeout > 0) {
          timeoutHandle = setTimeout(() => {
            reject(new TimeoutError(command, timeout, { command, cwd }));
          }, timeout);
        }
      });

      try {
        // Race between command and timeout
        const result = await Promise.race([execPromise, timeoutPromise]);

        stdout = result.stdout;
        stderr = result.stderr;
        exitCode = result.exitCode;

        // Stream callbacks
        if (stdout && this.config.onStdout) {
          this.config.onStdout(stdout);
        }
        if (stderr && this.config.onStderr) {
          this.config.onStderr(stderr);
        }

        combined = stdout + stderr;

        // Truncate if needed
        if (combined.length > this.config.maxOutputSize) {
          const half = Math.floor(this.config.maxOutputSize / 2);
          combined = `${combined.slice(0, half)}\n\n... [truncated] ...\n\n${combined.slice(-half)}`;
          truncated = true;
        }
      } finally {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }
      }
    } catch (error) {
      if (error instanceof TimeoutError) {
        throw error;
      }
      if (error instanceof ShellError) {
        throw error;
      }

      // Handle Bun shell errors
      const err = error as Error & {
        exitCode?: number;
        stdout?: Buffer;
        stderr?: Buffer;
        signal?: string;
      };

      exitCode = err.exitCode ?? 1;
      stdout = err.stdout?.toString() ?? "";
      stderr = err.stderr?.toString() ?? err.message;
      signal = err.signal;
      combined = stdout + stderr;
    }

    const duration = Date.now() - startTime;
    const success = exitCode === 0;

    // Complete history entry
    if (this.config.trackHistory) {
      this.history.complete(historyId, { exitCode, stdout, stderr });
    }

    const result: ExecutionResult = {
      id: historyId,
      command,
      exitCode,
      stdout,
      stderr,
      combined,
      success,
      duration,
      cwd,
      truncated,
      signal,
      approved: true,
    };

    this.config.onComplete?.(result);

    // Do not throw for non-zero exit codes - return result with full context
    // The caller can decide how to handle failed commands
    return result;
  }

  /**
   * Execute multiple commands in sequence
   */
  async executeSequence(
    commands: string[],
    options: {
      cwd?: string;
      env?: Record<string, string>;
      timeout?: number;
      stopOnError?: boolean;
    } = {}
  ): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];
    const stopOnError = options.stopOnError ?? true;

    for (const command of commands) {
      try {
        const result = await this.execute(command, options);
        results.push(result);
      } catch (error) {
        if (error instanceof ExitError) {
          results.push({
            id: `error-${Date.now()}`,
            command,
            exitCode: error.exitCode,
            stdout: "",
            stderr: error.stderr,
            combined: error.stderr,
            success: false,
            duration: 0,
            cwd: options.cwd ?? this.config.cwd,
            truncated: false,
          });
        }

        if (stopOnError) {
          break;
        }
      }
    }

    return results;
  }

  /**
   * Execute a command and return just the stdout
   */
  async run(command: string, options?: Parameters<typeof this.execute>[1]): Promise<string> {
    const result = await this.execute(command, options);
    return result.stdout.trim();
  }

  /**
   * Check if a command exists on the system
   */
  async commandExists(command: string): Promise<boolean> {
    try {
      if (this.platform.isWindows) {
        await this.execute(`where ${command}`, { skipApproval: true });
      } else {
        await this.execute(`which ${command}`, { skipApproval: true });
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the current working directory
   */
  getCwd(): string {
    return this.config.cwd;
  }

  /**
   * Set the current working directory
   */
  setCwd(cwd: string): void {
    this.config.cwd = cwd;
  }

  /**
   * Get command history
   */
  getHistory(): CommandHistory {
    return this.history;
  }

  /**
   * Get platform information
   */
  getPlatform(): PlatformInfo {
    return this.platform;
  }

  /**
   * Update executor configuration
   */
  configure(updates: Partial<ShellConfig>): void {
    Object.assign(this.config, updates);
  }
}
