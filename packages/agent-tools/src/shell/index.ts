/**
 * Interactive Shell - Session-based command execution
 */

import pc from "picocolors";
import { type ExecutionResult, type ShellConfig, ShellExecutor } from "./executor.js";
import type { CommandHistory } from "./history.js";
import { getPlatformInfo, type PlatformInfo } from "./platform.js";

/**
 * Session state for interactive shell
 */
export interface SessionState {
  id: string;
  cwd: string;
  env: Record<string, string>;
  startTime: Date;
  lastActivity: Date;
  commandCount: number;
  active: boolean;
  data: Record<string, unknown>;
}

/**
 * Interactive shell configuration
 */
export interface InteractiveConfig extends ShellConfig {
  sessionId?: string;
  showPrompts?: boolean;
  promptFormat?: string;
  autoSave?: boolean;
  sessionTimeout?: number;
  onOutputLine?: (line: string, stream: "stdout" | "stderr") => void;
  onSessionChange?: (state: SessionState) => void;
  onPrompt?: (message: string) => Promise<string>;
}

/**
 * Command in the execution queue
 */
interface QueuedCommand {
  command: string;
  resolve: (result: ExecutionResult) => void;
  reject: (error: Error) => void;
  options?: Parameters<ShellExecutor["execute"]>[1];
}

/**
 * Interactive Shell - Stateful command execution with session management
 */
export class InteractiveShell {
  private readonly executor: ShellExecutor;
  private readonly config: InteractiveConfig & {
    sessionId: string;
    showPrompts: boolean;
    promptFormat: string;
    autoSave: boolean;
    sessionTimeout: number;
  };
  private readonly state: SessionState;
  private readonly platform: PlatformInfo;
  private commandQueue: QueuedCommand[] = [];
  private isProcessing = false;

  constructor(config: InteractiveConfig = {}) {
    this.platform = getPlatformInfo();

    this.config = {
      ...config,
      sessionId: config.sessionId ?? this.generateSessionId(),
      showPrompts: config.showPrompts ?? true,
      promptFormat: config.promptFormat ?? "[$cwd] $ ",
      autoSave: config.autoSave ?? false,
      sessionTimeout: config.sessionTimeout ?? 0,
    };

    this.executor = new ShellExecutor({
      cwd: config.cwd ?? process.cwd(),
      env: config.env,
      timeout: config.timeout,
      maxOutputSize: config.maxOutputSize,
      approvalMode: config.approvalMode ?? "dangerous",
      approvalFn: config.approvalFn ?? this.createDefaultApprovalFn(),
      dangerousPatterns: config.dangerousPatterns,
      trackHistory: config.trackHistory ?? true,
      maxHistoryEntries: config.maxHistoryEntries,
      onStdout: (data) => {
        this.handleOutput(data, "stdout");
      },
      onStderr: (data) => {
        this.handleOutput(data, "stderr");
      },
      onStart: config.onStart,
      onComplete: config.onComplete,
    });

    this.state = {
      id: this.config.sessionId,
      cwd: config.cwd ?? process.cwd(),
      env: { ...process.env, ...config.env } as Record<string, string>,
      startTime: new Date(),
      lastActivity: new Date(),
      commandCount: 0,
      active: true,
      data: {},
    };

    this.config.onSessionChange?.(this.state);
  }

  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  private createDefaultApprovalFn(): ShellConfig["approvalFn"] {
    return async (command, context) => {
      if (!this.config.onPrompt) {
        return !context.isDangerous;
      }

      const patterns = context.matchedPatterns.join(", ");
      const message = context.isDangerous
        ? pc.yellow(`⚠️  Dangerous command detected (${patterns}):\n`) +
          pc.white(`   ${command}\n`) +
          pc.gray("   Approve? [y/N]: ")
        : pc.cyan("Execute command:\n") +
          pc.white(`   ${command}\n`) +
          pc.gray("   Approve? [Y/n]: ");

      const response = await this.config.onPrompt(message);
      const normalized = response.trim().toLowerCase();

      if (context.isDangerous) {
        return normalized === "y" || normalized === "yes";
      }
      return normalized !== "n" && normalized !== "no";
    };
  }

