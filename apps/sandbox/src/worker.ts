import { Worker, Job } from "bullmq";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, unlink, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import chalk from "chalk";

const execAsync = promisify(exec);

interface SandboxJob {
  language: "python" | "bash" | "node";
  code: string;
  timeout?: number;
  enableNetwork?: boolean;
}

interface SandboxResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
  timedOut: boolean;
}

const RUNTIME_IMAGES: Record<SandboxJob["language"], string> = {
  python: "horizon-sandbox-python",
  node: "horizon-sandbox-node",
  bash: "horizon-sandbox-bash",
};

const FILE_EXTENSIONS: Record<SandboxJob["language"], string> = {
  python: "py",
  node: "js",
  bash: "sh",
};

const COMMANDS: Record<SandboxJob["language"], string> = {
  python: "python3",
  node: "node",
  bash: "bash",
};

const DEFAULT_TIMEOUT = 30_000; // 30 seconds
const MEMORY_LIMIT = "512m";
const CPU_LIMIT = "0.5";

function log(level: "info" | "error" | "warn", message: string, meta?: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  const metaStr = meta ? " " + JSON.stringify(meta) : "";

  switch (level) {
    case "info":
      console.log(chalk.blue(`[${timestamp}] [INFO]`) + ` ${message}` + chalk.gray(metaStr));
      break;
    case "error":
      console.error(chalk.red(`[${timestamp}] [ERROR]`) + ` ${message}` + chalk.gray(metaStr));
      break;
    case "warn":
      console.warn(chalk.yellow(`[${timestamp}] [WARN]`) + ` ${message}` + chalk.gray(metaStr));
      break;
  }
}

async function ensureRuntimeImage(language: SandboxJob["language"]): Promise<void> {
  const image = RUNTIME_IMAGES[language];
  try {
    await execAsync(`docker inspect --type=image ${image}`);
    log("info", `Runtime image ${image} is available`);
  } catch {
    log("info", `Building runtime image ${image}...`);
    const dockerfilePath = join("/app/runtimes", `${language}.Dockerfile`);
    const { stderr } = await execAsync(
      `docker build -f ${dockerfilePath} -t ${image} /app/runtimes`
    );
    if (stderr) {
      log("warn", `Build stderr for ${image}`, { stderr: stderr.trim() });
    }
    log("info", `Runtime image ${image} built successfully`);
  }
}

