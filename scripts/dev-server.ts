#!/usr/bin/env bun
/**
 * Horizon Dev Server — launches the full dev stack.
 *
 * Spins up:
 *   1. Docker Compose (Postgres + Redis + Prometheus + Grafana) — optional
 *   2. Drizzle DB migrations
 *   3. Relay API server (background)
 *   4. Web dev server (foreground)
 *
 * Usage:
 *   bun run dev:all
 *   bun scripts/dev-server.ts
 */

import { spawn, type ChildProcess } from "child_process";

const c = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  italic: "\x1b[3m",
  indigo: "\x1b[38;2;99;102;241m",
  cyan: "\x1b[38;2;6;182;212m",
  emerald: "\x1b[38;2;16;185;129m",
  amber: "\x1b[38;2;245;158;11m",
  pink: "\x1b[38;2;236;72;153m",
  gray: "\x1b[38;2;148;163;184m",
  lightIndigo: "\x1b[38;2;129;140;248m",
  lightPurple: "\x1b[38;2;165;180;252m",
};

function letter(color: string, char: string) {
  return color + c.bold + char + c.reset;
}

const greetings = [
  "Let's build something great today.",
  "Past the event horizon, everything is possible.",
  "All systems go — time to create.",
  "Another day, another horizon to cross.",
  "Good things come to those who prompt.",
  "Your stack is waking up. Grab some coffee.",
  "Nothing runs like a local dev server.",
];

function run(
  command: string,
  args: string[],
  options?: { cwd?: string; env?: Record<string, string>; silent?: boolean }
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options?.cwd ?? process.cwd(),
      env: { ...process.env, ...options?.env },
      stdio: options?.silent ? "pipe" : "inherit",
      shell: process.platform === "win32",
    });
    child.on("close", (code) => {
      if (code === 0 || code === null) resolve();
      else reject(new Error(`Command exited with code ${code}`));
    });
    child.on("error", reject);
  });
}

function startProcess(
  command: string,
  args: string[],
  options?: { cwd?: string; env?: Record<string, string>; silent?: boolean }
): ChildProcess {
  return spawn(command, args, {
    cwd: options?.cwd ?? process.cwd(),
    env: { ...process.env, ...options?.env },
    stdio: options?.silent ? "pipe" : "inherit",
    shell: process.platform === "win32",
  });
}

function waitForPort(port: number, timeoutMs = 15000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const interval = setInterval(async () => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 500);
        const res = await fetch(`http://localhost:${port}/health`, { signal: controller.signal });
        clearTimeout(timer);
        if (res.ok) {
          clearInterval(interval);
          resolve();
        }
      } catch {
        if (Date.now() - start > timeoutMs) {
          clearInterval(interval);
          reject(new Error(`Port ${port} did not become ready within ${timeoutMs}ms`));
        }
      }
    }, 500);
  });
}

function status(icon: string, msg: string) {
  const ts = new Date().toLocaleTimeString("en-US", { hour12: false });
  console.log(`  ${c.dim}${ts}${c.reset}  ${icon} ${c.gray}${msg}${c.reset}`);
}

async function main() {
  const greeting = greetings[Math.floor(Math.random() * greetings.length)];

  console.log("");
  console.log(
    "   " +
    letter(c.indigo, "H") +
    letter(c.lightIndigo, "o") +
    letter(c.lightPurple, "r") +
    letter(c.lightPurple, "i") +
    letter(c.lightIndigo, "z") +
    letter(c.indigo, "o") +
    letter(c.indigo, "n")
  );
  console.log(`   ${c.dim}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
  console.log(`   ${c.dim}dev server launcher${c.reset}`);
  console.log("");
  console.log(`   ${c.italic}${c.gray}${greeting}${c.reset}`);
  console.log("");

  const rootDir = process.cwd();
  let relayProc: ChildProcess | null = null;

  // Docker Compose
  status("📦", "Docker Compose services...");
  try {
    await run("docker-compose", ["up", "-d", "postgres", "redis", "prometheus", "grafana"], { cwd: rootDir, silent: true });
    status(c.emerald + "✓" + c.reset, "Docker Compose running");
  } catch {
    status(c.amber + "⚠" + c.reset, "Docker unavailable — services will use local fallbacks");
  }

  // Wait
  status("⏳", "Warming up...");
  await new Promise((r) => setTimeout(r, 2000));

  // DB Migrations
  status("🗄 ", "Database migrations...");
  try {
    const fs = await import("fs");
    const drizzleDir = `${rootDir}/apps/relay/drizzle`;
    const hasMigrations = fs.existsSync(drizzleDir) && fs.readdirSync(drizzleDir).some((f) => f.endsWith(".sql"));
    if (!hasMigrations) {
      status("📋", "Generating migration...");
      try {
        await run("bun", ["run", "db:generate"], { cwd: `${rootDir}/apps/relay`, silent: true });
      } catch {
        status(c.amber + "⚠" + c.reset, "Migration generation skipped");
      }
    }
    await run("bun", ["run", "db:migrate"], { cwd: `${rootDir}/apps/relay`, silent: true });
    status(c.emerald + "✓" + c.reset, "Migrations complete");
  } catch {
    status(c.amber + "⚠" + c.reset, "Migration not ready — DB may need a moment");
  }

  // Relay
  status("🔌", "Relay API starting...");
  relayProc = startProcess(
    process.platform === "win32" ? "bun" : "bun",
    ["run", "dev"],
    { cwd: `${rootDir}/apps/relay` }
  );
  relayProc.on("error", () => {
    status(c.pink + "✗" + c.reset, "Relay process error");
  });
  try {
    await waitForPort(3001, 10000);
    status(c.emerald + "✓" + c.reset, "Relay ready");
  } catch {
    status(c.amber + "⚠" + c.reset, "Relay still booting, hang tight...");
  }

  // Summary
  console.log("");
  console.log(`  ${c.bold}Ready to launch.${c.reset}`);
  console.log(`  ${c.dim}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
  console.log(`  ${c.dim}web           ${c.cyan}http://localhost:3000${c.reset}`);
  console.log(`  ${c.dim}relay api     ${c.cyan}http://localhost:3001${c.reset}`);
  console.log(`  ${c.dim}grafana       ${c.cyan}http://localhost:3002${c.reset}`);
  console.log(`  ${c.dim}prometheus    ${c.cyan}http://localhost:9090${c.reset}`);
  console.log("");
  console.log(`  ${c.dim}Press ${c.reset}Ctrl+C${c.dim} to stop everything${c.reset}`);
  console.log("");

  // Web (foreground)
  try {
    await run("bun", ["run", "dev"], { cwd: `${rootDir}/apps/web` });
  } finally {
    console.log("");
    console.log(`  ${c.gray}Shutting everything down — see you soon${c.reset}`);
    if (relayProc && !relayProc.killed) {
      relayProc.kill("SIGTERM");
    }
    process.exit(0);
  }
}

main().catch((err) => {
  console.error(`  ${c.pink}Dev server failed: ${err.message}${c.reset}`);
  process.exit(1);
});
