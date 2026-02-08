import { Hono } from "hono";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import type { Assistant } from "./types.js";

// Extend Hono context with db
interface Variables {
  db: {
    assistants: {
      findById: (id: string) => Assistant | undefined;
      findByUserId: (userId: string) => Assistant[];
      findDefault: (userId: string) => Assistant | undefined;
      findPublic: () => Assistant[];
      create: (assistant: Assistant) => Assistant;
      update: (
        id: string,
        updates: Partial<Assistant>,
      ) => Assistant | undefined;
      delete: (id: string) => boolean;
      setDefault: (userId: string, assistantId: string) => boolean;
    };
  };
}

const app = new Hono<{ Variables: Variables }>();

// Ensure avatars directory exists
const avatarsDir = path.join(process.cwd(), "public", "avatars");
if (!fs.existsSync(avatarsDir)) {
  fs.mkdirSync(avatarsDir, { recursive: true });
}

/**
 * GET /assistants
 * List all assistants for the user
 */
app.get("/", async (c) => {
  const userId = c.req.query("user_id");
  const includePublic = c.req.query("include_public") === "true";

  if (!userId) {
    return c.json({ error: "user_id is required" }, 400);
  }

  const userAssistants = c.var.db.assistants.findByUserId(userId);

  if (includePublic) {
    const publicAssistants = c.var.db.assistants
      .findPublic()
      .filter((a) => a.user_id !== userId);
    return c.json([...userAssistants, ...publicAssistants]);
  }

  return c.json(userAssistants);
});

/**
 * GET /assistants/:id
 * Get a specific assistant
 */
app.get("/:id", async (c) => {
  const id = c.req.param("id");
  const assistant = c.var.db.assistants.findById(id);

  if (!assistant) {
    return c.json({ error: "Assistant not found" }, 404);
  }

  return c.json(assistant);
});

/**
 * POST /assistants
 * Create a new assistant
 */
app.post("/", async (c) => {
  const userId = c.req.query("user_id");

  if (!userId) {
    return c.json({ error: "user_id is required" }, 400);
  }

  const data = await c.req.json();

  const assistant: Assistant = {
    id: uuidv4(),
    user_id: userId,
    name: data.name,
    description: data.description || "",
    avatar_url: data.avatar_url,
    system_prompt: data.system_prompt,
    model_provider: data.model_provider || "groq",
    model_name: data.model_name || "meta-llama/llama-4-scout-17b-16e-instruct",
    temperature: data.temperature ?? 0.7,
    max_tokens: data.max_tokens ?? 4096,
    tools: data.tools || [],
    memory_enabled: data.memory_enabled ?? true,
    is_default: false,
    is_public: data.is_public ?? false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const created = c.var.db.assistants.create(assistant);

  // If this is the first assistant, make it default
  const userAssistants = c.var.db.assistants.findByUserId(userId);
  if (userAssistants.length === 1) {
    c.var.db.assistants.setDefault(userId, created.id);
    created.is_default = true;
  }

  return c.json(created, 201);
});

/**
 * PUT /assistants/:id
 * Update an assistant
 */
app.put("/:id", async (c) => {
  const id = c.req.param("id");
  const userId = c.req.query("user_id");

  if (!userId) {
    return c.json({ error: "user_id is required" }, 400);
  }

  const assistant = c.var.db.assistants.findById(id);
  if (!assistant) {
    return c.json({ error: "Assistant not found" }, 404);
  }

  if (assistant.user_id !== userId) {
    return c.json({ error: "Unauthorized" }, 403);
  }

  const data = await c.req.json();

  const updates: Partial<Assistant> = {
    ...data,
    updated_at: new Date().toISOString(),
  };

  const updated = c.var.db.assistants.update(id, updates);
  return c.json(updated);
});

/**
 * DELETE /assistants/:id
 * Delete an assistant
 */
app.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const userId = c.req.query("user_id");

  if (!userId) {
    return c.json({ error: "user_id is required" }, 400);
  }

  const assistant = c.var.db.assistants.findById(id);
  if (!assistant) {
    return c.json({ error: "Assistant not found" }, 404);
  }

  if (assistant.user_id !== userId) {
    return c.json({ error: "Unauthorized" }, 403);
  }

  c.var.db.assistants.delete(id);
  return c.json({ success: true });
});

