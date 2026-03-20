/**
 * Logger module for Horizon - provides structured logging with different log levels,
 * contextual prefixes, emoji indicators, stylish formatting, and useful utilities
 * for easy debugging and tracing across the entire application.
 */

import picocolors from "picocolors";

/** Log levels in order of severity */
export enum LogLevel {
  TRACE = -1,
  DEBUG = 0,
  INFO = 1,
  SUCCESS = 2,
  WARN = 3,
  ERROR = 4,
  FATAL = 5,
}

const LEVEL_META: Record<
  LogLevel,
  { emoji: string; label: string; color: (s: string) => string; isError: boolean }
> = {
  [LogLevel.TRACE]: { emoji: "", label: "TRACE", color: picocolors.gray, isError: false },
  [LogLevel.DEBUG]: { emoji: "", label: "DEBUG", color: picocolors.gray, isError: false },
  [LogLevel.INFO]: { emoji: "ℹ", label: "INFO", color: picocolors.blue, isError: false },
  [LogLevel.SUCCESS]: { emoji: "✔", label: "OK", color: picocolors.green, isError: false },
  [LogLevel.WARN]: { emoji: "⚠", label: "WARN", color: picocolors.yellow, isError: false },
  [LogLevel.ERROR]: { emoji: "✘", label: "ERROR", color: picocolors.red, isError: true },
  [LogLevel.FATAL]: {
    emoji: "☠",
    label: "FATAL",
    color: (s: string) => picocolors.bgRed(picocolors.white(picocolors.bold(s))),
    isError: true,
  },
};

/** Output format modes */
export type FormatMode = "fancy" | "simple" | "quiet";

/** Configuration options for the logger */
export interface LoggerOptions {
  /** Minimum log level to output (default: INFO) */
  minLevel?: LogLevel;
  /** Whether to include timestamps (default: true) */
  timestamps?: boolean;
  /** Whether to colorize output (default: true, false in CI) */
  colors?: boolean;
  /** Custom prefix for all log messages */
  prefix?: string;
  /** Output format mode */
  format?: FormatMode;
  /** Whether to show caller file:line (default: false) */
  showCaller?: boolean;
  /** Whether to include a trailing newline after each log (default: true) */
  trailingNewline?: boolean;
}

/** Default logger options */
const DEFAULT_OPTIONS: Required<LoggerOptions> = {
  minLevel: LogLevel.INFO,
  timestamps: true,
  colors: true,
  prefix: "",
  format: isCI() ? "simple" : "fancy",
  showCaller: false,
  trailingNewline: true,
};

/** Detect CI environment */
function isCI(): boolean {
  return (
    process.env.CI === "true" ||
    process.env.TERM_PROGRAM === "vscode" ||
    process.env.NODE_ENV === "test"
  );
}

/** Logger interface */
export interface Logger {
  trace(message: string, data?: DataArg): void;
  debug(message: string, data?: DataArg): void;
  info(message: string, data?: DataArg): void;
  success(message: string, data?: DataArg): void;
  warn(message: string, data?: DataArg): void;
  error(message: string, error?: ErrorArg): void;
  fatal(message: string, error?: ErrorArg): void;
  box(message: string, title?: string): void;
  spinner(text: string): SpinnerInstance;
  table(data: Record<string, unknown>[]): void;
  setLevel(level: LogLevel): void;
  getLevel(): LogLevel;
  withPrefix(prefix: string): Logger;
  withTag(tag: string): Logger;
}

/** Union type for log data arguments */
export type DataArg = Record<string, unknown> | undefined;

/** Union type for error arguments */
export type ErrorArg = Error | DataArg | undefined;

/** Spinner instance returned by spinner() */
export interface SpinnerInstance {
  text: (msg: string) => void;
  success: (msg?: string) => void;
  fail: (msg?: string) => void;
  warn: (msg?: string) => void;
  stop: () => void;
}

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

/**
 * Creates a logger instance with the given context and options.
 *
 * @example
 * const logger = createLogger("Agent");
 * logger.info("Starting agent...");
 * logger.debug({ state: "initializing" });
 * logger.success("Connected to server");
 * logger.error("Failed to connect", new Error("Connection refused"));
 * logger.box("Deployment complete", "Summary");
 *
 * // With prefix
 * const apiLogger = logger.withPrefix("API");
 * apiLogger.info("GET /users/123");
 *
 * // Spinner
 * const spin = logger.spinner("Loading...");
 * spin.success("Done!");
 */
