import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Returns the global application data directory (~/.horizon).
 * Ensures the directory exists before returning.
 */
export function getGlobalDataDir(): string {
  const home = os.homedir();
  const dataDir = path.join(home, ".horizon");

  if (!fs.existsSync(dataDir)) {
    try {
      fs.mkdirSync(dataDir, { recursive: true });
    } catch (err) {
      console.error(`[SharedUtils] Failed to create global data directory at ${dataDir}:`, err);
    }
  }

  return dataDir;
}

/**
 * Returns a specific directory within the global data directory (e.g. ~/.horizon/data).
 * Ensures the directory exists before returning.
 */
export function getGlobalSubdir(subdir: string): string {
  const globalDir = getGlobalDataDir();
  const targetDir = path.join(globalDir, subdir);

  if (!fs.existsSync(targetDir)) {
    try {
      fs.mkdirSync(targetDir, { recursive: true });
    } catch (err) {
      console.error(`[SharedUtils] Failed to create subdirectory at ${targetDir}:`, err);
    }
  }

  return targetDir;
}
