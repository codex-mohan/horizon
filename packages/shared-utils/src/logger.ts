/**
 * @horizon/shared-utils — Logger
 *
 * Structured, leveled terminal logger built on Chalk 5 (truecolor, ESM).
 *
 * Design principles:
 *  - Color toggling uses Chalk's `level` API (3 = 16M colors, 0 = no color)
 *    so rendering functions never need `colors ? x : y` ternaries.
 *  - Two module-level Chalk instances are cached (COLOR / PLAIN) — no repeated
 *    `new Chalk()` allocations in hot paths.
 *  - A `T` (tokens) object holds palette helpers as (ChalkInstance) => ChalkInstance
 *    so they compose cleanly via Chalk's fluent chaining API.
 *  - JSON data blocks are highlighted with cli-highlight + the hex palette.
 *  - Box, spinner, and table all use the same token system.
 */

import { Chalk, type ChalkInstance } from "chalk";
import { highlight } from "cli-highlight";

// ─── Chalk instances ──────────────────────────────────────────────────────────

/** Truecolor Chalk instance (16 million colors). */
const COLOR = new Chalk({ level: 3 });

/**
 * No-color Chalk instance. `level: 0` makes every method a transparent
 * pass-through, so `PLAIN.bold.hex("#fff")("text") === "text"`.
 */
const PLAIN = new Chalk({ level: 0 });

/** Returns the appropriate Chalk instance based on the `colors` flag. */
function ch(colors: boolean): ChalkInstance {
  return colors ? COLOR : PLAIN;
}

// ─── Design tokens ────────────────────────────────────────────────────────────
// Each token is `(ChalkInstance) => ChalkInstance` so it chains naturally:
//   T.ctx(chalk)("my text")           — apply token
//   T.ctx(chalk).underline("my text") — chain further modifiers

const T = {
  // Structural
  ts: (c: ChalkInstance) => c.dim,
  ctx: (c: ChalkInstance) => c.hex("#22D3EE"), // sky cyan
  pfx: (c: ChalkInstance) => c.hex("#E879F9"), // vivid pink
  caller: (c: ChalkInstance) => c.dim.italic,
  jsonBorder: (c: ChalkInstance) => c.dim.hex("#4B5563"), // dark slate
  // Table / box chrome
  chrome: (c: ChalkInstance) => c.dim.hex("#6B7280"), // cool gray
  tHead: (c: ChalkInstance) => c.bold.hex("#F9FAFB"), // near-white bold
  tCell: (c: ChalkInstance) => c.hex("#D1D5DB"), // light gray
  boxBorder: (c: ChalkInstance) => c.hex("#22D3EE"), // cyan border
  boxTitle: (c: ChalkInstance) => c.bold.hex("#F0F9FF"), // bright title
  // JSON theme helpers (return string → string so cli-highlight can use them)
  jsonKey: (c: ChalkInstance) => (s: string) => c.hex("#67E8F9")(s), // sky cyan
  jsonString: (c: ChalkInstance) => (s: string) => c.hex("#86EFAC")(s), // soft green
  jsonNumber: (c: ChalkInstance) => (s: string) => c.hex("#93C5FD")(s), // soft blue
  jsonLiteral: (c: ChalkInstance) => (s: string) => c.hex("#FCD34D")(s), // amber
} as const;

// ─── Log levels ───────────────────────────────────────────────────────────────

/** Log levels in ascending severity order. */
export enum LogLevel {
  TRACE = -1,
  DEBUG = 0,
  INFO = 1,
  SUCCESS = 2,
  WARN = 3,
  ERROR = 4,
  FATAL = 5,
}

type LevelMeta = {
  emoji: string;
  label: string;
  /** Applies message-text color. */
  msg: (c: ChalkInstance) => ChalkInstance;
  /** Returns a function that renders the colored pill badge. */
  badge: (c: ChalkInstance) => (text: string) => string;
  isError: boolean;
};

