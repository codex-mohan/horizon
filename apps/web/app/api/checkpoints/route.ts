import fs from "node:fs";
import path from "node:path";
import { type NextRequest, NextResponse } from "next/server";

const LANGGRAPH_CHECKPOINTER = path.resolve(
  process.cwd(),
  "../agent/.langgraph_api/.langgraphjs_api.checkpointer.json"
);

interface CheckpointData {
  v: number;
  id: string;
  ts: string;
  channel_values: Record<string, unknown>;
  channel_versions: Record<string, number>;
  versions_seen: Record<string, Record<string, number>>;
  pending_sends?: unknown[];
}

interface CheckpointEntry {
  checkpoint: CheckpointData;
  metadata: {
    source: string;
    writes: unknown;
    step: number;
    parents: Record<string, unknown>;
    [key: string]: unknown; // LangGraph stores additional metadata fields
  };
  // entry[2] in the LangGraph checkpointer array: raw parent checkpoint ID string or null
  parentCheckpointId: string | null;
  // Internal: track the namespace for this checkpoint so we can save it back correctly
  _namespace: string;
}

type CheckpointsData = Record<string, CheckpointEntry[]>;

type LangGraphCheckpointer = {
  json: {
    storage: Record<string, Record<string, Record<string, (string | null)[]>>>;
  };
  meta: {
    values: {
      json: string[];
    };
    v: number;
  };
};

/**
 * Decodes a checkpoint entry from the LangGraph checkpointer file.
 *
 * Each checkpoint in the file is stored as a 3-element array:
 *   [0] = base64-encoded raw checkpoint data (v, id, ts, channel_values, etc.)
 *   [1] = base64-encoded metadata (source, step, writes, parents, plus langgraph config)
 *   [2] = raw parent checkpoint ID string OR null (NOT base64)
 */
function decodeCheckpointEntry(
  checkpointArray: (string | null)[],
  checkpointId: string,
  namespace: string,
  _threadId: string
): CheckpointEntry | null {
  try {
    if (!checkpointArray || checkpointArray.length === 0 || !checkpointArray[0]) {
      return null;
    }

    // Decode entry[0]: base64-encoded raw checkpoint data
    const checkpointData: CheckpointData = JSON.parse(
      Buffer.from(checkpointArray[0], "base64").toString("utf-8")
    );

    // Decode entry[1]: base64-encoded metadata
    let metadata: CheckpointEntry["metadata"] = {
      source: "unknown",
      writes: null,
      step: 0,
      parents: {},
    };
    if (checkpointArray[1]) {
      metadata = JSON.parse(Buffer.from(checkpointArray[1], "base64").toString("utf-8"));
    }

    // entry[2]: RAW parent checkpoint ID string (plain string, NOT base64)
    const parentCheckpointId = checkpointArray[2] ?? null;

    return {
      checkpoint: { ...checkpointData, id: checkpointId },
      metadata,
      parentCheckpointId,
      _namespace: namespace,
    };
  } catch (e) {
    console.error(`[Checkpoints API] Failed to decode checkpoint ${checkpointId}:`, e);
    return null;
  }
}

/**
 * Re-encodes a checkpoint entry back into the 3-element array format that
 * LangGraph expects: [base64_checkpoint, base64_metadata, parent_checkpoint_id_or_null]
 */
function encodeCheckpointEntry(entry: CheckpointEntry): (string | null)[] {
  // entry[0]: base64-encode the checkpoint data
  // LangGraph stores the id both as the object key AND inside the encoded data
  const encodedCheckpoint = Buffer.from(JSON.stringify(entry.checkpoint)).toString("base64");

  // entry[1]: base64-encode the metadata
  const encodedMetadata = entry.metadata
    ? Buffer.from(JSON.stringify(entry.metadata)).toString("base64")
    : null;

  // entry[2]: raw parent checkpoint ID string (NOT base64, just pass through as-is)
  const parentCheckpointId = entry.parentCheckpointId ?? null;

  return [encodedCheckpoint, encodedMetadata, parentCheckpointId];
}

