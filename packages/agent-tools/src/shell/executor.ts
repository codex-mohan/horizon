/**
 * Shell Executor - Core command execution engine using Bun's shell
 *
 * Bun's shell ($`command`) is a cross-platform bash-like implementation:
 * - Built-in Unix commands work on all platforms (ls, cat, rm, mkdir, grep, etc.)
 * - Safe interpolation - variables are auto-escaped
 * - Pipe and redirection support
 * - Environment variable and working directory control
 */

import { $ } from "bun";
import { ExitError, PermissionError, ShellError, TimeoutError } from "./errors.js";
import { CommandHistory } from "./history.js";
import { getPlatformInfo, type PlatformInfo } from "./platform.js";

export type ApprovalMode = "always" | "never" | "dangerous" | "custom";

export interface ShellConfig {
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
  maxOutputSize?: number;
  approvalMode?: ApprovalMode;
  approvalFn?: (command: string, context: ApprovalContext) => Promise<boolean>;
  dangerousPatterns?: RegExp[];
  trackHistory?: boolean;
  maxHistoryEntries?: number;
  onStdout?: (data: string) => void;
  onStderr?: (data: string) => void;
  onStart?: (command: string, id: string) => void;
  onComplete?: (result: ExecutionResult) => void;
}

export interface ApprovalContext {
  command: string;
  cwd: string;
  env: Record<string, string>;
  isDangerous: boolean;
  matchedPatterns: string[];
  platform: PlatformInfo;
}

export interface ExecutionResult {
  id: string;
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  combined: string;
  success: boolean;
  duration: number;
  cwd: string;
  truncated: boolean;
  signal?: string;
  approved?: boolean;
}

const DEFAULT_DANGEROUS_PATTERNS: RegExp[] = [
  /\brm\s+(-rf?|--recursive|--force)/i,
  /\brmdir\s+/i,
  /\bsudo\s+/i,
  /\bchmod\s+/i,
  /\bchown\s+/i,
  /\bmkfs\s+/i,
  /\bdd\s+/i,
  /\bcurl\s+.*(-X\s*(POST|PUT|DELETE)|--data|-d\s)/i,
  /\bwget\s+.*-O\s+/i,
  /\b(npm|yarn|pnpm|bun)\s+(install|add|remove|uninstall)/i,
  /\b(pip|pip3)\s+install/i,
  /\b(apt|apt-get|yum|dnf|pacman)\s+(install|remove|update|upgrade)/i,
  /\bgit\s+(push|reset\s+--hard|clean\s+-[fd]|checkout\s+--)/i,
  /\b(DROP|DELETE|TRUNCATE|ALTER)\s+(TABLE|DATABASE|INDEX)/i,
  /\bkill\s+(-9|-KILL)/i,
  /\breg\s+(add|delete)/i,
];

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
      maxOutputSize: config.maxOutputSize ?? 1024 * 1024,
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

    const { isDangerous, matchedPatterns } = this.checkDangerous(command);

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

    const historyId = this.config.trackHistory
      ? this.history.start(command, cwd)
      : `exec-${Date.now()}`;

    this.config.onStart?.(command, historyId);

    const startTime = Date.now();
    let stdout = "";
    let stderr = "";
    let exitCode = 0;

    try {
      let result: {
        stdout: { toString(): string };
        stderr: { toString(): string };
        exitCode: number;
      };

      if (this.platform.isWindows) {
        result = await $`${{ raw: command }}`.cwd(cwd).env(env);
      } else {
        result = await $`${{ raw: command }}`.cwd(cwd).env(env);
      }

      stdout = result.stdout.toString();
      stderr = result.stderr.toString();
      exitCode = result.exitCode;

      if (stdout && this.config.onStdout) {
        this.config.onStdout(stdout);
      }
      if (stderr && this.config.onStderr) {
        this.config.onStderr(stderr);
      }
    } catch (error) {
      if (error instanceof TimeoutError) {
        throw error;
      }
      if (error instanceof ShellError) {
        throw error;
      }

      const err = error as { exitCode?: number; stderr?: { toString(): string }; message: string };
      exitCode = err.exitCode ?? 1;
      stderr = err.stderr?.toString() ?? err.message;
    }

    let combined = stdout + stderr;
    let truncated = false;

    if (combined.length > this.config.maxOutputSize) {
      const half = Math.floor(this.config.maxOutputSize / 2);
      combined = `${combined.slice(0, half)}\n\n... [truncated] ...\n\n${combined.slice(-half)}`;
      truncated = true;
    }

    const duration = Date.now() - startTime;
    const success = exitCode === 0;

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
      approved: true,
    };

    this.config.onComplete?.(result);

    return result;
  }

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

  async run(command: string, options?: Parameters<typeof this.execute>[1]): Promise<string> {
    const result = await this.execute(command, options);
    return result.stdout.trim();
  }

  async commandExists(command: string): Promise<boolean> {
    try {
      await this.execute(`command -v ${command}`, { skipApproval: true });
      return true;
    } catch {
      return false;
    }
  }

  getCwd(): string {
    return this.config.cwd;
  }

  setCwd(cwd: string): void {
    this.config.cwd = cwd;
  }

  getHistory(): CommandHistory {
    return this.history;
  }

  getPlatform(): PlatformInfo {
    return this.platform;
  }

  configure(updates: Partial<ShellConfig>): void {
    Object.assign(this.config, updates);
  }
}
