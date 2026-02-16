/**
 * Simple JSON-based database for assistants
 * Mirrors the frontend db structure
 */

import fs from "node:fs";
import path from "node:path";

export interface Assistant {
  id: string;
  user_id: string;
  name: string;
  description: string;
  avatar_url?: string;
  system_prompt: string;
  model_provider: "openai" | "anthropic" | "groq" | "ollama";
  model_name: string;
  temperature: number;
  max_tokens: number;
  tools: string[];
  memory_enabled: boolean;
  is_default: boolean;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

interface Database {
  assistants: Assistant[];
}

// Ensure data directory exists
const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "assistants.json");

// Load or initialize database
function loadDb(): Database {
  try {
    if (fs.existsSync(dbPath)) {
      const data = fs.readFileSync(dbPath, "utf-8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Error loading assistants database:", error);
  }
  return { assistants: [] };
}

function saveDb(db: Database): void {
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

// Database operations
export const assistantsDb = {
  findById: (id: string): Assistant | undefined => {
    const database = loadDb();
    return database.assistants.find((a) => a.id === id);
  },

  findByUserId: (userId: string): Assistant[] => {
    const database = loadDb();
    return database.assistants.filter((a) => a.user_id === userId);
  },

  findDefault: (userId: string): Assistant | undefined => {
    const database = loadDb();
    return database.assistants.find((a) => a.user_id === userId && a.is_default);
  },

  findPublic: (): Assistant[] => {
    const database = loadDb();
    return database.assistants.filter((a) => a.is_public);
  },

  create: (assistant: Assistant): Assistant => {
    const database = loadDb();
    database.assistants.push(assistant);
    saveDb(database);
    return assistant;
  },

  update: (id: string, updates: Partial<Assistant>): Assistant | undefined => {
    const database = loadDb();
    const index = database.assistants.findIndex((a) => a.id === id);
    if (index === -1) {
      return undefined;
    }
    const updated = { ...database.assistants[index], ...updates } as Assistant;
    database.assistants[index] = updated;
    saveDb(database);
    return updated;
  },

  delete: (id: string): boolean => {
    const database = loadDb();
    const index = database.assistants.findIndex((a) => a.id === id);
    if (index === -1) {
      return false;
    }
    database.assistants.splice(index, 1);
    saveDb(database);
    return true;
  },

  setDefault: (userId: string, assistantId: string): boolean => {
    const database = loadDb();
    database.assistants = database.assistants.map((a) => {
      if (a.user_id === userId) {
        return { ...a, is_default: a.id === assistantId };
      }
      return a;
    });
    saveDb(database);
    return true;
  },
};
