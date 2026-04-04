import fs from "node:fs";
import path from "node:path";
import { getGlobalDataDir } from "@horizon/shared-utils";

const THREADS_DIR = path.join(getGlobalDataDir(), "threads");

function ensureDir() {
  if (!fs.existsSync(THREADS_DIR)) {
    fs.mkdirSync(THREADS_DIR, { recursive: true });
  }
}

export interface ThreadStore {
  save(threadId: string, messages: any[]): void;
  load(threadId: string): any[] | null;
  delete(threadId: string): void;
  list(): string[];
}

export const threadStore: ThreadStore = {
  save(threadId: string, messages: any[]) {
    ensureDir();
    const filePath = path.join(THREADS_DIR, `${threadId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(messages, null, 2));
  },

  load(threadId: string): any[] | null {
    const filePath = path.join(THREADS_DIR, `${threadId}.json`);
    if (!fs.existsSync(filePath)) return null;
    try {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch {
      return null;
    }
  },

  delete(threadId: string) {
    const filePath = path.join(THREADS_DIR, `${threadId}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  },

  list(): string[] {
    ensureDir();
    return fs
      .readdirSync(THREADS_DIR)
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(".json", ""));
  },
};
