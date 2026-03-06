import fs from "node:fs";
import path from "node:path";
import { type NextRequest, NextResponse } from "next/server";

// Try LangGraph API checkpointer first, fallback to simple checkpoints
const LANGGRAPH_CHECKPOINTER = path.resolve(
  process.cwd(),
  "../backend/.langgraph_api/.langgraphjs_api.checkpointer.json"
);
const SIMPLE_CHECKPOINTS = path.resolve(process.cwd(), "../backend/.checkpoints.json");

interface CheckpointData {
  v: number;
  id: string;
  ts: string;
  channel_values: Record<string, unknown>;
  channel_versions: Record<string, number>;
  versions_seen: Record<string, Record<string, number>>;
  pending_sends: unknown[];
}

interface CheckpointEntry {
  checkpoint: CheckpointData;
  metadata: {
    source: string;
    writes: unknown;
    step: number;
    parents: Record<string, unknown>;
  };
  parentConfig: {
    tags: string[];
    metadata: Record<string, unknown>;
    recursionLimit: number;
    configurable: Record<string, unknown>;
    signal: Record<string, unknown>;
  };
}

type CheckpointsData = Record<string, CheckpointEntry[]>;

// LangGraph API format
type LangGraphCheckpointer = {
  json: {
    storage: Record<string, Record<string, Record<string, string[]>>>;
  };
  meta: {
    values: {
      json: string[];
    };
    v: number;
  };
};

function decodeBase64Checkpoint(encoded: string): CheckpointEntry | null {
  try {
    const decoded = Buffer.from(encoded, "base64").toString("utf-8");
    const parsed = JSON.parse(decoded);

    // LangGraph format has checkpoint and metadata
    return {
      checkpoint: parsed.checkpoint || parsed,
      metadata: parsed.metadata || {
        source: "load",
        writes: null,
        step: 0,
        parents: {},
      },
      parentConfig: parsed.parentConfig || {
        tags: [],
        metadata: {},
        recursionLimit: 25,
        configurable: {},
        signal: {},
      },
    };
  } catch (e) {
    console.error("[Checkpoints API] Failed to decode checkpoint:", e);
    return null;
  }
}

function encodeBase64Checkpoint(entry: CheckpointEntry): string {
  const data = {
    checkpoint: entry.checkpoint,
    metadata: entry.metadata,
    parentConfig: entry.parentConfig,
  };
  return Buffer.from(JSON.stringify(data)).toString("base64");
}

function loadLangGraphCheckpoints(): CheckpointsData {
  try {
    if (fs.existsSync(LANGGRAPH_CHECKPOINTER)) {
      const content = fs.readFileSync(LANGGRAPH_CHECKPOINTER, "utf-8");
      const data: LangGraphCheckpointer = JSON.parse(content);

      const result: CheckpointsData = {};

      // Parse storage format: threadId -> namespace -> checkpointId -> [base64data, ...]
      for (const [threadId, namespaces] of Object.entries(data.json.storage)) {
        result[threadId] = [];

        for (const [namespace, checkpoints] of Object.entries(namespaces)) {
          for (const [checkpointId, checkpointData] of Object.entries(checkpoints)) {
            if (Array.isArray(checkpointData) && checkpointData.length > 0) {
              const decoded = decodeBase64Checkpoint(checkpointData[0]);
              if (decoded) {
                // Add namespace info to the checkpoint
                decoded.checkpoint.id = checkpointId;
                decoded.parentConfig.configurable = {
                  ...decoded.parentConfig.configurable,
                  checkpoint_ns: namespace,
                  thread_id: threadId,
                  checkpoint_id: checkpointId,
                };
                result[threadId].push(decoded);
              }
            }
          }
        }

        // Sort checkpoints by timestamp
        result[threadId].sort((a, b) => {
          const tsA = new Date(a.checkpoint.ts).getTime();
          const tsB = new Date(b.checkpoint.ts).getTime();
          return tsA - tsB;
        });
      }

      return result;
    }
  } catch (e) {
    console.error("[Checkpoints API] Failed to load LangGraph checkpoints:", e);
  }
  return {};
}

function loadSimpleCheckpoints(): CheckpointsData {
  try {
    if (fs.existsSync(SIMPLE_CHECKPOINTS)) {
      const content = fs.readFileSync(SIMPLE_CHECKPOINTS, "utf-8");
      return JSON.parse(content) as CheckpointsData;
    }
  } catch (e) {
    console.error("[Checkpoints API] Failed to load simple checkpoints:", e);
  }
  return {};
}

function loadCheckpoints(): CheckpointsData {
  // Try LangGraph format first, then fallback to simple format
  const langGraphData = loadLangGraphCheckpoints();
  if (Object.keys(langGraphData).length > 0) {
    return langGraphData;
  }
  return loadSimpleCheckpoints();
}

function saveLangGraphCheckpoints(data: CheckpointsData): boolean {
  try {
    // Read existing file to preserve structure
    let existingData: LangGraphCheckpointer = {
      json: { storage: {} },
      meta: { values: { json: ["map"] }, v: 1 },
    };

    if (fs.existsSync(LANGGRAPH_CHECKPOINTER)) {
      const content = fs.readFileSync(LANGGRAPH_CHECKPOINTER, "utf-8");
      existingData = JSON.parse(content);
    }

    // Update storage with new data
    for (const [threadId, checkpoints] of Object.entries(data)) {
      if (!existingData.json.storage[threadId]) {
        existingData.json.storage[threadId] = {};
      }

      for (const entry of checkpoints) {
        const ns = (entry.parentConfig.configurable?.checkpoint_ns as string) || "";
        const checkpointId = entry.checkpoint.id;

        if (!existingData.json.storage[threadId][ns]) {
          existingData.json.storage[threadId][ns] = {};
        }

        existingData.json.storage[threadId][ns][checkpointId] = [encodeBase64Checkpoint(entry)];
      }
    }

    fs.writeFileSync(LANGGRAPH_CHECKPOINTER, JSON.stringify(existingData, null, 2));
    return true;
  } catch (e) {
    console.error("[Checkpoints API] Failed to save LangGraph checkpoints:", e);
    return false;
  }
}