function loadCheckpoints(): CheckpointsData {
  try {
    if (!fs.existsSync(LANGGRAPH_CHECKPOINTER)) {
      return {};
    }

    const content = fs.readFileSync(LANGGRAPH_CHECKPOINTER, "utf-8");
    const data: LangGraphCheckpointer = JSON.parse(content);

    const result: CheckpointsData = {};

    for (const [threadId, namespaces] of Object.entries(data.json.storage)) {
      result[threadId] = [];

      for (const [namespace, checkpoints] of Object.entries(namespaces)) {
        for (const [checkpointId, checkpointArray] of Object.entries(checkpoints)) {
          if (Array.isArray(checkpointArray) && checkpointArray.length > 0) {
            const decoded = decodeCheckpointEntry(
              checkpointArray,
              checkpointId,
              namespace,
              threadId
            );
            if (decoded) {
              result[threadId].push(decoded);
            }
          }
        }
      }

      result[threadId].sort((a, b) => {
        const tsA = new Date(a.checkpoint.ts).getTime();
        const tsB = new Date(b.checkpoint.ts).getTime();
        return tsA - tsB;
      });
    }

    return result;
  } catch (e) {
    console.error("[Checkpoints API] Failed to load checkpoints:", e);
    return {};
  }
}

function saveCheckpoints(data: CheckpointsData): boolean {
  try {
    console.log("[Checkpoints API] saveCheckpoints invoked with data keys:", Object.keys(data));
    if (!fs.existsSync(LANGGRAPH_CHECKPOINTER)) {
      console.error("[Checkpoints API] Checkpointer file not found:", LANGGRAPH_CHECKPOINTER);
      return false;
    }

    const content = fs.readFileSync(LANGGRAPH_CHECKPOINTER, "utf-8");
    const existingData: LangGraphCheckpointer = JSON.parse(content);
    console.log("[Checkpoints API] Loaded existing checkpointer file");

    for (const [threadId, checkpoints] of Object.entries(data)) {
      console.log(
        `[Checkpoints API] Processing thread ${threadId} with ${checkpoints.length} checkpoints`
      );
      // Rebuild the thread data to ensure renamed/deleted checkpoints are removed
      existingData.json.storage[threadId] = {};

      for (const entry of checkpoints) {
        // Use the tracked _namespace. Empty string is a valid namespace (it's the main graph).
        const ns = entry._namespace;
        const checkpointId = entry.checkpoint.id;

        if (ns === undefined || ns === null) {
          console.warn(
            `[Checkpoints API] Undefined namespace for checkpoint ${checkpointId}, defaulting to ""`
          );
        }

        const resolvedNs = ns ?? "";

        if (!existingData.json.storage[threadId][resolvedNs]) {
          existingData.json.storage[threadId][resolvedNs] = {};
        }

        existingData.json.storage[threadId][resolvedNs][checkpointId] =
          encodeCheckpointEntry(entry);

        console.log(
          `[Checkpoints API] Wrote checkpoint ${checkpointId} to namespace "${resolvedNs}"`
        );
      }
    }

    console.log("[Checkpoints API] About to write to", LANGGRAPH_CHECKPOINTER);
    fs.writeFileSync(LANGGRAPH_CHECKPOINTER, JSON.stringify(existingData, null, 2));
    console.log("[Checkpoints API] Checkpoints saved successfully");
    return true;
  } catch (e) {
    console.error("[Checkpoints API] Failed to save checkpoints:", e);
    return false;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const threadId = searchParams.get("threadId");
  const checkpointId = searchParams.get("checkpointId");

  const checkpoints = loadCheckpoints();

  if (threadId && checkpointId) {
    const threadCheckpoints = checkpoints[threadId] || [];
    const checkpoint = threadCheckpoints.find((c) => c.checkpoint.id === checkpointId);

    if (!checkpoint) {
      return NextResponse.json({ error: "Checkpoint not found" }, { status: 404 });
    }

    // Strip internal _namespace before sending to client
    const { _namespace, ...rest } = checkpoint;
    return NextResponse.json({ checkpoint: rest });
  }

  if (threadId) {
    const threadCheckpoints = checkpoints[threadId] || [];
    // Strip internal _namespace before sending to client
    const sanitized = threadCheckpoints.map(({ _namespace, ...rest }) => rest);
    return NextResponse.json({
      threadId,
      checkpoints: sanitized,
      count: sanitized.length,
    });
  }

  const threads = Object.entries(checkpoints).map(([id, checks]) => ({
    id,
    checkpointCount: checks.length,
    lastUpdated: checks.length > 0 ? checks[checks.length - 1]?.checkpoint.ts : null,
    firstCheckpointId: checks.length > 0 ? checks[0]?.checkpoint.id : null,
    lastCheckpointId: checks.length > 0 ? checks[checks.length - 1]?.checkpoint.id : null,
  }));

  return NextResponse.json({ threads });
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const threadId = searchParams.get("threadId");
    const checkpointId = searchParams.get("checkpointId");
    const body = await request.json();

    console.log(
      `[Checkpoints API] PUT requested for thread=${threadId}, checkpoint=${checkpointId}`
    );
    console.log(`[Checkpoints API] PUT body keys:`, Object.keys(body));

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

    if (!body.checkpoint || typeof body.checkpoint !== "object") {
      return NextResponse.json({ error: "Invalid checkpoint data structure" }, { status: 400 });
    }

    const existing = checkpoints[threadId][checkpointIndex];

    // Update checkpoint and metadata while preserving _namespace and parentCheckpointId
    checkpoints[threadId][checkpointIndex] = {
      ...existing,
      checkpoint: body.checkpoint,
      metadata: body.metadata || existing.metadata,
      parentCheckpointId:
        body.parentCheckpointId !== undefined
          ? body.parentCheckpointId
          : existing.parentCheckpointId,
      // Preserve _namespace - this is critical for saving back to the correct location
      _namespace: existing._namespace,
    };

    // Only save the specific thread that was modified, not all threads
    const threadOnlyData: CheckpointsData = {
      [threadId]: checkpoints[threadId],
    };

    console.log(`[Checkpoints API] Calling saveCheckpoints with modified threadData`);
    if (saveCheckpoints(threadOnlyData)) {
      console.log(`[Checkpoints API] saveCheckpoints succeeded`);
      return NextResponse.json({
        success: true,
        message: "Checkpoint updated successfully",
      });
    } else {
      console.error(`[Checkpoints API] saveCheckpoints returned false`);
      return NextResponse.json({ error: "Failed to save checkpoints" }, { status: 500 });
    }
  } catch (error) {
    console.error("[Checkpoints API] PUT error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const threadId = searchParams.get("threadId");
    const checkpointId = searchParams.get("checkpointId");

    if (!threadId) {
      return NextResponse.json({ error: "threadId is required" }, { status: 400 });
    }

    if (!fs.existsSync(LANGGRAPH_CHECKPOINTER)) {
      return NextResponse.json({ error: "Checkpointer file not found" }, { status: 500 });
    }

    // For delete operations, modify the raw file directly to avoid
    // round-trip encoding issues
    const content = fs.readFileSync(LANGGRAPH_CHECKPOINTER, "utf-8");
    const existingData: LangGraphCheckpointer = JSON.parse(content);

    if (!existingData.json.storage[threadId]) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    if (checkpointId) {
      // Delete a specific checkpoint from all namespaces
      let found = false;
      for (const ns of Object.keys(existingData.json.storage[threadId])) {
        if (existingData.json.storage[threadId][ns][checkpointId]) {
          delete existingData.json.storage[threadId][ns][checkpointId];
          found = true;

          // Clean up empty namespace
          if (Object.keys(existingData.json.storage[threadId][ns]).length === 0) {
            delete existingData.json.storage[threadId][ns];
          }
        }
      }

      if (!found) {
        return NextResponse.json({ error: "Checkpoint not found" }, { status: 404 });
      }

      // Clean up empty thread
      if (Object.keys(existingData.json.storage[threadId]).length === 0) {
        delete existingData.json.storage[threadId];
      }
    } else {
      // Delete entire thread
      delete existingData.json.storage[threadId];
    }

    fs.writeFileSync(LANGGRAPH_CHECKPOINTER, JSON.stringify(existingData, null, 2));

    return NextResponse.json({
      success: true,
      message: checkpointId ? "Checkpoint deleted successfully" : "Thread deleted successfully",
    });
  } catch (error) {
    console.error("[Checkpoints API] DELETE error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