const LEVEL_META: Record<LogLevel, LevelMeta> = {
  [LogLevel.TRACE]: {
    emoji: "🔍",
    label: "TRACE",
    msg: (c) => c.hex("#9CA3AF"),
    badge: (c) => (t) => c.bgHex("#374151").hex("#F9FAFB")(t),
    isError: false,
  },
  [LogLevel.DEBUG]: {
    emoji: "🐛",
    label: "DEBUG",
    msg: (c) => c.hex("#C084FC"),
    badge: (c) => (t) => c.bgHex("#6D28D9").hex("#FAF5FF").bold(t),
    isError: false,
  },
  [LogLevel.INFO]: {
    emoji: "ℹ️",
    label: "INFO ",
    msg: (c) => c.hex("#93C5FD"),
    badge: (c) => (t) => c.bgHex("#1D4ED8").hex("#EFF6FF").bold(t),
    isError: false,
  },
  [LogLevel.SUCCESS]: {
    emoji: "✨",
    label: "READY",
    msg: (c) => c.hex("#86EFAC"),
    badge: (c) => (t) => c.bgHex("#15803D").hex("#F0FDF4").bold(t),
    isError: false,
  },
  [LogLevel.WARN]: {
    emoji: "⚠️",
    label: "WARN ",
    msg: (c) => c.hex("#FCD34D"),
    badge: (c) => (t) => c.bgHex("#92400E").hex("#FFFBEB").bold(t),
    isError: false,
  },
  [LogLevel.ERROR]: {
    emoji: "❌",
    label: "ERROR",
    msg: (c) => c.hex("#FCA5A5"),
    badge: (c) => (t) => c.bgHex("#991B1B").hex("#FFF1F2").bold(t),
    isError: true,
  },
  [LogLevel.FATAL]: {
    emoji: "💀",
    label: "FATAL",
    msg: (c) => c.bold.hex("#F87171"),
    badge: (c) => (t) => c.bgHex("#7F1D1D").hex("#FFF1F2").bold.underline(t),
    isError: true,
  },
};

// ─── Public types ─────────────────────────────────────────────────────────────

/** Output format modes. */
export type FormatMode = "fancy" | "simple" | "quiet";

/** Configuration options for the logger. */
export interface LoggerOptions {
  /** Minimum log level to output (default: INFO). */
  minLevel?: LogLevel;
  /** Include timestamps in output (default: true). */
  timestamps?: boolean;
  /** Colorize output (default: true; auto-disabled in CI). */
  colors?: boolean;
  /** Prefix string shown after the context label. */
  prefix?: string;
  /** Output format — fancy (default), simple (CI default), or quiet (JSON). */
  format?: FormatMode;
  /** Annotate each line with the caller's file:line (default: false). */
  showCaller?: boolean;
  /** Append a blank line after each log entry (default: true). */
  trailingNewline?: boolean;
}

/** Argument type for structured data attached to a log line. */
export type DataArg = Record<string, unknown> | undefined;

/** Argument type for the error parameter on `.error()` / `.fatal()`. */
export type ErrorArg = Error | DataArg | undefined;

/** Handle returned by `logger.spinner()`. */
export interface SpinnerInstance {
  /** Update the spinner's text while it is running. */
  text(msg: string): void;
  /** Stop and print a green success line. */
  success(msg?: string): void;
  /** Stop and print a red failure line. */
  fail(msg?: string): void;
  /** Stop and print a yellow warning line. */
  warn(msg?: string): void;
  /** Stop the spinner silently. */
  stop(): void;
}