export function createLogger(context: string, options: LoggerOptions = {}): Logger {
  const config = { ...DEFAULT_OPTIONS, ...options };

  if (options.colors === undefined && isCI()) {
    config.colors = false;
  }

  return {
    trace(message: string, data?: DataArg): void {
      log(LogLevel.TRACE, context, message, data, config);
    },

    debug(message: string, data?: DataArg): void {
      log(LogLevel.DEBUG, context, message, data, config);
    },

    info(message: string, data?: DataArg): void {
      log(LogLevel.INFO, context, message, data, config);
    },

    success(message: string, data?: DataArg): void {
      log(LogLevel.SUCCESS, context, message, data, config);
    },

    warn(message: string, data?: DataArg): void {
      log(LogLevel.WARN, context, message, data, config);
    },

    error(message: string, error?: ErrorArg): void {
      log(LogLevel.ERROR, context, message, extractErrorData(error), config);
    },

    fatal(message: string, error?: ErrorArg): void {
      log(LogLevel.FATAL, context, message, extractErrorData(error), config);
    },

    box(message: string, title?: string): void {
      printBox(context, message, title, config);
    },

    spinner(text: string): SpinnerInstance {
      return createSpinner(context, text, config);
    },

    table(data: Record<string, unknown>[]): void {
      printTable(context, data, config);
    },

    setLevel(level: LogLevel): void {
      config.minLevel = level;
    },

    getLevel(): LogLevel {
      return config.minLevel;
    },

    withPrefix(prefix: string): Logger {
      return createLogger(context, {
        ...config,
        prefix: config.prefix ? `${config.prefix} ${prefix}` : prefix,
      });
    },

    withTag(tag: string): Logger {
      return createLogger(context, {
        ...config,
        prefix: config.prefix ? `${config.prefix} ${tag}` : tag,
      });
    },
  };
}

function extractErrorData(error?: ErrorArg): Record<string, unknown> | undefined {
  if (!error) return undefined;
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
    };
  }
  return error;
}

function log(
  level: LogLevel,
  context: string,
  message: string,
  data: Record<string, unknown> | undefined,
  config: Required<LoggerOptions>
): void {
  if (level < config.minLevel) return;

  const { colors, timestamps, prefix, format, trailingNewline } = config;
  const meta = LEVEL_META[level];
  const printFn = meta.isError ? console.error : console.log;
  const end = trailingNewline ? "\n" : "";

  if (format === "quiet") {
    if (data && Object.keys(data).length > 0) {
      printFn(JSON.stringify({ level: meta.label, context, message, ...data }) + end);
    } else {
      printFn(message + end);
    }
    return;
  }

  if (format === "simple") {
    const ts = timestamps ? `[${formatTimestamp(new Date())}] ` : "";
    const prefixStr = prefix ? `[${prefix}] ` : "";
    const levelStr = `[${meta.label}] `;
    const ctxStr = `[${context}] `;
    let line = `${ts}${prefixStr}${levelStr}${ctxStr}${message}`;
    if (meta.emoji) line = `${meta.emoji} ${line}`;
    printFn(line + end);
    if (data && Object.keys(data).length > 0) {
      printFn(JSON.stringify(data, null, 2));
    }
    return;
  }

  // Fancy format
  const ts = timestamps ? `${picocolors.gray(formatTimestamp(new Date()))} ` : "";
  const levelBadge = colors ? ` ${meta.color(`[${meta.label}]`)} ` : ` [${meta.label}] `;
  const emoji = meta.emoji ? ` ${meta.emoji}` : "";
  const ctxStr = colors ? picocolors.cyan(`[${context}]`) : `[${context}]`;
  const prefixStr = prefix
    ? colors
      ? ` ${picocolors.magenta(`[${prefix}]`)}`
      : ` [${prefix}]`
    : "";
  const msgStr = colors ? meta.color(message) : message;
  const callerStr = config.showCaller ? ` ${picocolors.gray(getCallerLocation())}` : "";

  printFn(`${ts}${levelBadge}${emoji} ${ctxStr}${prefixStr} ${msgStr}${callerStr}${end}`);

  if (data && Object.keys(data).length > 0) {
    const dataStr = colors
      ? picocolors.gray(JSON.stringify(data, null, 2))
      : JSON.stringify(data, null, 2);
    printFn(`${dataStr}\n`);
  }
}

