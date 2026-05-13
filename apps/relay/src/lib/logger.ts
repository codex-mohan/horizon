import chalk from "chalk";
import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

const prodLogger = isDev
  ? null
  : pino({ level: process.env.LOG_LEVEL || "info" });

// Feel-good startup messages — cycles daily so you get a fresh one
const greetings = [
  "Let's build something great today.",
  "Past the event horizon, everything is possible.",
  "Your local AI companion is ready.",
  "Another day, another horizon to cross.",
  "Good things come to those who prompt.",
  "Ready to explore the unknown?",
  "The future is local-first.",
  "Booting up possibilities...",
];

function devLog(level: string, module: string, message: string, meta?: Record<string, unknown>) {
  const ts = new Date().toLocaleTimeString("en-US", { hour12: false });
  const label = level.toUpperCase().padEnd(5);

  const colors: Record<string, (s: string) => string> = {
    debug: chalk.gray,
    info: chalk.hex("#6366F1"),
    warn: chalk.hex("#F59E0B"),
    error: chalk.hex("#EF4444"),
  };
  const color = colors[level] ?? chalk.white;
  const moduleColor = chalk.hex("#06B6D4");

  const metaStr = meta ? " " + chalk.dim(JSON.stringify(meta)) : "";
  console.log(
    chalk.dim(ts),
    color(label),
    moduleColor(module.padEnd(12)),
    message + metaStr
  );
}

export function createLogger(module: string) {
  return {
    debug: (message: string, meta?: Record<string, unknown>) => {
      if (isDev) devLog("debug", module, message, meta);
      else prodLogger?.debug({ module, ...meta }, message);
    },
    info: (message: string, meta?: Record<string, unknown>) => {
      if (isDev) devLog("info", module, message, meta);
      else prodLogger?.info({ module, ...meta }, message);
    },
    warn: (message: string, meta?: Record<string, unknown>) => {
      if (isDev) devLog("warn", module, message, meta);
      else prodLogger?.warn({ module, ...meta }, message);
    },
    error: (message: string, meta?: Record<string, unknown>) => {
      if (isDev) devLog("error", module, message, meta);
      else prodLogger?.error({ module, ...meta }, message);
    },
  };
}

export type Logger = ReturnType<typeof createLogger>;

export function printBanner(port: number) {
  if (!isDev) return;

  const greeting = greetings[Math.floor(Math.random() * greetings.length)];

  const lines = [
    "",
    "   " +
      chalk.hex("#4F46E5").bold("H") +
      chalk.hex("#6366F1").bold("o") +
      chalk.hex("#818CF8").bold("r") +
      chalk.hex("#A5B4FC").bold("i") +
      chalk.hex("#818CF8").bold("z") +
      chalk.hex("#6366F1").bold("o") +
      chalk.hex("#4F46E5").bold("n"),
    "   " + chalk.dim("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"),
    "",
    "   " + chalk.dim("local") + "   " + chalk.cyan(`http://localhost:${port}`),
    "   " + chalk.dim("health") + "  " + chalk.cyan(`http://localhost:${port}/health`),
    "",
    "   " + chalk.italic.hex("#A5B4FC")(greeting),
    "",
  ];

  console.log(lines.join("\n"));
}