  private handleOutput(data: string, stream: "stdout" | "stderr"): void {
    this.config.onOutputLine?.(data, stream);
  }

  getPrompt(): string {
    if (!this.config.showPrompts) {
      return "";
    }

    return this.config.promptFormat
      .replace("$cwd", this.state.cwd)
      .replace("$user", process.env.USER || process.env.USERNAME || "user")
      .replace("$host", process.env.HOSTNAME || "localhost")
      .replace("$session", this.state.id.slice(-8));
  }

  async exec(
    command: string,
    options?: Parameters<ShellExecutor["execute"]>[1]
  ): Promise<ExecutionResult> {
    this.updateActivity();

    const builtinResult = await this.handleBuiltins(command);
    if (builtinResult) {
      return builtinResult;
    }
    const result = await this.executor.execute(command, {
      cwd: this.state.cwd,
      env: this.state.env,
      ...options,
    });

    this.state.commandCount++;

    if (command.trim().startsWith("cd ")) {
      await this.updateCwd();
    }

    this.config.onSessionChange?.(this.state);
    return result;
  }

  enqueue(
    command: string,
    options?: Parameters<ShellExecutor["execute"]>[1]
  ): Promise<ExecutionResult> {
    return new Promise((resolve, reject) => {
      this.commandQueue.push({ command, resolve, reject, options });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.commandQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.commandQueue.length > 0) {
      const { command, resolve, reject, options } = this.commandQueue.shift()!;

      try {
        const result = await this.exec(command, options);
        resolve(result);
      } catch (error) {
        reject(error as Error);
      }
    }

    this.isProcessing = false;
  }

  private async handleBuiltins(command: string): Promise<ExecutionResult | null> {
    const trimmed = command.trim();
    const parts = trimmed.split(/\s+/);
    const cmd = parts[0]?.toLowerCase() ?? "";
    const args = parts.slice(1);

    const createResult = (stdout: string): ExecutionResult => ({
      id: `builtin-${Date.now()}`,
      command: trimmed,
      exitCode: 0,
      stdout,
      stderr: "",
      combined: stdout,
      success: true,
      duration: 0,
      cwd: this.state.cwd,
      truncated: false,
    });

    switch (cmd) {
      case "cd": {
        const target = args[0] || this.platform.homeDir;
        return this.changeDirectory(target);
      }

      case "pwd": {
        return createResult(`${this.state.cwd}\n`);
      }

      case "export": {
        if (args.length === 0) {
          const envStr = Object.entries(this.state.env)
            .map(([k, v]) => `${k}=${v}`)
            .join("\n");
          return createResult(`${envStr}\n`);
        }

        for (const arg of args) {
          const [key, ...valueParts] = arg.split("=");
          if (key && valueParts.length > 0) {
            this.state.env[key] = valueParts.join("=");
          }
        }
        return createResult("");
      }

      case "unset": {
        for (const key of args) {
          delete this.state.env[key];
        }
        return createResult("");
      }

      case "history": {
        const count = Number.parseInt(args[0] ?? "", 10) || 20;
        const entries = this.executor.getHistory().getLast(count);
        const output = entries.map((e, i) => `${i + 1}  ${e.command}`).join("\n");
        return createResult(`${output}\n`);
      }

      case "clear":
      case "cls": {
        return createResult("\x1b[2J\x1b[H");
      }

      case "exit":
      case "quit": {
        this.close();
        return createResult("Session closed.\n");
      }

      default:
        return null;
    }
  }

  async changeDirectory(target: string): Promise<ExecutionResult> {
    const startCwd = this.state.cwd;

    try {
      if (target === "-") {
        target = (this.state.data.previousCwd as string) || this.state.cwd;
      } else if (target === "~" || target === "") {
        target = this.platform.homeDir;
      }

      const newCwd =
        target.startsWith("/") || target.match(/^[A-Za-z]:/)
          ? target
          : await this.executor.run(`cd "${target}" && pwd`, {
              cwd: this.state.cwd,
            });

      await this.executor.execute(`test -d "${newCwd.trim()}"`, {
        cwd: this.state.cwd,
        skipApproval: true,
      });

      this.state.data.previousCwd = startCwd;
      this.state.cwd = newCwd.trim();
      this.executor.setCwd(this.state.cwd);

      this.config.onSessionChange?.(this.state);

      return {
        id: `cd-${Date.now()}`,
        command: `cd ${target}`,
        exitCode: 0,
        stdout: "",
        stderr: "",
        combined: "",
        success: true,
        duration: 0,
        cwd: this.state.cwd,
        truncated: false,
      };
    } catch {
      return {
        id: `cd-${Date.now()}`,
        command: `cd ${target}`,
        exitCode: 1,
        stdout: "",
        stderr: `cd: ${target}: No such file or directory\n`,
        combined: `cd: ${target}: No such file or directory\n`,
        success: false,
        duration: 0,
        cwd: this.state.cwd,
        truncated: false,
      };
    }
  }

  private async updateCwd(): Promise<void> {
    try {
      const pwd = await this.executor.run("pwd", {
        cwd: this.state.cwd,
        skipApproval: true,
      });
      this.state.cwd = pwd.trim();
      this.executor.setCwd(this.state.cwd);
    } catch {
      // Ignore
    }
  }

  private updateActivity(): void {
    this.state.lastActivity = new Date();
  }

  async execMany(
    commands: string[],
    options?: { stopOnError?: boolean }
  ): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];
    const stopOnError = options?.stopOnError ?? true;

