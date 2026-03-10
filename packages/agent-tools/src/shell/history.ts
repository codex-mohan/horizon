/**
 * Command history tracking
 */

export interface HistoryEntry {
  id: string;
  command: string;
  cwd: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  success: boolean;
  truncated: boolean;
}

/**
 * Command history manager for tracking executed commands
 */
export class CommandHistory {
  private entries: HistoryEntry[] = [];
  private readonly maxEntries: number;
  private readonly maxOutputSize: number;

  constructor(options: { maxEntries?: number; maxOutputSize?: number } = {}) {
    this.maxEntries = options.maxEntries ?? 1000;
    this.maxOutputSize = options.maxOutputSize ?? 10_000;
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  private truncateOutput(output: string): { text: string; truncated: boolean } {
    if (output.length <= this.maxOutputSize) {
      return { text: output, truncated: false };
    }

    const half = Math.floor(this.maxOutputSize / 2);
    const truncated = `${output.slice(0, half)}\n\n... [${output.length - this.maxOutputSize} characters truncated] ...\n\n${output.slice(-half)}`;

    return { text: truncated, truncated: true };
  }

  start(command: string, cwd: string): string {
    const id = this.generateId();

    const entry: HistoryEntry = {
      id,
      command,
      cwd,
      startTime: new Date(),
      success: false,
      truncated: false,
    };

    this.entries.push(entry);

    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }

    return id;
  }

  complete(
    id: string,
    result: {
      exitCode: number;
      stdout?: string;
      stderr?: string;
    }
  ): HistoryEntry | undefined {
    const entry = this.entries.find((e) => e.id === id);
    if (!entry) {
      return undefined;
    }

    entry.endTime = new Date();
    entry.duration = entry.endTime.getTime() - entry.startTime.getTime();
    entry.exitCode = result.exitCode;
    entry.success = result.exitCode === 0;

    if (result.stdout) {
      const { text, truncated } = this.truncateOutput(result.stdout);
      entry.stdout = text;
      entry.truncated = entry.truncated || truncated;
    }

    if (result.stderr) {
      const { text, truncated } = this.truncateOutput(result.stderr);
      entry.stderr = text;
      entry.truncated = entry.truncated || truncated;
    }

    return entry;
  }

  getAll(): HistoryEntry[] {
    return [...this.entries];
  }

  getLast(count: number): HistoryEntry[] {
    return this.entries.slice(-count);
  }

  get(id: string): HistoryEntry | undefined {
    return this.entries.find((e) => e.id === id);
  }

  search(pattern: string | RegExp): HistoryEntry[] {
    const regex = typeof pattern === "string" ? new RegExp(pattern, "i") : pattern;
    return this.entries.filter((e) => regex.test(e.command));
  }

  clear(): void {
    this.entries = [];
  }

  getStats(): {
    total: number;
    successful: number;
    failed: number;
    averageDuration: number;
  } {
    const completed = this.entries.filter((e) => e.duration !== undefined);

    return {
      total: this.entries.length,
      successful: this.entries.filter((e) => e.success).length,
      failed: this.entries.filter((e) => !e.success && e.exitCode !== undefined).length,
      averageDuration:
        completed.length > 0
          ? completed.reduce((sum, e) => sum + (e.duration ?? 0), 0) / completed.length
          : 0,
    };
  }

  toJSON(): string {
    return JSON.stringify(this.entries, null, 2);
  }

  fromJSON(json: string): void {
    const parsed = JSON.parse(json) as HistoryEntry[];
    this.entries = parsed.map((e) => ({
      ...e,
      startTime: new Date(e.startTime),
      endTime: e.endTime ? new Date(e.endTime) : undefined,
    }));
  }
}