async function executeInSandbox(
  jobData: SandboxJob,
  jobId: string
): Promise<SandboxResult> {
  const { language, code, timeout = DEFAULT_TIMEOUT, enableNetwork = false } = jobData;
  const image = RUNTIME_IMAGES[language];
  const ext = FILE_EXTENSIONS[language];
  const command = COMMANDS[language];
  const containerName = `horizon-sandbox-${jobId}-${Date.now()}`;

  // Create temp directory and write code file
  const tmpDir = await mkdtemp(join(tmpdir(), "horizon-sandbox-"));
  const codeFile = join(tmpDir, `code.${ext}`);
  await writeFile(codeFile, code, { encoding: "utf-8" });

  const networkFlag = enableNetwork ? "" : "--network none";

  const dockerArgs = [
    "docker run",
    "--rm",
    `--name ${containerName}`,
    `-v "${codeFile}:/tmp/code.${ext}:ro"`,
    "-w /tmp",
    networkFlag,
    "--read-only",
    "--cap-drop ALL",
    "--security-opt no-new-privileges:true",
    `--memory=${MEMORY_LIMIT}`,
    `--cpus=${CPU_LIMIT}`,
    "--pids-limit 64",
    "--tmpfs /tmp:rw,noexec,nosuid,size=100m",
    "-e NODE_ENV=production",
    "-e PYTHONDONTWRITEBYTECODE=1",
    image,
    `${command} /tmp/code.${ext}`,
  ]
    .filter(Boolean)
    .join(" ");

  log("info", `Executing sandbox job ${jobId}`, {
    language,
    timeout,
    enableNetwork,
    containerName,
  });

  const startTime = Date.now();

  return new Promise((resolve) => {
    const child = exec(dockerArgs, {
      timeout,
      maxBuffer: 1024 * 1024, // 1MB stdout/stderr buffer
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    child.stdout?.on("data", (data: string) => {
      stdout += data;
    });

    child.stderr?.on("data", (data: string) => {
      stderr += data;
    });

    const cleanup = async () => {
      try {
        await execAsync(`docker rm -f ${containerName}`).catch(() => {
          // Container may already be gone
        });
      } catch {
        // Ignore cleanup errors
      }
      try {
        await unlink(codeFile);
      } catch {
        // Ignore cleanup errors
      }
    };

    child.on("error", async (error) => {
      await cleanup();
      const durationMs = Date.now() - startTime;
      log("error", `Sandbox job ${jobId} failed with error`, {
        error: error.message,
        durationMs,
      });
      resolve({
        stdout,
        stderr: stderr || error.message,
        exitCode: null,
        durationMs,
        timedOut: error.message.includes("ETIMEDOUT") || error.message.includes("timeout"),
      });
    });

    child.on("exit", async (code) => {
      await cleanup();
      const durationMs = Date.now() - startTime;
      log("info", `Sandbox job ${jobId} completed`, {
        exitCode: code,
        durationMs,
        timedOut,
      });
      resolve({
        stdout,
        stderr,
        exitCode: code,
        durationMs,
        timedOut,
      });
    });

    // Manual timeout handling in case exec timeout doesn't kill the container
    const timeoutId = setTimeout(async () => {
      timedOut = true;
      child.kill("SIGKILL");
      await cleanup();
      const durationMs = Date.now() - startTime;
      log("warn", `Sandbox job ${jobId} timed out after ${timeout}ms`);
      resolve({
        stdout,
        stderr: stderr + "\n[horizon-sandbox] Execution timed out",
        exitCode: null,
        durationMs,
        timedOut: true,
      });
    }, timeout + 2000); // Give exec timeout a 2s head start

    child.on("exit", () => {
      clearTimeout(timeoutId);
    });
  });
}

async function buildAllRuntimes(): Promise<void> {
  log("info", "Pre-building runtime images...");
  await Promise.all([
    ensureRuntimeImage("python"),
    ensureRuntimeImage("node"),
    ensureRuntimeImage("bash"),
  ]);
  log("info", "All runtime images ready");
}

export async function startWorker(): Promise<void> {
  const redisUrl = process.env.REDIS_URL || "redis://redis:6379";

  log("info", "Starting Horizon Sandbox Worker", { redisUrl });

  // Ensure Docker socket is accessible
  try {
    await execAsync("docker info");
  } catch (error) {
    log("error", "Docker is not available. Is dockerd running?", {
      error: (error as Error).message,
    });
    process.exit(1);
  }

  await buildAllRuntimes();

  const worker = new Worker<SandboxJob, SandboxResult>(
    "sandbox-jobs",
    async (job: Job<SandboxJob>) => {
      log("info", `Received job ${job.id}`, {
        language: job.data.language,
        timeout: job.data.timeout,
        enableNetwork: job.data.enableNetwork,
      });
      return executeInSandbox(job.data, String(job.id));
    },
    {
      connection: {
        url: redisUrl,
      },
      concurrency: 5,
      stalledInterval: 30_000,
    }
  );

  worker.on("completed", (job, result) => {
    log("info", `Job ${job?.id} completed`, {
      exitCode: result.exitCode,
      durationMs: result.durationMs,
      timedOut: result.timedOut,
    });
  });

  worker.on("failed", (job, err) => {
    log("error", `Job ${job?.id} failed`, { error: err.message });
  });

  worker.on("error", (err) => {
    log("error", "Worker error", { error: err.message });
  });

  log("info", "Worker listening on queue: sandbox-jobs");

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    log("info", `Received ${signal}, shutting down gracefully...`);
    await worker.close();
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

// Start if this file is the entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  startWorker().catch((error) => {
    log("error", "Failed to start worker", { error: error.message });
    process.exit(1);
  });
}
