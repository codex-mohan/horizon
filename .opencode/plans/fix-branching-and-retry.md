# Fix Branching and Retry Issues - Implementation Plan

## Status: COMPLETED

## Changes Made

### Phase 1: Fix Shell Executor (Critical) ✅
**File:** `packages/agent-tools/src/shell/executor.ts`

- Replaced direct `import { $ } from "bun"` with conditional loading
- Added `tryImportBun()` function that dynamically imports bun if available
- Added `isNodeEnvironment()` detection using env vars (`LANGGRAPH_CLI`, `USING_LANGGRAPH_CLI`, `NODE_ENV`)
- Added `executeWithBun()` and `executeWithNodeSpawn()` methods
- Added `useBunShell` config option for manual override
- Added `isUsingBunShell()` method for debugging
- When running under LangGraph CLI, automatically uses Node spawn instead of bun

### Phase 2: Fix Frontend Submit with Checkpoints ✅
**File:** `apps/web/lib/chat.ts`

- Fixed `submit()` to properly place `checkpoint_id` in `config.configurable`
- Now correctly passes checkpoint for branching support:
  ```typescript
  config.configurable.checkpoint_id = options.checkpoint.checkpoint_id
  ```

### Phase 3: Fix Checkpointer Parent Tracking ✅
**File:** `apps/agent/src/agent/fs-checkpointer.ts`

- Rewrote storage structure to use `Record<string, StoredCheckpoint>` for efficient lookups
- Fixed `put()` to properly track parent checkpoint relationships
- Fixed `getTuple()` to correctly retrieve checkpoints with parent info
- Fixed `list()` to return checkpoints in chronological order
- Added helper methods: `getCheckpointIds()`, `getCheckpoint()`

### Phase 4: Fix Backend Streaming Endpoint ✅
**File:** `apps/agent/src/index.ts`

- Added `checkpoint_id` extraction to `runConfig` for streaming endpoint
- Ensures `configurable.checkpoint_id` is passed to graph when branching

## How It Works Now

1. **Edit Message**: Frontend gets `parent_checkpoint` from message metadata, submits with `checkpoint_id`
2. **Backend**: Graph resumes from the specified checkpoint, creating a new branch
3. **Checkpointer**: Stores the new checkpoint with proper parent relationship
4. **History**: Returns full checkpoint tree for branch navigation

## Environment Detection

The shell executor automatically detects Node.js environments:
- `LANGGRAPH_CLI=true` → Use Node spawn
- `USING_LANGGRAPH_CLI=true` → Use Node spawn
- `NODE_ENV=test` → Use Node spawn
- Otherwise → Try bun, fall back to Node spawn if unavailable