/**
 * POST /assistants/:id/default
 * Set assistant as default
 */
app.post("/:id/default", async (c) => {
  const id = c.req.param("id");
  const userId = c.req.query("user_id");

  if (!userId) {
    return c.json({ error: "user_id is required" }, 400);
  }

  const assistant = c.var.db.assistants.findById(id);
  if (!assistant) {
    return c.json({ error: "Assistant not found" }, 404);
  }

  if (assistant.user_id !== userId) {
    return c.json({ error: "Unauthorized" }, 403);
  }

  c.var.db.assistants.setDefault(userId, id);
  return c.json({ success: true });
});

/**
 * POST /assistants/:id/clone
 * Clone a public assistant
 */
app.post("/:id/clone", async (c) => {
  const id = c.req.param("id");
  const userId = c.req.query("user_id");

  if (!userId) {
    return c.json({ error: "user_id is required" }, 400);
  }

  const assistant = c.var.db.assistants.findById(id);
  if (!assistant) {
    return c.json({ error: "Assistant not found" }, 404);
  }

  if (!assistant.is_public && assistant.user_id !== userId) {
    return c.json({ error: "Assistant is not public" }, 403);
  }

  const cloned: Assistant = {
    ...assistant,
    id: uuidv4(),
    user_id: userId,
    name: `${assistant.name} (Copy)`,
    is_default: false,
    is_public: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const created = c.var.db.assistants.create(cloned);
  return c.json(created, 201);
});

/**
 * POST /assistants/:id/avatar
 * Upload assistant avatar
 */
app.post("/:id/avatar", async (c) => {
  const id = c.req.param("id");
  const userId = c.req.query("user_id");

  if (!userId) {
    return c.json({ error: "user_id is required" }, 400);
  }

  const assistant = c.var.db.assistants.findById(id);
  if (!assistant) {
    return c.json({ error: "Assistant not found" }, 404);
  }

  if (assistant.user_id !== userId) {
    return c.json({ error: "Unauthorized" }, 403);
  }

  try {
    const body = await c.req.parseBody();
    const file = body.file as File;

    if (!file) {
      return c.json({ error: "No file uploaded" }, 400);
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      return c.json(
        {
          error: "Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed",
        },
        400,
      );
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return c.json({ error: "File too large. Maximum size is 5MB" }, 400);
    }

    // Generate unique filename
    const ext = path.extname(file.name) || ".png";
    const filename = `avatar-${id}-${Date.now()}${ext}`;
    const filepath = path.join(avatarsDir, filename);

    // Save file
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(filepath, buffer);

    // Generate URL (relative to public directory)
    const avatarUrl = `/avatars/${filename}`;

    // Update assistant with new avatar URL
    const updated = c.var.db.assistants.update(id, { avatar_url: avatarUrl });

    return c.json({
      success: true,
      avatar_url: avatarUrl,
      assistant: updated,
    });
  } catch (error) {
    console.error("[Avatar Upload] Error:", error);
    return c.json({ error: "Failed to upload avatar" }, 500);
  }
});

/**
 * DELETE /assistants/:id/avatar
 * Remove assistant avatar
 */
app.delete("/:id/avatar", async (c) => {
  const id = c.req.param("id");
  const userId = c.req.query("user_id");

  if (!userId) {
    return c.json({ error: "user_id is required" }, 400);
  }

  const assistant = c.var.db.assistants.findById(id);
  if (!assistant) {
    return c.json({ error: "Assistant not found" }, 404);
  }

  if (assistant.user_id !== userId) {
    return c.json({ error: "Unauthorized" }, 403);
  }

  try {
    // Remove file if it exists
    if (assistant.avatar_url) {
      const filename = path.basename(assistant.avatar_url);
      const filepath = path.join(avatarsDir, filename);
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
    }

    // Update assistant
    const updated = c.var.db.assistants.update(id, { avatar_url: undefined });
    return c.json({ success: true, assistant: updated });
  } catch (error) {
    console.error("[Avatar Delete] Error:", error);
    return c.json({ error: "Failed to remove avatar" }, 500);
  }
});

export default app;
