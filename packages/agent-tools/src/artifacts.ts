import fs from "node:fs";
import path from "node:path";
import { getGlobalDataDir } from "@horizon/shared-utils";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

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

function ensureDataDir() {
  getGlobalDataDir(); // This creates the directory if it doesn't exist
}

function loadArtifactsDb(): ArtifactsDb {
  try {
    ensureDataDir();
    const artifactsDbPath = getArtifactsDbPath();
    if (fs.existsSync(artifactsDbPath)) {
      return JSON.parse(fs.readFileSync(artifactsDbPath, "utf-8"));
    }
  } catch (error) {
    console.error("[Artifacts] Error loading database:", error);
  }
  return { artifacts: [] };
}

function saveArtifactsDb(db: ArtifactsDb): void {
  ensureDataDir();
  const artifactsDbPath = getArtifactsDbPath();
  fs.writeFileSync(artifactsDbPath, JSON.stringify(db, null, 2));
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

    const formatted = await prettier.default.format(content, {
      parser,
      printWidth: 100,
      tabWidth: 2,
      useTabs: false,
      semi: true,
      singleQuote: false,
      trailingComma: "es5",
      bracketSameLine: false,
    });

    return formatted;
  } catch (err) {
    console.warn(
      `[Artifacts] Prettier formatting failed for type=${type} lang=${language}:`,
      err instanceof Error ? err.message : err
    );
    return content;
  }
}

export const createArtifactTool = tool(
  async (
    {
      title,
      fileName,
      type,
      content,
      language,
    }: {
      title: string;
      fileName: string;
      type: string;
      content: string;
      language?: string;
    },
    config
  ) => {
    const threadId =
      ((config?.configurable as Record<string, unknown>)?.thread_id as string) || "unknown";

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
        id: existing.id,
        threadId: existing.threadId,
        title: existing.title,
        fileName: fileName || existing.fileName,
        type: existing.type,
        language: language ?? existing.language,
        content: formattedContent,
        version: existing.version + 1,
        createdAt: existing.createdAt,
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
  },
  {
    name: "create_artifact",
    description:
      "Create a renderable artifact (HTML page, SVG graphic, Mermaid diagram, React component, or code file). " +
      "The artifact is stored and can be presented to the user with present_artifact. " +
      "Use this for substantial, standalone content the user would want to preview, interact with, or download. " +
      "Do NOT use for short code snippets in explanations — use regular code blocks for those.",
    schema: z.object({
      title: z
        .string()
        .describe(
          "Display title shown to the user (e.g., 'Coffee Shop Landing Page', 'Architecture Diagram')"
        ),
      fileName: z
        .string()
        .describe(
          "File name for the artifact with extension (e.g., 'landing-page.html', 'logo.svg', 'diagram.mmd')"
        ),
      type: z
        .enum(["html", "svg", "mermaid", "react", "code", "markdown"])
        .describe(
          "Content type. html=full HTML page, svg=SVG markup, mermaid=diagram syntax, react=single-file component, code=downloadable file, markdown=document"
        ),
      content: z
        .string()
        .describe(
          "The full artifact content. For HTML: include ALL CSS/JS inline. For SVG: complete <svg> element. For React: export default function App component. Must be completely self-contained."
        ),
      language: z
        .string()
        .optional()
        .describe("Programming language for code artifacts (e.g., 'python', 'typescript')"),
    }),
  }
);

export const presentArtifactTool = tool(
  async ({ artifact_id }: { artifact_id: string }) => {
    const db = loadArtifactsDb();
    const query = artifact_id.trim();

    let artifact = db.artifacts.find((a) => a.id === query);

    if (!artifact) {
      artifact = db.artifacts.find(
        (a) => a.fileName === query || a.fileName.replace(/\.[^.]+$/, "") === query
      );
    }

    if (!artifact) {
      const lowerQuery = query.toLowerCase();
      artifact = db.artifacts.find((a) => a.title.toLowerCase() === lowerQuery);
    }

    if (!artifact) {
      const slugify = (s: string) =>
        s
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
      const querySlug = slugify(query);
      artifact = db.artifacts.find(
        (a) => slugify(a.title) === querySlug || slugify(a.fileName) === querySlug
      );
    }

    if (!artifact && db.artifacts.length > 0) {
      artifact = db.artifacts[db.artifacts.length - 1]!;
      console.log(`[Artifacts] Fuzzy fallback: presenting most recent artifact: ${artifact.id}`);
    }

    if (!artifact) {
      return JSON.stringify({
        error: `Artifact not found: ${artifact_id}`,
      });
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
  },
  {
    name: "present_artifact",
    description:
      "Display a previously created artifact to the user. " +
      "IMPORTANT: Use the exact 'id' field returned by create_artifact (e.g., 'artifact-1709712345678-x7k2m9'). " +
      "Do NOT make up an ID or use the title — use the literal ID string from the create_artifact result. " +
      "The user can then click the card to preview the artifact in the viewer panel.",
    schema: z.object({
      artifact_id: z
        .string()
        .describe("The ID of the artifact to present (returned by create_artifact)"),
    }),
  }
);