/** Public logger interface. */
export interface Logger {
  trace(message: string, data?: DataArg): void;
  debug(message: string, data?: DataArg): void;
  info(message: string, data?: DataArg): void;
  success(message: string, data?: DataArg): void;
  warn(message: string, data?: DataArg): void;
  error(message: string, error?: ErrorArg): void;
  fatal(message: string, error?: ErrorArg): void;
  /** Render a prominent bordered box with centered title. */
  box(message: string, title?: string): void;
  /** Start an animated terminal spinner. */
  spinner(text: string): SpinnerInstance;
  /** Render an ASCII table from an array of row objects. */
  table(data: Record<string, unknown>[]): void;
  setLevel(level: LogLevel): void;
  getLevel(): LogLevel;
  /** Create a child logger that shares config but adds a prefix segment. */
  withPrefix(prefix: string): Logger;
  /** Alias for `withPrefix` — semantically "tag" rather than "prefix". */
  withTag(tag: string): Logger;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

function isCI(): boolean {
  return process.env.CI === "true" || process.env.NODE_ENV === "test";
}

const DEFAULTS: Required<LoggerOptions> = {
  minLevel: LogLevel.INFO,
  timestamps: true,
  colors: true,
  prefix: "",
  format: isCI() ? "simple" : "fancy",
  showCaller: false,
  trailingNewline: true,
};

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Creates a typed, colored logger instance.
 *
 * @example
 * const log = createLogger("Agent");
 * log.info("Server ready");
 * log.warn("High memory", { used: "88%" });
 * log.error("Connection failed", new Error("ECONNREFUSED"));
 * log.box("All systems nominal\nUptime: 99.9%", "STATUS");
 *
 * const spin = log.spinner("Loading models...");
 * spin.success("Done");
 *
 * const apiLog = log.withPrefix("API");
 * apiLog.info("GET /health");
 */
export function createLogger(context: string, options: LoggerOptions = {}): Logger {
  const cfg: Required<LoggerOptions> = { ...DEFAULTS, ...options };
  if (options.colors === undefined && isCI()) cfg.colors = false;

  return {
    trace: (m, d) => _log(LogLevel.TRACE, context, m, d, cfg),
    debug: (m, d) => _log(LogLevel.DEBUG, context, m, d, cfg),
    info: (m, d) => _log(LogLevel.INFO, context, m, d, cfg),
    success: (m, d) => _log(LogLevel.SUCCESS, context, m, d, cfg),
    warn: (m, d) => _log(LogLevel.WARN, context, m, d, cfg),
    error: (m, e) => _log(LogLevel.ERROR, context, m, _err(e), cfg),
    fatal: (m, e) => _log(LogLevel.FATAL, context, m, _err(e), cfg),
    box: (m, t) => _box(context, m, t, cfg),
    spinner: (t) => _spinner(context, t, cfg),
    table: (d) => _table(context, d, cfg),
    setLevel: (l) => {
      cfg.minLevel = l;
    },
    getLevel: () => cfg.minLevel,
    withPrefix: (p) =>
      createLogger(context, { ...cfg, prefix: cfg.prefix ? `${cfg.prefix} ${p}` : p }),
    withTag: (t) =>
      createLogger(context, { ...cfg, prefix: cfg.prefix ? `${cfg.prefix} ${t}` : t }),
  };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function _err(e?: ErrorArg): Record<string, unknown> | undefined {
  if (!e) return undefined;
  if (e instanceof Error) return { name: e.name, message: e.message, stack: e.stack };
  return e;
}

// ─── Core log renderer ────────────────────────────────────────────────────────

function _log(
  level: LogLevel,
  context: string,
  message: string,
  data: Record<string, unknown> | undefined,
  cfg: Required<LoggerOptions>
): void {
  if (level < cfg.minLevel) return;

  const meta = LEVEL_META[level];
  const print = meta.isError ? console.error : console.log;
  const nl = cfg.trailingNewline ? "\n" : "";

  // ── quiet: machine-readable newline-delimited JSON ────────────────────────
  if (cfg.format === "quiet") {
    const row =
      data && Object.keys(data).length > 0
        ? { level: meta.label.trim(), context, message, ...data }
        : { level: meta.label.trim(), context, message };
    print(JSON.stringify(row) + nl);
    return;
  }

  // ── simple: plain-text, emoji-prefixed, CI-safe ───────────────────────────
  if (cfg.format === "simple") {
    const ts = cfg.timestamps ? `[${_ts()}] ` : "";
    const pfx = cfg.prefix ? `[${cfg.prefix}] ` : "";
    print(`${meta.emoji} ${ts}${pfx}[${meta.label.trim()}] [${context}] ${message}${nl}`);
    if (data && Object.keys(data).length > 0) print(JSON.stringify(data, null, 2));
    return;
  }

  // ── fancy: truecolor Chalk output ────────────────────────────────────────
  const c = ch(cfg.colors);
  const ts = cfg.timestamps ? T.ts(c)(_ts()) : "";
  const badge = meta.badge(c)(` ${meta.label} `);
  const ctx = T.ctx(c)(`[${context}]`);
  const pfx = cfg.prefix ? T.pfx(c)(`[${cfg.prefix}]`) : "";
  const msg = meta.msg(c)(message);
  const loc = cfg.showCaller ? ` ${T.caller(c)(_caller())}` : "";

  print([ts, badge, ctx, pfx].filter(Boolean).join(" ") + ` ${msg}${loc}${nl}`);

  if (data && Object.keys(data).length > 0) {
    const raw = JSON.stringify(data, null, 2);
    const pretty = cfg.colors ? _json(raw, c) : raw;
    const block = pretty
      .split("\n")
      .map((ln) => `  ${T.jsonBorder(c)("│")} ${ln}`)
      .join("\n");
    print(`${block}\n`);
  }
}

// ─── JSON highlighter ─────────────────────────────────────────────────────────

function _json(raw: string, c: ChalkInstance): string {
  return highlight(raw, {
    language: "json",
    ignoreIllegals: true,
    theme: {
      attr: T.jsonKey(c),
      string: T.jsonString(c),
      number: T.jsonNumber(c),
      literal: T.jsonLiteral(c),
    },
  });
}

// ─── Box renderer ─────────────────────────────────────────────────────────────

const BOX_W = 62; // inner content width (excluding │ borders)

function _box(
  context: string,
  message: string,
  title: string | undefined,
  cfg: Required<LoggerOptions>
): void {
  if (cfg.minLevel > LogLevel.INFO) return;

  const c = ch(cfg.colors);
  const label = title ?? `${context}${cfg.prefix ? ` · ${cfg.prefix}` : ""}`;
  const lines = _wrap(message, BOX_W - 2);
  const B = (s: string) => T.boxBorder(c)(s);

  const top = `${B("╭")}${B("─".repeat(BOX_W))}${B("╮")}`;
  const bottom = `${B("╰")}${B("─".repeat(BOX_W))}${B("╯")}`;
  const mid = `${B("├")}${B("─".repeat(BOX_W))}${B("┤")}`;
  const side = B("│");
  const blank = `${side}${" ".repeat(BOX_W)}${side}`;

  // Centered title row
  const visLen = label.length;
  const pad = Math.max(0, BOX_W - visLen - 2);
  const lp = Math.floor(pad / 2);
  const rp = pad - lp;
  const titleRow = `${side} ${" ".repeat(lp)}${T.boxTitle(c)(label)}${" ".repeat(rp)} ${side}`;

  const bodyRows = lines.map((ln) => {
    const padding = Math.max(0, BOX_W - 2 - _bare(ln).length);
    return `${side} ${ln}${" ".repeat(padding)} ${side}`;
  });

  console.log(`\n${[top, blank, titleRow, blank, mid, ...bodyRows, blank, bottom].join("\n")}\n`);
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

function _spinner(context: string, initial: string, cfg: Required<LoggerOptions>): SpinnerInstance {
  const c = ch(cfg.colors);
  const ctx = () => T.ctx(c)(`[${context}]`);
  let text = initial;
  let frame = 0;
  let active = true;
  let timer: ReturnType<typeof setInterval> | null = null;

  function draw(): void {
    if (!active || cfg.minLevel > LogLevel.INFO) return;
    const f = FRAMES[frame % FRAMES.length];
    process.stdout.write(
      `\r${c.bold.hex("#22D3EE")(f)} ${T.ts(c)(ctx())} ${c.hex("#F9FAFB")(text)}  `
    );
  }

  function stop(): void {
    active = false;
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  timer = setInterval(() => {
    frame++;
    draw();
  }, 80);

  return {
    text: (m) => {
      text = m;
      draw();
    },
    stop,
    success: (m) => {
      stop();
      if (cfg.minLevel > LogLevel.INFO) return;
      console.log(`\n${c.bold.hex("#22C55E")("✔")} ${ctx()} ${c.hex("#86EFAC")(m ?? text)}`);
    },
    fail: (m) => {
      stop();
      if (cfg.minLevel > LogLevel.INFO) return;
      console.error(`\n${c.bold.hex("#EF4444")("✘")} ${ctx()} ${c.hex("#FCA5A5")(m ?? text)}`);
    },
    warn: (m) => {
      stop();
      if (cfg.minLevel > LogLevel.INFO) return;
      console.log(`\n${c.bold.hex("#F59E0B")("⚠")} ${ctx()} ${c.hex("#FCD34D")(m ?? text)}`);
    },
  };
}

// ─── Table renderer ───────────────────────────────────────────────────────────

function _table(
  context: string,
  data: Record<string, unknown>[],
  cfg: Required<LoggerOptions>
): void {
  if (cfg.minLevel > LogLevel.INFO || data.length === 0) return;

  const c = ch(cfg.colors);
  const keys = Object.keys(data[0]);
  const widths: Record<string, number> = {};

  for (const k of keys) {
    widths[k] = Math.min(Math.max(k.length, ...data.map((r) => String(r[k] ?? "").length)), 30);
  }

  const totalW = Object.values(widths).reduce((a, b) => a + b + 3, 0) + 1;
  const rule = T.chrome(c)("─".repeat(Math.min(totalW, 120)));
  const sep = T.chrome(c)("│");

  console.log(`\n${T.ctx(c)(`[${context}]`)} ${rule}`);

  const header = keys.map((k) => T.tHead(c)(k.padEnd(widths[k]))).join(` ${sep} `);
  console.log(`  ${header} `);
  console.log(T.chrome(c)("─".repeat(_bare(header).length + 4)));

  for (const row of data) {
    const cells = keys
      .map((k) => {
        const raw = String(row[k] ?? "");
        const cell =
          raw.length > widths[k] ? `${raw.slice(0, widths[k] - 3)}...` : raw.padEnd(widths[k]);
        return T.tCell(c)(cell);
      })
      .join(` ${sep} `);
    console.log(`  ${cells} `);
  }

  console.log(`${rule}\n`);
}

// ─── Micro-utilities ──────────────────────────────────────────────────────────

/** Strip all ANSI escape codes to measure visible string width. */
function _bare(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

/** Current time as HH:MM:SS.mmm */
function _ts(): string {
  const d = new Date();
  const p2 = (n: number) => n.toString().padStart(2, "0");
  const p3 = (n: number) => n.toString().padStart(3, "0");
  return `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}.${p3(d.getMilliseconds())}`;
}

/** Extract the caller's file:line from the current call stack. */
function _caller(): string {
  const stack = new Error().stack;
  if (!stack) return "";
  for (const ln of stack.split("\n").slice(4)) {
    const m = ln.match(/at\s+.+\s+\((.+):(\d+):\d+\)/);
    if (m) return `${m[1]}:${m[2]}`;
  }
  return "";
}

/** Word-wrap `text` to `maxW` visible characters per line. */
function _wrap(text: string, maxW: number): string[] {
  const out: string[] = [];
  for (const raw of text.split("\n")) {
    if (!raw) {
      out.push("");
      continue;
    }
    let cur = "";
    for (const word of raw.split(" ")) {
      const next = cur ? `${cur} ${word}` : word;
      if (_bare(next).length <= maxW) {
        cur = next;
      } else {
        if (cur) out.push(cur);
        cur = word;
      }
    }
    if (cur) out.push(cur);
  }
  return out;
}

// ─── Public extras ────────────────────────────────────────────────────────────

/**
 * Creates a child logger whose context is the parent's context tagged with
 * `childCtx`.
 *
 * @example
 * const parent = createLogger("Agent");
 * const child  = childLogger(parent, "Memory");
 * child.info("Retrieving"); // rendered as [Agent] [Memory]
 */
export function childLogger(parent: Logger, childCtx: string): Logger {
  return parent.withTag(childCtx);
}

/**
 * Creates a logger that routes all output through `writeFn` instead of the
 * console — useful for file rotation, remote log sinks, or testing.
 */
export function createFileLogger(
  context: string,
  writeFn: (level: LogLevel, message: string, data?: Record<string, unknown>) => void,
  options: LoggerOptions = {}
): Logger {
  const base = createLogger(context, { ...options, colors: false, format: "quiet" });
  return {
    trace: (m, d) => writeFn(LogLevel.TRACE, m, d),
    debug: (m, d) => writeFn(LogLevel.DEBUG, m, d),
    info: (m, d) => writeFn(LogLevel.INFO, m, d),
    success: (m, d) => writeFn(LogLevel.SUCCESS, m, d),
    warn: (m, d) => writeFn(LogLevel.WARN, m, d),
    error: (m, e) => writeFn(LogLevel.ERROR, m, _err(e)),
    fatal: (m, e) => writeFn(LogLevel.FATAL, m, _err(e)),
    box: (m, t) => base.box(m, t),
    spinner: (t) => base.spinner(t),
    table: (d) => base.table(d),
    setLevel: (l) => base.setLevel(l),
    getLevel: () => base.getLevel(),
    withPrefix: (p) => base.withPrefix(p),
    withTag: (t) => base.withTag(t),
  };
}

/** Convenience alias for `LogLevel`. */
export { LogLevel as Level };