function formatTimestamp(date: Date): string {
  const h = date.getHours().toString().padStart(2, "0");
  const m = date.getMinutes().toString().padStart(2, "0");
  const s = date.getSeconds().toString().padStart(2, "0");
  const ms = date.getMilliseconds().toString().padStart(3, "0");
  return `${h}:${m}:${s}.${ms}`;
}

function getCallerLocation(): string {
  const stack = new Error().stack;
  if (!stack) return "";
  const lines = stack.split("\n").slice(4);
  for (const line of lines) {
    const match = line.match(/at\s+(.+)\s+\((.+):(\d+):(\d+)\)/);
    if (match) {
      return `${match[2]}:${match[3]}`;
    }
  }
  return "";
}

function printBox(
  context: string,
  message: string,
  title: string | undefined,
  config: Required<LoggerOptions>
): void {
  if (config.minLevel > LogLevel.INFO) return;

  const { colors, prefix } = config;
  const width = 60;
  const lines = wrapText(message, width - 4);
  const header = title
    ? colors
      ? picocolors.bold(picocolors.cyan(` ${title} `))
      : ` ${title} `
    : colors
      ? picocolors.bold(picocolors.cyan(` ${context}${prefix ? ` [${prefix}]` : ""} `))
      : ` ${context}${prefix ? ` [${prefix}]` : ""} `;
  const headerLine = colors ? `┌${picocolors.cyan("═".repeat(width))}┐` : `┌${"═".repeat(width)}┐`;
  const footerLine = colors ? `└${picocolors.cyan("═".repeat(width))}┘` : `└${"═".repeat(width)}┘`;
  const midLine = colors ? `├${picocolors.cyan("═".repeat(width))}┤` : `├${"═".repeat(width)}┤`;
  const sep = colors ? picocolors.cyan("│") : "│";
  const blankLine = `${sep}${" ".repeat(width)}${sep}`;

  const titlePad = width - header.length + 1;
  const titleLine = `${sep}${header}${" ".repeat(Math.max(0, titlePad))}${sep}`;

  const linesOut: string[] = [headerLine, blankLine, titleLine, blankLine, midLine];

  for (const line of lines) {
    const content = ` ${line}${" ".repeat(Math.max(0, width - line.length - 1))}`;
    linesOut.push(`${sep}${content}${sep}`);
  }

  linesOut.push(blankLine);
  linesOut.push(footerLine);

  console.log(`${linesOut.join("\n")}\n`);
}

