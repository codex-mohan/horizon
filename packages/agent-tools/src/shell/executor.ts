/**
 * Shell Executor - Core command execution engine with dual shell support
 *
 * Supports two execution modes:
 * - Bun shell: Uses Bun's $`command` for advanced shell features
 * - Node spawn: Uses child_process.spawn for compatibility with Node.js environments
 *
 * When running under LangGraph CLI (Node.js), Node spawn is automatically used
 * to avoid conflicts with Bun's runtime.
 */

import { spawn as nodeSpawn } from "node:child_process";
import { ExitError, PermissionError, ShellError, TimeoutError } from "./errors.js";
import { CommandHistory } from "./history.js";
import { getPlatformInfo, type PlatformInfo } from "./platform.js";

let bunAvailable = false;
let bunImport: typeof import("bun") | null = null;

async function tryImportBun(): Promise<boolean> {
  if (bunAvailable) return true;
  try {
    bunImport = await import("bun");
    bunAvailable = true;
    return true;
  } catch {
    bunAvailable = false;
    return false;
  }
}

function isNodeEnvironment(): boolean {
  return (
    process.env.LANGGRAPH_CLI === "true" ||
    process.env.USING_LANGGRAPH_CLI === "true" ||
    process.env.NODE_ENV === "test" ||
    !bunAvailable
  );
}

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
  useBunShell?: boolean;
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
    Omit<
      ShellConfig,
      "approvalFn" | "onStdout" | "onStderr" | "onStart" | "onComplete" | "useBunShell"
    >
  > &
    Pick<
      ShellConfig,
      "approvalFn" | "onStdout" | "onStderr" | "onStart" | "onComplete" | "useBunShell"
    >;
  private readonly history: CommandHistory;
  private readonly platform: PlatformInfo;
  private readonly useBun: boolean;

  constructor(config: ShellConfig = {}) {
    this.platform = getPlatformInfo();

    const shouldUseBun = config.useBunShell ?? !isNodeEnvironment();
    if (shouldUseBun) {
      tryImportBun().then((available) => {
        if (!available) {
          console.warn("[ShellExecutor] Bun not available, falling back to Node spawn");
        }
      });
    }

    this.useBun = shouldUseBun && bunAvailable;

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

  private async executeWithBun(
    command: string,
    cwd: string,
    env: Record<string, string>
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    if (!bunImport) {
      throw new Error("Bun shell not available");
    }

    const $ = bunImport.$;
    const result = await $`${{ raw: command }}`.cwd(cwd).env(env);

    return {
      stdout: result.stdout.toString(),
      stderr: result.stderr.toString(),
      exitCode: result.exitCode,
    };
  }

  private async executeWithNodeSpawn(
    command: string,
    cwd: string,
    env: Record<string, string>,
    timeout: number
  ): Promise<{ stdout: string; stderr: string; exitCode: number; signal?: string }> {
    return new Promise((resolve, reject) => {
      const isWindows = this.platform.isWindows;
      const shell = isWindows ? "cmd.exe" : "/bin/sh";
      const shellArgs = isWindows ? ["/c", command] : ["-c", command];

      let stdout = "";
      let stderr = "";
      let killed = false;

      const child = nodeSpawn(shell, shellArgs, {
        cwd,
        env,
        stdio: ["ignore", "pipe", "pipe"],
      });

      const timer = setTimeout(() => {
        killed = true;
        child.kill("SIGTERM");
      }, timeout);

      child.stdout?.on("data", (data: Buffer) => {
        const str = data.toString();
        if (stdout.length + str.length <= this.config.maxOutputSize) {
          stdout += str;
        }
        if (this.config.onStdout) {
          this.config.onStdout(str);
        }
      });

      child.stderr?.on("data", (data: Buffer) => {
        const str = data.toString();
        if (stderr.length + str.length <= this.config.maxOutputSize) {
          stderr += str;
        }
        if (this.config.onStderr) {
          this.config.onStderr(str);
        }
      });

      child.on("close", (code, signal) => {
        clearTimeout(timer);
        resolve({
          stdout,
          stderr,
          exitCode: killed ? 124 : (code ?? 0),
          signal: killed ? "SIGTERM" : (signal ?? undefined),
        });
      });

      child.on("error", (err) => {
        clearTimeout(timer);
        reject(new ShellError(err.message, { command, cwd }));
      });
    });
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
    let signal: string | undefined;

    try {
      let result: { stdout: string; stderr: string; exitCode: number; signal?: string };

      if (this.useBun) {
        result = await this.executeWithBun(command, cwd, env);
      } else {
        result = await this.executeWithNodeSpawn(command, cwd, env, timeout);
      }

      stdout = result.stdout;
      stderr = result.stderr;
      exitCode = result.exitCode;
      signal = result.signal;
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
      signal,
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

  isUsingBunShell(): boolean {
    return this.useBun;
  }
}
