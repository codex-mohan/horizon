// Simple JSON-based local storage for user authentication only
// Conversations are handled by LangGraph's checkpointer

import fs from "node:fs";
import path from "node:path";

interface User {
  id: string; // UUID - used as user_id in LangGraph thread metadata
  username: string;
  passwordHash: string;
  displayName?: string;
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Session {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  rememberMe: boolean;
  createdAt: Date;
}

interface Assistant {
  id: string;
  user_id: string;
  name: string;
  description: string;
  avatar_url?: string;
  system_prompt: string;
  model_provider: string;
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
  users: User[];
  sessions: Session[];
  assistants: Assistant[];
}

// Ensure data directory exists
const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "horizon.json");

// Load or initialize database
function loadDb(): Database {
  try {
    if (fs.existsSync(dbPath)) {
      const data = fs.readFileSync(dbPath, "utf-8");
      const parsed = JSON.parse(data);
      // Convert date strings back to Date objects
      return {
        users: (parsed.users || []).map((u: Record<string, unknown>) => ({
          ...u,
          createdAt: new Date(u.createdAt as string),
          updatedAt: new Date(u.updatedAt as string),
        })),
        sessions: (parsed.sessions || []).map((s: Record<string, unknown>) => ({
          ...s,
          expiresAt: new Date(s.expiresAt as string),
          createdAt: new Date(s.createdAt as string),
        })),
        assistants: parsed.assistants || [],
      };
    }
  } catch (error) {
    console.error("Error loading database:", error);
  }
  return { users: [], sessions: [], assistants: [] };
}

function saveDb(db: Database): void {
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

// Database operations
export const db = {
  // User operations
  users: {
    findByUsername: (username: string): User | undefined => {
      const database = loadDb();
      return database.users.find((u) => u.username === username);
    },
    findById: (id: string): User | undefined => {
      const database = loadDb();
      return database.users.find((u) => u.id === id);
    },
    create: (user: User): User => {
      const database = loadDb();
      database.users.push(user);
      saveDb(database);
      return user;
    },
    update: (id: string, updates: Partial<User>): User | undefined => {
      const database = loadDb();
      const index = database.users.findIndex((u) => u.id === id);
      if (index === -1) {
        return undefined;
      }
      database.users[index] = { ...database.users[index], ...updates };
      saveDb(database);
      return database.users[index];
    },
  },

  // Session operations
  sessions: {
    findByToken: (token: string): Session | undefined => {
      const database = loadDb();
      return database.sessions.find((s) => s.token === token);
    },
    findByUserId: (userId: string): Session[] => {
      const database = loadDb();
      return database.sessions.filter((s) => s.userId === userId);
    },
    create: (session: Session): Session => {
      const database = loadDb();
      database.sessions.push(session);
      saveDb(database);
      return session;
    },
    delete: (token: string): boolean => {
      const database = loadDb();
      const index = database.sessions.findIndex((s) => s.token === token);
      if (index === -1) {
        return false;
      }
      database.sessions.splice(index, 1);
      saveDb(database);
      return true;
    },
    deleteByUserId: (userId: string): number => {
      const database = loadDb();
      const count = database.sessions.filter((s) => s.userId === userId).length;
      database.sessions = database.sessions.filter((s) => s.userId !== userId);
      saveDb(database);
      return count;
    },
    // Clean up expired sessions
    cleanExpired: (): number => {
      const database = loadDb();
      const now = new Date();
      const expired = database.sessions.filter(
        (s) => new Date(s.expiresAt) < now
      );
      database.sessions = database.sessions.filter(
        (s) => new Date(s.expiresAt) >= now
      );
      saveDb(database);
      return expired.length;
    },
  },

  // Assistants operations
  assistants: {
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
      return database.assistants.find(
        (a) => a.user_id === userId && a.is_default
      );
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
    update: (
      id: string,
      updates: Partial<Assistant>
    ): Assistant | undefined => {
      const database = loadDb();
      const index = database.assistants.findIndex((a) => a.id === id);
      if (index === -1) {
        return undefined;
      }
      database.assistants[index] = {
        ...database.assistants[index],
        ...updates,
        updated_at: new Date().toISOString(),
      };
      saveDb(database);
      return database.assistants[index];
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
      // Remove default from all user assistants
      database.assistants = database.assistants.map((a) => {
        if (a.user_id === userId) {
          return { ...a, is_default: a.id === assistantId };
        }
        return a;
      });
      saveDb(database);
      return true;
    },
  },
};

export type { User, Session, Assistant };