function wrapText(text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if ((current + word).length <= maxWidth) {
      current += (current ? " " : "") + word;
    } else {
      if (current) lines.push(current);
      current = word.length > maxWidth ? word.slice(0, maxWidth) : word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function createSpinner(
  context: string,
  initialText: string,
  config: Required<LoggerOptions>
): SpinnerInstance {
  let current = initialText;
  let frameIndex = 0;
  let active = true;
  let intervalId: ReturnType<typeof setInterval> | null = null;

  function stop(): void {
    active = false;
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  function render(text: string): void {
    if (!active || config.minLevel > LogLevel.INFO) return;
    const frame = SPINNER_FRAMES[frameIndex % SPINNER_FRAMES.length];
    const spinnerPart = config.colors ? picocolors.cyan(frame) : frame;
    const ctxPart = config.colors ? picocolors.cyan(`[${context}]`) : `[${context}]`;
    const msgPart = config.colors ? picocolors.white(text) : text;
    process.stdout.write(`\r${spinnerPart} ${ctxPart} ${msgPart}  `);
  }

  intervalId = setInterval(() => {
    frameIndex++;
    render(current);
  }, 80);

  return {
    text(msg: string): void {
      current = msg;
      render(current);
    },
    success(msg?: string): void {
      stop();
      if (config.minLevel > LogLevel.INFO) return;
      const check = config.colors ? picocolors.green("✔") : "✔";
      const ctxPart = config.colors ? picocolors.cyan(`[${context}]`) : `[${context}]`;
      const msgPart = config.colors ? picocolors.green(msg ?? current) : (msg ?? current);
      console.log(`\n${check} ${ctxPart} ${msgPart}`);
    },
    fail(msg?: string): void {
      stop();
      if (config.minLevel > LogLevel.INFO) return;
      const cross = config.colors ? picocolors.red("✘") : "✘";
      const ctxPart = config.colors ? picocolors.cyan(`[${context}]`) : `[${context}]`;
      const msgPart = config.colors ? picocolors.red(msg ?? current) : (msg ?? current);
      console.error(`\n${cross} ${ctxPart} ${msgPart}`);
    },
    warn(msg?: string): void {
      stop();
      if (config.minLevel > LogLevel.INFO) return;
      const warnEmoji = config.colors ? picocolors.yellow("⚠") : "⚠";
      const ctxPart = config.colors ? picocolors.cyan(`[${context}]`) : `[${context}]`;
      const msgPart = config.colors ? picocolors.yellow(msg ?? current) : (msg ?? current);
      console.log(`\n${warnEmoji} ${ctxPart} ${msgPart}`);
    },
    stop,
  };
}

function printTable(
  context: string,
  data: Record<string, unknown>[],
  config: Required<LoggerOptions>
): void {
  if (config.minLevel > LogLevel.INFO || data.length === 0) return;

  const { colors } = config;
  const keys = Object.keys(data[0]);
  const colWidths: Record<string, number> = {};

  for (const key of keys) {
    const maxVal = Math.max(key.length, ...data.map((row) => String(row[key] ?? "").length));
    colWidths[key] = Math.min(maxVal, 30);
  }

  const totalWidth = Object.values(colWidths).reduce((a, b) => a + b + 3, 0) + 1;
  const border = colors
    ? picocolors.gray("─".repeat(Math.min(totalWidth, 120)))
    : "─".repeat(Math.min(totalWidth, 120));

  const printFn = console.log;
  const ctxPart = colors ? picocolors.cyan(`[${context}]`) : `[${context}]`;

  printFn(`\n${ctxPart} ${border}`);

  const header = keys
    .map((k) => {
      const cell = k.padEnd(colWidths[k]);
      return colors ? picocolors.bold(picocolors.white(cell)) : cell;
    })
    .join(" │ ");
  printFn(`  ${header} `);
  printFn(colors ? picocolors.gray("─".repeat(header.length + 4)) : "─".repeat(header.length + 4));

  for (const row of data) {
    const line = keys
      .map((k) => {
        const raw = String(row[k] ?? "");
        const cell =
          raw.length > colWidths[k]
            ? `${raw.slice(0, colWidths[k] - 3)}...`
            : raw.padEnd(colWidths[k]);
        return colors ? picocolors.white(cell) : cell;
      })
      .join(" │ ");
    printFn(`  ${line} `);
  }

  printFn(`${border}\n`);
}

/**
 * Creates a child logger that inherits the parent logger's configuration
 * but has a different context name (appended with a colon separator).
 *
 * @example
 * const parent = createLogger("Agent");
 * const child = childLogger(parent, "Memory");
 * child.info("Retrieving memories"); // Outputs with "Agent:Memory" context
 */
export function childLogger(parent: Logger, childContext: string): Logger {
  return parent.withTag(childContext);
}

/**
 * Create a logger that writes to a file (via a callback) instead of console.
 * Useful for production environments where you want to integrate with
 * external logging services or file rotation.
 */
export function createFileLogger(
  _context: string,
  writeFn: (level: LogLevel, message: string, data?: Record<string, unknown>) => void,
  options: LoggerOptions = {}
): Logger {
  const base = createLogger(_context, { ...options, colors: false, format: "quiet" });

  return {
    trace(message: string, data?: DataArg): void {
      writeFn(LogLevel.TRACE, message, data);
    },
    debug(message: string, data?: DataArg): void {
      writeFn(LogLevel.DEBUG, message, data);
    },
    info(message: string, data?: DataArg): void {
      writeFn(LogLevel.INFO, message, data);
    },
    success(message: string, data?: DataArg): void {
      writeFn(LogLevel.SUCCESS, message, data);
    },
    warn(message: string, data?: DataArg): void {
      writeFn(LogLevel.WARN, message, data);
    },
    error(message: string, error?: ErrorArg): void {
      writeFn(LogLevel.ERROR, message, extractErrorData(error));
    },
    fatal(message: string, error?: ErrorArg): void {
      writeFn(LogLevel.FATAL, message, extractErrorData(error));
    },
    box(message: string, title?: string): void {
      base.box(message, title);
    },
    spinner(text: string): SpinnerInstance {
      return base.spinner(text);
    },
    table(data: Record<string, unknown>[]): void {
      base.table(data);
    },
    setLevel(level: LogLevel): void {
      base.setLevel(level);
    },
    getLevel(): LogLevel {
      return base.getLevel();
    },
    withPrefix(prefix: string): Logger {
      return base.withPrefix(prefix);
    },
    withTag(tag: string): Logger {
      return base.withTag(tag);
    },
  };
}

export { LogLevel as Level };