function saveSimpleCheckpoints(data: CheckpointsData): boolean {
  try {
    fs.writeFileSync(SIMPLE_CHECKPOINTS, JSON.stringify(data, null, 2));
    return true;
  } catch (e) {
    console.error("[Checkpoints API] Failed to save simple checkpoints:", e);
    return false;
  }
}

function saveCheckpoints(data: CheckpointsData): boolean {
  // Prefer saving to LangGraph format if it exists
  if (fs.existsSync(LANGGRAPH_CHECKPOINTER)) {
    return saveLangGraphCheckpoints(data);
  }
  return saveSimpleCheckpoints(data);
}

function isUsingLangGraphFormat(): boolean {
  return fs.existsSync(LANGGRAPH_CHECKPOINTER);
}

// GET - List all threads or get specific checkpoint
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const threadId = searchParams.get("threadId");
  const checkpointId = searchParams.get("checkpointId");

  const checkpoints = loadCheckpoints();

  // Return specific checkpoint
  if (threadId && checkpointId) {
    const threadCheckpoints = checkpoints[threadId] || [];
    const checkpoint = threadCheckpoints.find((c) => c.checkpoint.id === checkpointId);

    if (!checkpoint) {
      return NextResponse.json({ error: "Checkpoint not found" }, { status: 404 });
    }

    return NextResponse.json({ checkpoint });
  }

  // Return all checkpoints for a thread
  if (threadId) {
    const threadCheckpoints = checkpoints[threadId] || [];
    return NextResponse.json({
      threadId,
      checkpoints: threadCheckpoints,
      count: threadCheckpoints.length,
    });
  }

  // Return list of all threads with summary
  const threads = Object.entries(checkpoints).map(([id, checks]) => ({
    id,
    checkpointCount: checks.length,
    lastUpdated: checks.length > 0 ? checks[checks.length - 1]?.checkpoint.ts : null,
    firstCheckpointId: checks.length > 0 ? checks[0]?.checkpoint.id : null,
    lastCheckpointId: checks.length > 0 ? checks[checks.length - 1]?.checkpoint.id : null,
  }));

  return NextResponse.json({ threads, format: isUsingLangGraphFormat() ? "langgraph" : "simple" });
}

// PUT - Update a checkpoint
export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const threadId = searchParams.get("threadId");
    const checkpointId = searchParams.get("checkpointId");
    const body = await request.json();

    if (!threadId || !checkpointId) {
      return NextResponse.json(
        { error: "threadId and checkpointId are required" },
        { status: 400 }
      );
    }

    const checkpoints = loadCheckpoints();

    if (!checkpoints[threadId]) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    const checkpointIndex = checkpoints[threadId].findIndex(
      (c) => c.checkpoint.id === checkpointId
    );

    if (checkpointIndex === -1) {
      return NextResponse.json({ error: "Checkpoint not found" }, { status: 404 });
    }

    // Validate the checkpoint structure
    if (!body.checkpoint || typeof body.checkpoint !== "object") {
      return NextResponse.json({ error: "Invalid checkpoint data structure" }, { status: 400 });
    }

    // Update the checkpoint
    checkpoints[threadId][checkpointIndex] = {
      ...checkpoints[threadId][checkpointIndex],
      checkpoint: body.checkpoint,
      metadata: body.metadata || checkpoints[threadId][checkpointIndex].metadata,
    };

    if (saveCheckpoints(checkpoints)) {
      return NextResponse.json({
        success: true,
        message: "Checkpoint updated successfully",
      });
    } else {
      return NextResponse.json({ error: "Failed to save checkpoints" }, { status: 500 });
    }
  } catch (error) {
    console.error("[Checkpoints API] PUT error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE - Delete a thread or specific checkpoint
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const threadId = searchParams.get("threadId");
    const checkpointId = searchParams.get("checkpointId");

    if (!threadId) {
      return NextResponse.json({ error: "threadId is required" }, { status: 400 });
    }

    const checkpoints = loadCheckpoints();

    if (!checkpoints[threadId]) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    // Delete specific checkpoint
    if (checkpointId) {
      const initialLength = checkpoints[threadId].length;
      checkpoints[threadId] = checkpoints[threadId].filter((c) => c.checkpoint.id !== checkpointId);

      if (checkpoints[threadId].length === initialLength) {
        return NextResponse.json({ error: "Checkpoint not found" }, { status: 404 });
      }

      // Clean up empty threads
      if (checkpoints[threadId].length === 0) {
        delete checkpoints[threadId];
      }

      if (saveCheckpoints(checkpoints)) {
        return NextResponse.json({
          success: true,
          message: "Checkpoint deleted successfully",
        });
      }
    } else {
      // Delete entire thread
      delete checkpoints[threadId];

      if (saveCheckpoints(checkpoints)) {
        return NextResponse.json({
          success: true,
          message: "Thread deleted successfully",
        });
      }
    }

    return NextResponse.json({ error: "Failed to save checkpoints" }, { status: 500 });
  } catch (error) {
    console.error("[Checkpoints API] DELETE error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
