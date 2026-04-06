import fs from "node:fs";
import path from "node:path";
import { getGlobalDataDir } from "@horizon/shared-utils";

function getArtifactsDbPath(): string {
  return path.join(getGlobalDataDir(), "artifacts.json");
}

interface StoredArtifact {
  id: string;
  threadId: string;
  title: string;
  fileName: string;
  type: string;
  language?: string;
  content: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface ArtifactsDb {
  artifacts: StoredArtifact[];
}

function loadArtifactsDb(): ArtifactsDb {
  try {
    getGlobalDataDir();
    const p = getArtifactsDbPath();
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch (error) {
    console.error("[Artifacts] Error loading database:", error);
  }
  return { artifacts: [] };
}

function saveArtifactsDb(db: ArtifactsDb): void {
  getGlobalDataDir();
  fs.writeFileSync(getArtifactsDbPath(), JSON.stringify(db, null, 2));
}

async function formatContent(content: string, type: string, language?: string): Promise<string> {
  try {
    const prettier = await import("prettier");
    let parser: string | null = null;
    switch (type) {
      case "html":
        parser = "html";
        break;
      case "react":
        parser = "babel";
        break;
      case "markdown":
        parser = "markdown";
        break;
      case "code": {
        const lang = (language || "").toLowerCase();
        if (["js", "javascript", "jsx"].includes(lang)) parser = "babel";
        else if (["ts", "typescript"].includes(lang)) parser = "typescript";
        else if (["tsx"].includes(lang)) parser = "babel-ts";
        else if (["json", "jsonc"].includes(lang)) parser = "json";
        else if (["css", "scss", "less"].includes(lang)) parser = "css";
        else if (["html"].includes(lang)) parser = "html";
        else if (["md", "markdown"].includes(lang)) parser = "markdown";
        break;
      }
      default:
        return content;
    }
    if (!parser) return content;
    return await prettier.default.format(content, {
      parser,
      printWidth: 100,
      tabWidth: 2,
      useTabs: false,
      semi: true,
      singleQuote: false,
      trailingComma: "es5",
      bracketSameLine: false,
    });
  } catch (err) {
    console.warn(
      `[Artifacts] Prettier formatting failed for type=${type} lang=${language}:`,
      err instanceof Error ? err.message : err
    );
    return content;
  }
}

// ─── create_artifact ──────────────────────────────────────────────────────────
// threadId is now an explicit parameter (no longer pulled from LangChain config)

async function createArtifactFn({
  title,
  fileName,
  type,
  content,
  language,
  threadId = "unknown",
}: {
  title: string;
  fileName: string;
  type: string;
  content: string;
  language?: string;
  threadId?: string;
}): Promise<string> {
  const formattedContent = await formatContent(content, type, language);
  const now = new Date().toISOString();
  const db = loadArtifactsDb();
  const existingIndex = db.artifacts.findIndex(
    (a) => a.threadId === threadId && a.title === title && a.type === type
  );

  let artifact: StoredArtifact;
  if (existingIndex >= 0) {
    const existing = db.artifacts[existingIndex]!;
    artifact = {
      ...existing,
      fileName: fileName || existing.fileName,
      language: language ?? existing.language,
      content: formattedContent,
      version: existing.version + 1,
      updatedAt: now,
    };
    db.artifacts[existingIndex] = artifact;
  } else {
    artifact = {
      id: `artifact-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      threadId,
      title,
      fileName,
      type,
      language,
      content: formattedContent,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    db.artifacts.push(artifact);
  }

  saveArtifactsDb(db);
  console.log(
    `[Artifacts] Created artifact: ${artifact.id} (${artifact.title}, ${artifact.type}, v${artifact.version})`
  );

  return JSON.stringify({
    id: artifact.id,
    title: artifact.title,
    fileName: artifact.fileName,
    type: artifact.type,
    language: artifact.language,
    version: artifact.version,
  });
}

// ─── present_artifact ─────────────────────────────────────────────────────────

async function presentArtifactFn({ artifact_id }: { artifact_id: string }): Promise<string> {
  const db = loadArtifactsDb();
  const query = artifact_id.trim();
  const slugify = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  const artifact =
    db.artifacts.find((a) => a.id === query) ||
    db.artifacts.find(
      (a) => a.fileName === query || a.fileName.replace(/\.[^.]+$/, "") === query
    ) ||
    db.artifacts.find((a) => a.title.toLowerCase() === query.toLowerCase()) ||
    db.artifacts.find(
      (a) => slugify(a.title) === slugify(query) || slugify(a.fileName) === slugify(query)
    ) ||
    (db.artifacts.length > 0 ? db.artifacts[db.artifacts.length - 1] : null);

  if (!artifact) {
    return JSON.stringify({ error: `Artifact not found: ${artifact_id}` });
  }

  console.log(`[Artifacts] Presenting artifact: ${artifact.id} (${artifact.title})`);

  return JSON.stringify({
    id: artifact.id,
    title: artifact.title,
    fileName: artifact.fileName,
    type: artifact.type,
    language: artifact.language,
    content: artifact.content,
    version: artifact.version,
  });
}

// ─── Exported tool objects with .invoke() compat ─────────────────────────────

export const createArtifactTool = { invoke: createArtifactFn };
export const presentArtifactTool = { invoke: presentArtifactFn };
