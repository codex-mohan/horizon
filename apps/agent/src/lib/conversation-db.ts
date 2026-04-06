import path from "node:path";
import { getGlobalDataDir } from "@horizon/shared-utils";
import Database from "better-sqlite3";

const DB_PATH = path.join(getGlobalDataDir(), "agent-conversations.db");

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (db) return db;

  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      thread_id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      metadata TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'idle'
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      thread_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (thread_id) REFERENCES conversations(thread_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC);
  `);

  return db;
}

export interface ConversationRecord {
  threadId: string;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
  status: string;
}

export interface MessageRecord {
  id: number;
  threadId: string;
  role: string;
  content: string;
  createdAt: string;
}

export const conversationStore = {
  createConversation(threadId: string, metadata: Record<string, unknown> = {}): ConversationRecord {
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(
      "INSERT OR IGNORE INTO conversations (thread_id, created_at, updated_at, metadata) VALUES (?, ?, ?, ?)"
    ).run(threadId, now, now, JSON.stringify(metadata));

    return {
      threadId,
      createdAt: now,
      updatedAt: now,
      metadata,
      status: "idle",
    };
  },

  getConversation(threadId: string): ConversationRecord | null {
    const db = getDb();
    const row = db.prepare("SELECT * FROM conversations WHERE thread_id = ?").get(threadId) as
      | {
          thread_id: string;
          created_at: string;
          updated_at: string;
          metadata: string;
          status: string;
        }
      | undefined;

    if (!row) return null;

    return {
      threadId: row.thread_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      metadata: JSON.parse(row.metadata),
      status: row.status,
    };
  },

  updateConversation(
    threadId: string,
    metadata: Record<string, unknown>
  ): ConversationRecord | null {
    const db = getDb();
    const now = new Date().toISOString();
    const existing = this.getConversation(threadId);

    if (!existing) {
      return this.createConversation(threadId, metadata);
    }

    const merged = { ...existing.metadata, ...metadata };
    db.prepare("UPDATE conversations SET updated_at = ?, metadata = ? WHERE thread_id = ?").run(
      now,
      JSON.stringify(merged),
      threadId
    );

    return {
      threadId,
      createdAt: existing.createdAt,
      updatedAt: now,
      metadata: merged,
      status: existing.status,
    };
  },

  deleteConversation(threadId: string): boolean {
    const db = getDb();
    const result = db.prepare("DELETE FROM conversations WHERE thread_id = ?").run(threadId);
    return result.changes > 0;
  },

  listConversations(
    limit = 100,
    offset = 0,
    metadataFilter?: Record<string, unknown>
  ): ConversationRecord[] {
    const db = getDb();
    let query = "SELECT * FROM conversations ORDER BY updated_at DESC LIMIT ? OFFSET ?";
    const params: (string | number)[] = [limit, offset];

    if (metadataFilter && Object.keys(metadataFilter).length > 0) {
      const conditions = Object.keys(metadataFilter)
        .map((key) => `json_extract(metadata, '$.${key}') = ?`)
        .join(" AND ");
      query = `SELECT * FROM conversations WHERE ${conditions} ORDER BY updated_at DESC LIMIT ? OFFSET ?`;
      params.unshift(...(Object.values(metadataFilter) as (string | number)[]));
    }

    const rows = db.prepare(query).all(...params) as Array<{
      thread_id: string;
      created_at: string;
      updated_at: string;
      metadata: string;
      status: string;
    }>;

    return rows.map((row) => ({
      threadId: row.thread_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      metadata: JSON.parse(row.metadata),
      status: row.status,
    }));
  },

  saveMessages(threadId: string, messages: Array<Record<string, unknown>>): void {
    const db = getDb();
    const insert = db.prepare("INSERT INTO messages (thread_id, role, content) VALUES (?, ?, ?)");

    const insertMany = db.transaction((msgs: Array<Record<string, unknown>>) => {
      for (const msg of msgs) {
        // Store the ENTIRE message object so all pi-agent fields are preserved:
        // timestamp, id, stopReason, usage, toolCallId, toolName, content, etc.
        insert.run(threadId, String(msg.role ?? ""), JSON.stringify(msg));
      }
    });

    insertMany(messages);

    db.prepare("UPDATE conversations SET updated_at = datetime('now') WHERE thread_id = ?").run(
      threadId
    );
  },

  getMessages(threadId: string): Array<Record<string, unknown>> {
    const db = getDb();
    const rows = db
      .prepare("SELECT role, content FROM messages WHERE thread_id = ? ORDER BY id ASC")
      .all(threadId) as Array<{ role: string; content: string }>;

    return rows.map((row) => {
      try {
        const parsed = JSON.parse(row.content);
        // New format: content column holds the entire message object
        if (parsed && typeof parsed === "object" && "role" in parsed) {
          return parsed as Record<string, unknown>;
        }
        // Old format: content column holds only the message content field
        return { role: row.role, content: parsed, timestamp: Date.now() };
      } catch {
        return { role: row.role, content: row.content, timestamp: Date.now() };
      }
    });
  },

  clearMessages(threadId: string): void {
    const db = getDb();
    db.prepare("DELETE FROM messages WHERE thread_id = ?").run(threadId);
  },

  close(): void {
    if (db) {
      db.close();
      db = null;
    }
  },
};