    for (const command of commands) {
      try {
        const result = await this.exec(command);
        results.push(result);
      } catch (error) {
        if (stopOnError) {
          throw error;
        }
        results.push({
          id: `error-${Date.now()}`,
          command,
          exitCode: 1,
          stdout: "",
          stderr: (error as Error).message,
          combined: (error as Error).message,
          success: false,
          duration: 0,
          cwd: this.state.cwd,
          truncated: false,
        });
      }
    }

    return results;
  }

  getState(): Readonly<SessionState> {
    return { ...this.state };
  }

  getHistory(): CommandHistory {
    return this.executor.getHistory();
  }

  getPlatform(): PlatformInfo {
    return this.platform;
  }

  setData<T = unknown>(key: string, value: T): void {
    this.state.data[key] = value;
  }

  getData<T = unknown>(key: string): T | undefined {
    return this.state.data[key] as T | undefined;
  }

  isActive(): boolean {
    if (!this.state.active) {
      return false;
    }

    if (this.config.sessionTimeout > 0) {
      const elapsed = Date.now() - this.state.lastActivity.getTime();
      if (elapsed > this.config.sessionTimeout) {
        this.state.active = false;
        return false;
      }
    }

    return true;
  }

  close(): void {
    this.state.active = false;
    this.commandQueue = [];
    this.config.onSessionChange?.(this.state);
  }

  toJSON(): string {
    return JSON.stringify({
      state: this.state,
      history: this.executor.getHistory().toJSON(),
    });
  }

  static fromJSON(json: string, config: InteractiveConfig = {}): InteractiveShell {
    const { state, history } = JSON.parse(json);

    const shell = new InteractiveShell({
      ...config,
      sessionId: state.id,
      cwd: state.cwd,
      env: state.env,
    });

    (shell as unknown as { state: SessionState }).state = {
      ...state,
      startTime: new Date(state.startTime),
      lastActivity: new Date(state.lastActivity),
    };

    if (history) {
      shell.executor.getHistory().fromJSON(history);
    }

    return shell;
  }
}
