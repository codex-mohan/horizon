import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

interface ArtifactRecord {
    id: string;
    threadId: string;
    messageId: string;
    title: string;
    type: string;
    language?: string;
    content: string;
    version: number;
    createdAt: string;
    updatedAt: string;
}

interface ArtifactsDb {
    artifacts: ArtifactRecord[];
}

const dataDir = path.join(process.cwd(), "data");
const dbPath = path.join(dataDir, "artifacts.json");

function ensureDataDir() {
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
}

function loadArtifactsDb(): ArtifactsDb {
    try {
        ensureDataDir();
        if (fs.existsSync(dbPath)) {
            const data = fs.readFileSync(dbPath, "utf-8");
            return JSON.parse(data);
        }
    } catch (error) {
        console.error("[Artifacts API] Error loading database:", error);
    }
    return { artifacts: [] };
}

function saveArtifactsDb(db: ArtifactsDb): void {
    ensureDataDir();
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

/**
 * GET /api/artifacts?threadId=xxx
 * List artifacts — optionally filtered by threadId
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const threadId = searchParams.get("threadId");

    const db = loadArtifactsDb();
    const artifacts = threadId
        ? db.artifacts.filter((a) => a.threadId === threadId)
        : db.artifacts;

    return NextResponse.json({ artifacts });
}

/**
 * POST /api/artifacts
 * Create a new artifact
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { id, threadId, messageId, title, type, language, content, version } = body;

        if (!id || !threadId || !title || !type || !content) {
            return NextResponse.json(
                { error: "Missing required fields: id, threadId, title, type, content" },
                { status: 400 }
            );
        }

        const now = new Date().toISOString();
        const artifact: ArtifactRecord = {
            id,
            threadId,
            messageId: messageId || "",
            title,
            type,
            language,
            content,
            version: version || 1,
            createdAt: now,
            updatedAt: now,
        };

        const db = loadArtifactsDb();

        // Check for existing artifact with same title+type in thread (version update)
        const existingIndex = db.artifacts.findIndex(
            (a) => a.threadId === threadId && a.title === title && a.type === type
        );

        if (existingIndex >= 0) {
            artifact.id = db.artifacts[existingIndex].id;
            artifact.version = db.artifacts[existingIndex].version + 1;
            artifact.createdAt = db.artifacts[existingIndex].createdAt;
            db.artifacts[existingIndex] = artifact;
        } else {
            db.artifacts.push(artifact);
        }

        saveArtifactsDb(db);
        return NextResponse.json({ artifact }, { status: 201 });
    } catch (error) {
        console.error("[Artifacts API] Create error:", error);
        return NextResponse.json({ error: "Failed to create artifact" }, { status: 500 });
    }
}

/**
 * DELETE /api/artifacts?id=xxx
 * Delete an artifact by ID
 */
export async function DELETE(request: Request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
        return NextResponse.json({ error: "Missing artifact id" }, { status: 400 });
    }

    const db = loadArtifactsDb();
    const index = db.artifacts.findIndex((a) => a.id === id);

    if (index === -1) {
        return NextResponse.json({ error: "Artifact not found" }, { status: 404 });
    }

    db.artifacts.splice(index, 1);
    saveArtifactsDb(db);

    return NextResponse.json({ success: true });
}
