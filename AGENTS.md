# Horizon — Agent Coding Guidelines

> **Last Updated:** 2026-03-31
> **Maintained by:** AI coding agents working on Horizon

**This document is the single source of truth for AI coding agents working on this codebase. It must be updated whenever the project structure, architecture, configuration, or workflows change. If you make changes that affect how agents should work on this project, update this document immediately.**

---

## 1. Project Overview

**Horizon** is a privacy-focused, agentic AI assistant platform that bridges large language models with the user's local operating system. It enables users to have natural conversations with AI that can execute system commands, browse the web, manage files, and automate workflows — all from a modern, glassmorphic chat interface.

Think of it as an open, self-hosted alternative to products like Manus AI, but running entirely on your own PC. It is designed for power users, developers, and tinkerers who want deep OS-level integration with the intelligence of frontier LLMs, while retaining full control over their data and model choices.

### Tagline

> *"Past the Event Horizon, everything is possible."*

### Author

Mohana Krishna ([@codex-mohan](https://github.com/codex-mohan))

---

## 2. Problem Statement & Solution

### The Problem

Most AI assistants operate in a sandboxed bubble — they can generate text but cannot interact with the user's actual operating system. They can't execute terminal commands, read/write local files, browse the web for live data, or automate multi-step workflows. This creates a frustrating gap between what AI *knows* and what it can *do*.

### The Solution

Horizon provides a unified interface where AI meets your OS:

| Capability | Description |
|---|---|
| **System Operations** | Execute terminal commands, manage files, monitor system resources |
| **Browser Automation** | Search the web (DuckDuckGo), extract and summarize page content |
| **Multi-Model Support** | Switch between OpenAI, Anthropic, Google, Groq, NVIDIA NIM, or local Ollama models on-the-fly from the UI |
| **Human-in-the-Loop** | Review and approve dangerous tool calls before they execute |
| **Long-Term Memory** | Vector-based memory (Qdrant) for context that persists across conversations |
| **Custom Assistants** | Create task-specific AI personas with custom prompts and model preferences |
| **Privacy-First** | Run entirely locally with Ollama — no data leaves your machine |

### Use Cases

- **Developer Workflow Automation**: Ask the AI to scaffold a project, run tests, commit code, and explain errors — all through chat.
- **Research & Summarization**: Search the web, extract content from URLs, and get structured summaries.
- **System Administration**: Monitor system health, manage files, execute maintenance scripts with safety guardrails.
- **Learning & Mentoring**: Custom assistants can act as tutors (e.g., Socratic coaching loops) for guided learning.

---

## 3. Project Structure

This is a **Turborepo monorepo** using **Bun workspaces** (with `pnpm-workspace.yaml` for compatibility).

```text
Horizon/
├── apps/
│   ├── web/                          # Next.js 16 frontend (chat UI)
│   │   ├── app/                      # App Router pages & API routes
│   │   │   ├── api/auth/             # Auth API (login, register, me)
│   │   │   ├── api/checkpoints/      # Checkpoint management
│   │   │   ├── api/ollama/           # Ollama proxy endpoints
│   │   │   ├── auth/page.tsx         # Auth page
│   │   │   ├── chat/[threadId]/      # Dynamic conversation pages
│   │   │   ├── layout.tsx            # Root layout (fonts, theme, toaster)
│   │   │   └── page.tsx              # Home redirect
│   │   ├── components/
│   │   │   ├── chat/                 # Chat-specific components (31+ files)
│   │   │   │   └── generative-ui/   # Tool call renderers (shell, web search, artifacts, etc.)
│   │   │   ├── artifacts/            # ArtifactViewer, ArtifactIframe panels
│   │   │   ├── theme/                # Theme provider & switcher
│   │   │   ├── auth/                 # Auth components
│   │   │   ├── settings/             # Settings dialogs
│   │   │   ├── assistants/           # Assistant management
│   │   │   ├── markdown-view.tsx     # Rich markdown renderer (CodeBlock exported)
│   │   │   ├── mermaid-diagram.tsx   # Mermaid diagram component
│   │   │   └── login-form.tsx        # Login/register form
│   │   ├── lib/
│   │   │   ├── stores/               # Zustand state stores
│   │   │   │   ├── auth.ts           # Authentication state
│   │   │   │   ├── model-config.ts   # Model/provider config (persisted)
│   │   │   │   ├── chat-settings.ts  # UI preferences
│   │   │   │   ├── assistants.ts     # Assistant management
│   │   │   │   ├── conversation.ts   # Thread tracking
│   │   │   │   ├── artifacts.ts      # Artifact state (panel open, active artifact)
│   │   │   │   └── ollama-store.ts   # Ollama model management
│   │   │   ├── types/
│   │   │   │   └── artifact.ts       # Artifact type definitions & ARTIFACT_TYPE_META
│   │   │   ├── chat.ts               # Core chat hook (LangGraph SDK streaming)
│   │   │   ├── threads.ts            # Thread management client
│   │   │   ├── auth/                 # JWT utilities (jose)
│   │   │   ├── db/                   # SQLite database (better-sqlite3, drizzle)
│   │   │   ├── chat-utils.ts         # Chat helper utilities
│   │   │   ├── message-grouping.ts   # Message grouping logic
│   │   │   ├── file-loader.ts        # File parsing (PDF, DOCX, CSV, etc.)
│   │   │   ├── tool-config.ts        # Tool display configuration
│   │   │   └── codemirror-theme.ts   # CodeMirror editor theme
│   │   ├── hooks/                    # Custom React hooks
│   │   │   ├── use-clipboard-paste.ts
│   │   │   └── use-mobile.ts
│   │   └── public/                   # Static assets (logo, icons)
│   │
│   └── agent/                        # TypeScript LangGraph agent server (renamed from backend)
│       ├── src/
│       │   ├── agent/
│       │   │   ├── graph.ts          # Main LangGraph graph builder
│       │   │   ├── state.ts          # Agent state annotation (Annotation.Root)
│       │   │   ├── fs-checkpointer.ts # FileSystem-based checkpointer
│       │   │   ├── prompt.ts         # Hardcoded system prompt (SYSTEM_PROMPT export)
│       │   │   ├── nodes/            # Graph nodes
│       │   │   │   ├── agent.ts               # LLM inference with tools
│       │   │   │   ├── start-middleware.ts     # Initialize execution, PII
│       │   │   │   ├── memory-retrieval.ts     # Qdrant memory retrieval
│       │   │   │   ├── approval-gate.ts        # Human-in-the-loop approval
│       │   │   │   ├── tool-execution.ts       # Execute approved tools
│       │   │   │   └── end-middleware.ts        # Finalize, metrics
│       │   │   ├── tools/
│       │   │   │   └── index.ts      # Tool registry, LangChain bindings, approval logic
│       │   │   └── middleware/
│       │   │       └── pii.ts        # PII detection patterns
│       │   ├── assistants/           # Assistant CRUD system
│       │   │   ├── types.ts          # Assistant schema
│       │   │   ├── router.ts         # Hono routes for assistants
│       │   │   └── db.ts             # JSON file storage
│       │   ├── lib/
│       │   │   ├── config.ts         # Env config (Zod schema)
│       │   │   ├── config-loader.ts  # Horizon JSON config loader (XDG-style lookup)
│       │   │   └── llm.ts            # LLM client factory (multi-provider)
│       │   ├── middleware/
│       │   │   └── rate-limit.ts     # IP-based rate limiting
│       │   └── index.ts              # Hono server entry (routes, SSE streaming)
│       ├── data/
│       │   └── artifacts.json        # Artifact storage (auto-created)
│       └── langgraph.json            # LangGraph CLI config
│
├── packages/
│   ├── ui/                           # Shared shadcn/ui component library
│   ├── agent-memory/                 # Qdrant vector memory system
│   ├── agent-tools/                  # Consolidated agent tools (shell, web, artifacts)
│   ├── shared-utils/                 # Shared utilities including structured logger
│   └── typescript-config/            # Shared TypeScript configs
│
├── config/
│   ├── horizon.json                  # Local runtime config (gitignored)
│   ├── horizon.example.json          # Config template
│   ├── config.schema.json            # JSON Schema for validation
│   └── README.md                     # Configuration docs
│
├── docs/
│   ├── LIBRARY_DOCS/                 # Library-specific documentation
│   │   ├── AGENT_IN_LOOP.md          # Human-in-the-loop patterns
│   │   ├── LANGCHAIN_GENERATIVE_UI.md # Generative UI reference
│   │   ├── LANGCHAIN_MODELS.md       # LangChain model usage
│   │   └── LANGCHAIN_USESTREAM.md    # useStream hook patterns
│   ├── REFERENCE_PROJECTS/           # Cloned repos for agent study (gitignored)
│   │   └── README.md                 # Usage instructions
│   ├── configuration.md              # Configuration guide
│   ├── deployment.md                 # Deployment guide
│   └── development.md                # Development guide
│
├── biome.json                        # Biome linter/formatter config
├── turbo.json                        # Turborepo task configuration
├── package.json                      # Root workspace config
├── docker-compose.yaml               # Development orchestration
├── docker-compose.prod.yaml          # Production orchestration
└── TODO.md                           # Active feature roadmap
```

### Key Structural Notes

- There is **no `eslint-config` package** — linting is handled entirely by **Ultracite + Biome**.
- There is **no `backend-py-legacy`** or `sandbox` directory — the Python backend has been removed.
- The `packages/` workspace uses the `@horizon/*` scope for internal packages.
- The `config/` directory holds runtime JSON configuration, **not** environment variables for model/API settings.

---

## 4. Architecture

### High-Level System Diagram

```text
┌───────────────────────┐       ┌──────────────────────────┐       ┌──────────────────┐
│     Next.js 16        │──────▶│   LangGraph Agent        │──────▶│     Qdrant       │
│     (Web App)         │◀──────│   (TypeScript + Hono)    │◀──────│   (Vector DB)    │
│     Port 3000         │  SSE  │   Port 2024              │       │   Port 6333      │
└───────────────────────┘       └──────────────────────────┘       └──────────────────┘
         │                              │          │
         │                              ▼          ▼
         │                      ┌──────────┐  ┌──────────────┐
         │                      │  Tools   │  │  Assistant   │
         │                      │ (Web,    │  │  Manager     │
         │                      │  Shell)  │  │  (JSON DB)   │
         │                      └──────────┘  └──────────────┘
         │
         ▼
┌───────────────────────┐
│  SQLite (Auth DB)     │
│  better-sqlite3       │
│  + drizzle ORM        │
└───────────────────────┘
```

### Data Flow

1. **User** types a message in the Next.js chat UI.
2. **Frontend** sends a streaming request to the backend via LangGraph SDK (`/threads/:id/runs/stream`).
3. **Model config** (provider, API key, model name, temperature) is sent **per-request** from the frontend's Zustand store — **not** from backend env vars.
4. **Backend** runs the LangGraph agent graph which goes through: Start → Memory Retrieval → Agent (LLM) → Conditional routing.
5. If the LLM returns **tool calls**, they go through the **ApprovalGate**. Dangerous tools trigger a `NodeInterrupt` that pauses the stream and asks the user for approval.
6. Once approved, **ToolExecution** runs the tools, and results are fed back to the Agent for another inference cycle.
7. **EndMiddleware** finalizes the response and the stream completes.

### LangGraph Agent Flow

```text
START ──▶ StartMiddleware ──▶ MemoryRetrieval ──▶ AgentNode ──▶ [Conditional]
                                                                  │
                                                          ┌───────┴────────┐
                                                          │ Has Tool Calls?│
                                                          ├───── YES ──────┤──── NO ──▶ EndMiddleware ──▶ END
                                                          ▼                │
                                                    ApprovalGate           │
                                                          │                │
                                                  ┌───────┴────────┐       │
                                                  │ Tools Approved?│       │
                                                  ├── YES ─┤── NO ┤       │
                                                  ▼        ▼      │       │
                                            ToolExecution  AgentNode      │
                                                  │       (w/ feedback)   │
                                                  ▼                       │
                                            [Max Calls?] ─── YES ────────┘
                                                  │
                                                  NO
                                                  ▼
                                             AgentNode (loop)
```

### Important Architecture Decision: Model Config is Client-Driven

**The model provider, API key, model name, and parameters are stored in the frontend (Zustand `model-config` store, persisted to `localStorage`) and sent to the backend on every request.** The backend's `config.ts` env vars serve only as **fallback defaults** — the runtime model is created from the per-request `RuntimeModelConfig` passed by the frontend.

This means:

- Users configure their API keys and model selection **entirely from the UI** (Settings → Provider Configuration).
- The backend does **not** need env vars for `MODEL_PROVIDER`, `MODEL_NAME`, or `*_API_KEY` to function — these are relayed from the client.
- Backend env vars like `MODEL_PROVIDER` / `MODEL_NAME` in `config.ts` are **fallback defaults** only, used if no runtime config is provided.

---

## 5. Tech Stack & Libraries

### Core Runtime

| Component | Technology | Version |
|---|---|---|
| **Package Manager** | Bun | 1.3.6+ |
| **Language** | TypeScript | 5.7+ |
| **Monorepo** | Turborepo | 2.8+ |
| **Node Compatibility** | Node.js | ≥ 20 |

### Frontend (`apps/web`)

| Category | Technology | Notes |
|---|---|---|
| **Framework** | Next.js 16 (App Router) | Turbopack dev server |
| **UI Library** | React 19 | Function components only |
| **Styling** | Tailwind CSS 4 | PostCSS integration |
| **Components** | shadcn/ui + Radix UI | Glassmorphic design tokens |
| **State Management** | Zustand 5 | Persistent stores via `zustand/middleware` |
| **Animations** | Framer Motion 12 | Micro-interactions & transitions |
| **Markdown** | react-markdown + remark-gfm | Math (KaTeX), syntax highlighting |
| **Code Editor** | CodeMirror 6 | Multi-language support |
| **Diagrams** | Mermaid 11 | In-chat diagram rendering |
| **Charts** | Recharts 2.15 | Data visualization |
| **Auth** | jose (JWT) + bcryptjs | Local SQLite auth DB |
| **Database** | better-sqlite3 + drizzle-orm | User accounts, sessions |
| **File Parsing** | pdfjs-dist, mammoth, papaparse, xlsx | PDF, DOCX, CSV, Excel support |
| **Toasts** | Sonner | Notification system |
| **AI SDK** | @langchain/langgraph-sdk | Streaming chat client |
| **Icons** | Lucide React, React Icons | Icon library |

### Backend (`apps/agent`)

| Category | Technology | Notes |
|---|---|---|
| **Web Framework** | Hono 4.12+ | Lightweight, fast, middleware-based |
| **Server** | @hono/node-server | Node.js HTTP adapter |
| **Agent Framework** | LangGraph.js 1.2+ | Stateful multi-node graph |
| **LLM Providers** | @langchain/openai, @langchain/anthropic, @langchain/google-genai, @langchain/groq, @langchain/ollama | Multi-provider factory |
| **Checkpointing** | Custom `FileSystemCheckpointer` | JSON file-based persistence |
| **Validation** | Zod 3.25+ | Schema validation for config |
| **Environment** | dotenv | Env var loading |

### Shared Packages

| Package | Purpose |
|---|---|
| `@horizon/ui` | shadcn/ui component library with glassmorphic design tokens |
| `@horizon/agent-memory` | Qdrant vector DB client, memory types, semantic retrieval |
| `@horizon/agent-tools` | Consolidated tools — shell execution, web search, artifacts |
| `@horizon/shared-utils` | Shared utilities including structured logger |
| `@horizon/typescript-config` | Shared `tsconfig.json` presets |

### Infrastructure

| Component | Technology | Notes |
|---|---|---|
| **Containerization** | Docker Compose | Dev & production stacks |
| **Vector Database** | Qdrant | Semantic memory storage |
| **Cache** | Redis 7 | Optional session/cache store |
| **Linting & Formatting** | Ultracite 7.1 + Biome 2.3 | Zero-config quality enforcement |

---

## 6. Coding Standards & Principles

### Core Principles

These principles govern all code written for Horizon. They are listed in order of priority:

1. **DRY (Don't Repeat Yourself)**: Extract shared logic into utility functions, shared packages (`@horizon/*`), or custom hooks. Never duplicate business logic across the frontend and backend.

2. **KISS (Keep It Simple, Stupid)**: Prefer straightforward, readable solutions over clever abstractions. If a simpler approach works, use it. Avoid premature optimization.

3. **YAGNI (You Aren't Gonna Need It)**: Do not implement speculative features. Build only what is needed now, with clean extension points for the future.

4. **Separation of Concerns**: Each module, component, and function should have a single, clear responsibility. The monorepo package structure enforces this at the architectural level.

5. **Fail Fast, Fail Loud**: Validate inputs early (Zod schemas), use early returns for error cases, and throw descriptive `Error` objects — never silently swallow errors.

6. **Explicit Over Implicit**: Use explicit TypeScript types, named exports, and clear function signatures. Avoid `any`; prefer `unknown` when the type is genuinely uncertain.

### Ultracite & Biome (Linting & Formatting)

This project uses **Ultracite**, a zero-config preset built on top of **Biome**, for all linting and formatting. There is **no ESLint or Prettier** — Biome handles everything.

### Git Workflow

This project uses Git for version control with a **commit-per-feature/fix** policy.

#### Commit Policy

- **Always commit and push after completing each distinct feature, fix, or change** — don't batch multiple unrelated changes into one commit.
- **One logical change per commit** — if two features are independent, they should be separate commits.
- **Run `bun x ultracite fix` before committing** — most formatting and lint issues are auto-fixable.
- **Never commit secrets, API keys, or `.env` files.**
- **Always push** after committing to keep the remote up-to-date.

#### Commit Message Format

This project follows [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<target>): <description>

[optional body]

[optional footer]
```

**Types:**

| Type | Description |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only changes |
| `style` | Code style changes (formatting, no logic) |
| `refactor` | Code refactoring (no feature/fix) |
| `perf` | Performance improvements |
| `test` | Adding or updating tests |
| `build` | Build system or dependency changes |
| `chore` | Maintenance tasks (deps, configs, tooling) |
| `ci` | CI/CD changes |
| `hotfix` | Critical production fix |

**Target:** The affected area (e.g., `agent`, `web`, `ui`, `memory`, `tools`, `docs`, `config`, `agenda`)

**Examples:**
```
feat(agent): add parallel worker support
fix(web): resolve chat input freeze on long messages
docs(config): update horizon.json schema documentation
hotfix(agent): prevent dangerous shell pattern bypass
```

#### Pre-Commit Checklist

> **IMPORTANT: Run `bun x ultracite fix` before EVERY commit.** This is mandatory per Ultracite standards.

1. Run `bun x ultracite fix` to auto-fix formatting/lint issues
2. Run `bun typecheck` to verify TypeScript compiles
3. Verify no secrets or API keys are included
4. Write a clear commit message following the format above
5. If `AGENTS.md` was updated, mention it in the commit body

**Active Biome Configuration** (`biome.json`):

| Setting | Value |
|---|---|
| Indent Style | Spaces (2) |
| Line Width | 100 |
| Line Ending | LF |
| Quote Style | Double quotes |
| JSX Quote Style | Double quotes |
| Semicolons | Always |
| Trailing Commas | ES5 |

**Intentionally Disabled Rules:**

These rules are turned off in `biome.json` for project-specific reasons:

- `noExcessiveCognitiveComplexity` — Some agent nodes have inherently complex routing logic.
- `noForEach` — `.forEach()` is used in legacy code; prefer `for...of` in new code.
- `noNestedTernary` — Acceptable in JSX conditional rendering.
- `noBarrelFile` — Package index files re-export by design.
- `noImgElement` — Some dynamic image sources bypass Next.js `<Image>`.
- `noArrayIndexKey` — Accepted in static, non-reorderable lists.
- `noSvgWithoutTitle` — Decorative SVGs don't need titles.

### TypeScript Standards

**Type Safety:**

- Use explicit types for function parameters and return values.
- Prefer `unknown` over `any`.
- Use `as const` assertions for immutable values.
- Use `interface` for object shapes, `type` for unions/intersections.
- Use `Record<K, V>` for dynamic key object types, `T[]` for arrays (not `Array<T>`).

**Modern Patterns:**

- `const` by default, `let` only when reassignment is needed, **never** `var`.
- Optional chaining (`?.`) and nullish coalescing (`??`) for safe property access.
- Template literals over string concatenation.
- Destructuring for object and array access.
- Arrow functions for callbacks and short functions.
- `for...of` over `.forEach()` in new code.
- `async/await` over promise chains.

**Naming Conventions:**

| Type | Convention | Example |
|---|---|---|
| Components | PascalCase | `ChatInterface`, `ApprovalGate` |
| Hooks | camelCase with `use` prefix | `useChat`, `useModelConfig` |
| Functions/Variables | camelCase | `isLoading`, `processEvent` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_MODEL_CALLS`, `TOOL_CATEGORIES` |
| Files (utilities) | kebab-case | `chat-utils.ts`, `config-loader.ts` |
| Files (components) | kebab-case | `chat-area.tsx`, `model-selector.tsx` |
| Files (graph nodes) | kebab-case | `approval-gate.ts`, `tool-execution.ts` |
| Interfaces/Types | PascalCase | `AgentConfig`, `RuntimeModelConfig` |
| Packages | kebab-case with `@horizon/` scope | `@horizon/agent-memory` |

**Import Order:**

```typescript
// 1. React/Next.js
import { useState, useEffect } from "react";
import type { Metadata } from "next";

// 2. External libraries
import { Hono } from "hono";
import { z } from "zod";

// 3. Workspace packages (@horizon/*)
import { ShellExecutor } from "@horizon/agent-tools";
import { Button } from "@horizon/ui/components/ui/button";

// 4. App-level imports (@/*)
import { useAuth } from "@/lib/stores/auth";
import { useModelConfig } from "@/lib/stores/model-config";

// 5. Relative imports
import { ChatArea } from "./chat-area";
import type { AgentState } from "../state.js";
```

### React & Next.js Standards

- **Function components only** — no class components.
- Mark client-side components with `"use client"` directive.
- Hooks at the top level only, never conditionally.
- Destructure props explicitly with TypeScript interfaces.
- Early returns for conditional rendering and guard clauses.
- Use `key` prop with unique IDs, not array indices (except for truly static lists).
- Use semantic HTML (`<button>`, `<nav>`, `<main>`) over `<div>` with roles.
- Use Next.js `<Image>` component where possible (exceptions noted in Biome config).
- Use App Router metadata API for SEO (not `next/head`).
- React 19: Use `ref` as a prop directly — no `React.forwardRef`.

### Logger (`@horizon/shared-utils`)

**All logging across the app must go through `@horizon/shared-utils`** — never use `console.log` or `console.error` directly.

**Import:**
```typescript
import { createLogger, LogLevel } from "@horizon/shared-utils";
```

**Core API:**
```typescript
const logger = createLogger("Agent");         // Context label
logger.trace("Detailed trace info");
logger.debug("Debug info", { key: "value" });
logger.info("Info message");
logger.success("Operation succeeded");
logger.warn("Warning message");
logger.error("Something went wrong", new Error("boom"));
logger.fatal("Fatal crash", error);
```

**Scoped sub-loggers:**
```typescript
const apiLogger = logger.withPrefix("API");
apiLogger.info("GET /users");        // logs with [API] prefix

const child = logger.withTag("Memory");
child.info("Retrieving memories");    // logs with [Memory] tag
```

**Utilities:**
```typescript
logger.box("Deployment complete", "Summary");  // Unicode box output

const spin = logger.spinner("Loading...");
spin.success("Done!");
spin.fail("Failed!");
spin.warn("Warning!");

logger.table([{ name: "Alice", age: 30 }]);     // Pretty ASCII table
```

**Configuration options:**
```typescript
const logger = createLogger("Agent", {
  minLevel: LogLevel.DEBUG,        // Show debug logs
  timestamps: true,                // HH:MM:SS.mmm timestamps
  colors: true,                     // Auto-false in CI environments
  format: "fancy",                 // "fancy" | "simple" | "quiet"
  showCaller: false,                // Show file:line attribution
  trailingNewline: true,
});
```

**Log levels (lowest → highest severity):** `TRACE` (-1) → `DEBUG` (0) → `INFO` (1) → `SUCCESS` (2) → `WARN` (3) → `ERROR` (4) → `FATAL` (5). Default minimum is `INFO`.

**CI auto-detection:** Colors and fancy format are automatically disabled when `CI=true`, `TERM_PROGRAM=vscode`, or `NODE_ENV=test`.

**Exports:**
```typescript
// All from "@horizon/shared-utils"
createLogger, childLogger, createFileLogger,
LogLevel, Level (alias),
Logger, LoggerOptions, SpinnerInstance,
DataArg, ErrorArg, FormatMode
```

### Error Handling

- Always wrap async operations in `try/catch` with **context-prefixed logging**:

  ```typescript
  const logger = createLogger("Agent");
  try {
    await someOperation();
  } catch (error) {
    logger.error("Failed to send message", error instanceof Error ? error : { cause: error });
  }
  ```

- Throw `Error` objects with descriptive messages, not strings.
- Use early returns to reduce nesting.
- Don't catch errors just to rethrow them without adding context.

### Security

- Add `rel="noopener"` on `target="_blank"` links.
- Avoid `dangerouslySetInnerHTML` unless absolutely necessary (markdown rendering is an accepted exception with proper sanitization).
- Never use `eval()` or assign to `document.cookie` directly.
- Validate and sanitize all user input — use Zod schemas on the backend.
- Never commit API keys, secrets, or `.env` files.

### Performance

- Avoid spread syntax inside loop accumulators.
- Use top-level regex literals, not inside loops.
- Prefer specific named imports over namespace (`*`) imports.
- Use `React.memo` / `useMemo` / `useCallback` judiciously — only when profiling shows a benefit.

---

## 7. UI/UX Architecture & Theming

### Design Philosophy

Horizon uses a **glassmorphic design language** — frosted glass panels, deep blurs, subtle gradients, and layered transparency. The goal is a premium, immersive feel that is both beautiful and functionally dense.

### Theme System

Horizon has a **custom theme provider** (not `next-themes`). It manages two orthogonal axes:

| Axis | Options | Storage |
|---|---|---|
| **Theme** (color palette) | `horizon`, `nebula`, `aurora` | `localStorage: horizon-theme` |
| **Mode** (light/dark) | `light`, `dark` | `localStorage: horizon-theme-mode` |

**Implementation:**

- `components/theme/theme-provider.tsx` — React Context providing `theme`, `themeMode`, `setTheme`, `setThemeMode`.
- `components/theme/theme-switcher.tsx` — UI control for switching themes.
- Theme is applied via `data-theme` attribute on `<html>` and `dark` class toggle.
- A blocking `<script>` in `layout.tsx` prevents flash of incorrect theme (FOIT) on page load.

**How to add a new theme:**

1. Define CSS custom properties under a new `[data-theme="your-theme"]` selector in the shared UI styles.
2. Add the theme name to the `Theme` type in `theme-provider.tsx`.
3. Add a swatch/option in `theme-switcher.tsx`.

### Typography

The project uses four Google Fonts loaded via `next/font/google` in `layout.tsx`:

| Font | CSS Variable | Usage |
|---|---|---|
| **Space Grotesk** | `--font-display` | Headings, brand elements |
| **Playfair Display** | `--font-accent` | Quotes, timestamps, editorial moments |
| **Source Sans 3** | `--font-body` | Body text, chat messages (default) |
| **Source Code Pro** | `--font-mono` | Code blocks, technical content |

### State Management Pattern

All client-side state uses **Zustand** stores in `lib/stores/`:

| Store | File | Persisted? | Purpose |
|---|---|---|---|
| `useModelConfig` | `model-config.ts` | ✅ localStorage | Provider, model, API keys, reasoning settings |
| `useAuth` | `auth.ts` | ✅ localStorage | JWT token, user info |
| `useChatSettings` | `chat-settings.ts` | ✅ localStorage | UI preferences (sidebar state, etc.) |
| `useAssistants` | `assistants.ts` | ❌ | Assistant list, selection |
| `useConversation` | `conversation.ts` | ❌ | Active thread tracking |
| `useArtifactsStore` | `artifacts.ts` | ❌ | Artifact list, active artifact ID, panel open state |
| `useOllamaStore` | `ollama-store.ts` | ❌ | Local Ollama model list |

### Generative UI (Tool Call Rendering)

Tool calls are rendered with **custom React components** in `components/chat/generative-ui/`:

| Tool | Renderer | Description |
|---|---|---|
| `shell_execute` | `shell-tool.tsx` | Terminal-style output with exit codes, duration |
| `web_search` / `duckduckgo_search` | `web-search-tool.tsx` | Search result cards |
| `fetch_url_content` | `fetch-url-tool.tsx` | Page content extraction display |
| `get_weather` | `weather-tool.tsx` | Weather card |
| `create_artifact` | `artifact-tool.tsx` | Compact shimmer line while generating, then "Created ✓" |
| `present_artifact` | `artifact-tool.tsx` | Clickable artifact card that opens `ArtifactViewer` panel |
| *(fallback)* | `generic-tool.tsx` | JSON-based generic display |

The `generative-ui-renderer.tsx` dispatches to the appropriate component based on tool name. The `loading-effects.tsx` provides animated loading states during tool execution.

### Notification System

Notifications use **Sonner** (`sonner` package) configured in `layout.tsx` with a `glass-strong` CSS class for glassmorphic styling. Toast notifications appear top-right, with rich colors and close buttons.

---

## 8. Backend Architecture

### Server (`apps/agent/src/index.ts`)

The backend is a **Hono 4** HTTP server running on `@hono/node-server`. It handles:

- CORS configuration (allows `localhost:3000` and any origin in dev).
- SSE streaming for agent runs.
- Thread state management via LangGraph checkpointer.
- Assistant CRUD via `assistantsRouter`.
- Ollama model proxy endpoints.

### API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `GET` | `/config` | Non-sensitive configuration |
| `GET` | `/threads/:id/state` | Get thread state |
| `GET` | `/threads/:id/history` | Get thread state history |
| `POST` | `/threads/:id/runs/stream` | Stream an agent run (SSE) |
| `POST` | `/threads/:id/runs/resume` | Resume after tool approval interrupt |
| `*` | `/assistants/*` | Assistant CRUD (via router) |

### LangGraph Graph Nodes

Each node is a pure function `(state: AgentState) => Partial<AgentState>` in `src/agent/nodes/`:

| Node | File | Responsibility |
|---|---|---|
| `StartMiddleware` | `start-middleware.ts` | Initialize execution context, PII detection |
| `MemoryRetrieval` | `memory-retrieval.ts` | Retrieve relevant memories from Qdrant, inject as context |
| `AgentNode` | `agent.ts` | LLM inference with tool bindings, creates runtime LLM from request config |
| `ApprovalGate` | `approval-gate.ts` | Check tool approval policy; `NodeInterrupt` for dangerous tools |
| `ToolExecution` | `tool-execution.ts` | Execute approved tool calls, return results |
| `EndMiddleware` | `end-middleware.ts` | Finalize response, calculate metrics |

### Tool System

Tools are defined in `src/agent/tools/index.ts` (LangChain bindings) and sourced from `@horizon/agent-tools`:

| Tool | Source | Description |
|---|---|---|
| `web_search` | `@horizon/agent-tools` | DuckDuckGo web search |
| `fetch_url_content` | `@horizon/agent-tools` | Extract page content via Cheerio |
| `duckduckgo_search` | `@horizon/agent-tools` | Alternative search tool |
| `shell_execute` | `@horizon/agent-tools` | Execute shell commands with structured JSON output |
| `create_artifact` | `@horizon/agent-tools` | Store HTML/SVG/Mermaid/React/code artifact, format with Prettier, return ID |
| `present_artifact` | `@horizon/agent-tools` | Fetch artifact by ID and signal frontend to render ArtifactCard |
| `spawn_subagents` | `agent/tools/subagent.ts` | Spawn multiple parallel workers for complex multi-part tasks |

**Tool Approval Modes:**

| Mode | Behavior |
|---|---|
| `never_ask` | Auto-approve all tools |
| `always_ask` | Require user approval for every tool call |
| `dangerous_only` **(default)** | Only require approval for dangerous tools (`shell_execute`, etc.) |

**Tool Risk Categories:**

- **Safe**: `web_search`, `fetch_url_content`, `duckduckgo_search`, `get_weather`, `create_artifact`, `present_artifact`
- **Dangerous**: `shell_execute`, `file_write`, `file_delete`

### Shell Execution Safety (`@horizon/agent-tools`)

The shell module in `@horizon/agent-tools` has multiple safety layers:

- **Dangerous pattern detection**: `rm -rf`, `sudo`, `chmod`, `mkfs`, `dd`, `npm install -g`, `git push --force`, `DROP TABLE`, etc.
- **Configurable timeouts**: Default 30 seconds.
- **Output limits**: 1MB max output, truncated with a flag.
- **Working directory**: Restricted to the configured workspace path from `config/horizon.json`.

### Parallel Workers (`spawn_subagents`)

The main agent can spawn multiple parallel workers to handle complex multi-part tasks. This is an **implicit decision** - the LLM decides when to use this based on task complexity.

**Architecture:**

```
Main Agent → spawn_subagents tool → Workers (parallel) → Results → Continue
```

**Key Files:**
- `apps/agent/src/agent/tools/subagent.ts` - The spawn_subagents tool
- `apps/agent/src/agent/workers/` - Worker execution module
- `apps/web/components/chat/generative-ui/worker-tool.tsx` - Worker visualization

**How It Works:**
1. Main agent decides a task is complex enough to parallelize
2. Calls `spawn_subagents` with array of worker configs
3. Each worker runs independently with its own system prompt, tools, and context
4. Workers execute in parallel (default) or sequentially
5. Results are aggregated and returned to main agent
6. Main agent continues with the aggregated results

**Worker Configuration:**
```typescript
{
  name: "Worker Name",           // Descriptive name
  task: "The specific task",     // What this worker should do
  systemPrompt: "Custom prompt", // Worker-specific instructions
  tools: ["shell_execute"],      // Tools to give this worker
  modelConfig: {...},           // Optional model override
  timeout: 300000               // Timeout in ms
}
```

**When to Use:**
- Complex projects with independent components (frontend + backend + tests)
- Multiple research topics to explore in parallel
- Tasks that benefit from parallel execution speed

**Future Enhancements:**
- Real-time worker progress streaming (nested tool calls visible)
- Worker-to-worker handoffs
- Async mode (main agent continues while workers run)

### Configuration System

**Two layers of configuration exist:**

1. **Environment Variables** (`.env`): Server-level settings — port, feature flags, rate limits, prompt defaults, and **fallback** model config. Parsed by Zod in `lib/config.ts`.

2. **Runtime JSON Config** (`config/horizon.json`): Workspace paths, agent behavior (retries, timeouts). Loaded by `lib/config-loader.ts` with XDG-style directory lookup:
   - `HORIZON_CONFIG` env var → `config/horizon.json` → `./horizon.json` → parent directories → `~/.horizon/config.json` → `~/.config/horizon/config.json` → system-wide → auto-create from example → defaults.

**Feature Flags** (from `.env`, all boolean):

- `ENABLE_MEMORY` — Vector memory retrieval
- `ENABLE_SUMMARIZATION` — Conversation summarization
- `ENABLE_PII_DETECTION` — PII pattern detection
- `ENABLE_RATE_LIMITING` — IP-based rate limiting
- `ENABLE_TOKEN_TRACKING` — Token usage tracking
- `ENABLE_MODEL_FALLBACK` — LLM fallback on failure
- `ENABLE_TOOL_RETRY` — Retry failed tool executions
- `ENABLE_TOOL_APPROVAL` — Human-in-the-loop tool approval
- `ENABLE_TODO_LIST` / `ENABLE_TODO_PLANNER` — TODO features

### LangGraph CLI

The backend uses **@langchain/langgraph-cli** for development:

```bash
cd apps/agent
bunx @langchain/langgraph-cli dev
```

This reads `langgraph.json` which points to `./src/agent/graph.ts:graph` as the compiled graph export.

---

## 9. Build Commands & Development Workflows

### Root Level (Turborepo)

```bash
bun dev                  # Start all dev servers (web + agent via Turbo)
bun dev:web              # Start only the web frontend
bun dev:agent            # Start only the agent server (LangGraph CLI)
bun build                # Build all packages
bun lint                 # Check linting (ultracite check)
bun lint:fix             # Fix linting issues (ultracite fix)
bun format               # Alias for ultracite fix
bun typecheck            # TypeScript type checking
bun clean                # Clean all build artifacts + node_modules
bun docker:dev           # Start Docker dev stack
bun docker:prod          # Start Docker prod stack
bun docker:down          # Stop Docker stack
```

### Web App (`apps/web`)

```bash
cd apps/web
bun dev                  # Next.js dev server with Turbopack (port 3000)
bun build                # Production build
bun start                # Production server
bun lint                 # Ultracite check
```

### Agent (`apps/agent`)

```bash
cd apps/agent
bun dev                  # LangGraph CLI dev server (port 2024)
bun start                # Direct Hono server start
bun test                 # Run tests
bun typecheck            # TypeScript checking
```

### Docker Development

```bash
# Start all services (backend, web, qdrant, redis)
docker-compose up --build

# Services and ports:
#   backend  → port 2024 (agent API), port 8000 (health)
#   web      → port 3000 (Next.js)
#   qdrant   → port 6333 (HTTP), port 6334 (gRPC)
#   redis    → port 6379
```

---

## 10. Common Development Tasks

### Adding a New Tool

1. Define the tool schema and implementation in `apps/agent/src/agent/tools/` using `tool()` from `@langchain/core/tools`.
2. Add the tool name to `TOOL_CATEGORIES.safe` or `TOOL_CATEGORIES.dangerous`.
3. Add the tool to the `tools` array export.
4. Create a generative UI renderer in `apps/web/components/chat/generative-ui/` (e.g., `your-tool.tsx`).
5. Register the renderer inside `generative-ui/index.tsx`.
6. Update `apps/web/lib/tool-config.ts` with display metadata (icon, label, color).

### Adding a New LLM Provider

1. Install the `@langchain/<provider>` package in `apps/agent`.
2. Add the provider to the `switch` in `apps/agent/src/lib/llm.ts` → `createRuntimeLLM()`.
3. Add the provider type to `RuntimeModelConfig.provider` union.
4. Add the provider to `ModelProvider` type in `apps/web/lib/stores/model-config.ts`.
5. Add default models and provider info to `DEFAULT_MODELS` and `PROVIDER_INFO`.
6. Add the provider config to the Zustand store default state.
7. Update fallback config in `apps/agent/src/lib/config.ts` → `EnvSchema.MODEL_PROVIDER` enum.

### Adding a New Graph Node

1. Create a file in `apps/agent/src/agent/nodes/` (kebab-case).
2. Export a node function: `export const YourNode = async (state: AgentState) => { ... }`.
3. Import and wire it in `apps/agent/src/agent/graph.ts` using `.addNode()` and `.addEdge()` / `.addConditionalEdges()`.
4. Update `AgentStateAnnotation` in `state.ts` if new state fields are needed.

### Adding a New Theme

1. Define CSS custom properties under `[data-theme="your-theme"]` in the shared UI styles (`packages/ui`).
2. Add the theme name to the `Theme` type union in `components/theme/theme-provider.tsx`.
3. Add a swatch in `components/theme/theme-switcher.tsx`.

### Modifying Agent State

1. Update `AgentStateAnnotation` in `apps/agent/src/agent/state.ts` — add new fields with appropriate reducers.
2. Update any nodes that read/write the new fields.
3. If the field is surfaced to the frontend, update the corresponding types in the web app.

---

## 11. Future Improvements & Roadmap

Tracked in `TODO.md`. Key areas:

### Active TODO Items

- [ ] Implement proper sandboxed code execution
- [ ] Improve theme contrast for low-visibility UI components
- [ ] Make the memory feature fully functional
- [ ] Fix auth token expiry handling (loading state gets stuck)
- [ ] Fix unauthenticated access to chat interface

### Planned Phases (File Attachments & RAG)

- **Phase 1**: File display in messages, multimodal content (images as base64) *(partially done)*
- **Phase 2**: Persistent file storage with upload API and database metadata
- **Phase 3**: Document processing with Docling/Unstructured, text chunking, Qdrant embeddings
- **Phase 4**: My Items panel — uploaded files, generated artifacts, preview/download
- **Phase 5**: Chat with Docs — RAG context selection, multi-document queries, citation linking

### Future Aspirations

- Scalable server architecture for concurrent users
- Electron/Tauri desktop wrapper
- Browser automation tools (Playwright integration)
- Plugin system for community-built tools
- Agent-to-agent communication

---

## 12. Documentation Guidelines

### Where Documentation Lives

| Type | Location | Purpose |
|---|---|---|
| **Agent guidelines** | `AGENTS.md` (this file) | Single source of truth for AI agents |
| **Project README** | `README.md` | User-facing project overview |
| **Library docs** | `docs/LIBRARY_DOCS/` | Detailed docs for complex libraries (LangGraph, LangChain) |
| **Reference projects** | `docs/REFERENCE_PROJECTS/` | Cloned repos for agent study (gitignored) |
| **Config guide** | `docs/configuration.md` | Configuration reference |
| **Dev guide** | `docs/development.md` | Development environment setup |
| **Deploy guide** | `docs/deployment.md` | Docker & production deployment |
| **TODO list** | `TODO.md` | Active feature roadmap |

### Library Documentation (`docs/LIBRARY_DOCS/`)

This directory contains **manually curated documentation** for libraries that are complex, frequently updated, or whose APIs are not well-known to LLM training data. **Always check these docs before working with these libraries:**

| File | Use When |
|---|---|
| `AGENT_IN_LOOP.md` | Implementing or modifying human-in-the-loop / tool approval workflows |
| `LANGCHAIN_GENERATIVE_UI.md` | Building custom tool renderers or modifying the generative UI system |
| `LANGCHAIN_MODELS.md` | Working with LangChain model classes, configuring providers, or debugging LLM instantiation |
| `LANGCHAIN_USESTREAM.md` | Working with the `useStream` hook, SSE streaming, or modifying the chat data flow |

**Why this matters:** LangGraph and LangChain are rapidly evolving libraries. Their APIs change frequently (e.g., the v0.x → v1.x migration broke many patterns). The documentation here serves as a **pinned, verified reference** — always prefer it over your training data when there's a conflict.

### External Documentation (Context7)

Use the **Context7** MCP tools to fetch up-to-date documentation for external libraries:

| Tool | Purpose |
|---|---|
| `context7_resolve-library-id` | Resolve a library name to a Context7-compatible library ID |
| `context7_query-docs` | Query documentation and code examples for a library |

**When to use Context7:**
- When working with a new or unfamiliar library
- When the library has known frequent API changes
- When `docs/LIBRARY_DOCS/` doesn't cover the specific API you need

**Workflow:**
1. Call `context7_resolve-library-id` with the library name (e.g., `"langchain"`, `"next.js"`)
2. Use the returned library ID to call `context7_query-docs` with your specific question

**When Context7 fails or docs are missing:**
1. Check the library's official documentation site directly
2. Search the library's GitHub repository for relevant examples or issues
3. Check Stack Overflow or community forums for practical usage patterns
4. Look at the library's type definitions or source code for API signatures
5. If no reliable documentation can be found, proceed with a best-effort implementation and add a `// TODO` comment noting the uncertainty
6. Document the working implementation in `docs/LIBRARY_DOCS/` so future agents benefit

### Reference Projects (`docs/REFERENCE_PROJECTS/`)

This directory is for **temporarily cloning external open-source projects** that an AI agent needs to study for implementation patterns. For example, cloning a project that demonstrates a specific LangGraph pattern the agent should replicate in Horizon.

- This directory is **gitignored** (except its README.md).
- Projects should be **removed when no longer needed**.
- Prefer copying only relevant files/folders over full clones.

### When to Update `AGENTS.md`

Update this file whenever you:

1. Add or remove a major feature, tool, or graph node.
2. Change the project structure (new apps, packages, or directory reorganization).
3. Modify the architecture (new data flow, new services, config changes).
4. Add or change dependencies that affect build/dev commands.
5. Modify the linting/formatting setup.
6. Change environment variable requirements or configuration options.
7. Make any breaking change to how agents should understand this codebase.

---

## 13. Troubleshooting

### Common Issues

**Build Errors:**

- Run `bun install` at the repo root.
- Clear Turbo cache: `rm -rf .turbo`
- Clear Next.js cache: `rm -rf apps/web/.next`
- Verify TypeScript: `bun typecheck`

**Agent Won't Start:**

- Ensure `apps/agent/.env` exists with at least `PORT=2024`.
- If using LangGraph CLI: `cd apps/agent && bunx @langchain/langgraph-cli dev`
- Check for TypeScript errors: `cd apps/agent && bun typecheck`

**Frontend Can't Connect to Backend:**

- Verify backend is running on port 2024.
- Check `NEXT_PUBLIC_LANGGRAPH_API_URL=http://localhost:2024` in `apps/web/.env.local`.
- Check browser console for CORS errors.

**Qdrant Connection Issues:**

- Verify Qdrant container is running: `docker-compose ps`
- Test connectivity: `curl http://localhost:6333/healthz`
- Check `QDRANT_URL` in agent `.env`.

**Authentication Issues:**

- Verify `JWT_SECRET` is set in the web app's environment.
- Clear browser `localStorage` and cookies.
- Check SQLite database integrity in `apps/web/data/`.

**Linting Failures:**

- Run `bun x ultracite fix` to auto-fix.
- If Biome errors persist, check `biome.json` for rule configuration.
- Run `bun x ultracite doctor` to diagnose setup issues.

**LangChain/LangGraph Type Errors:**

- These libraries undergo frequent breaking changes. Check `docs/LIBRARY_DOCS/` for pinned API reference.
- Use `// @ts-expect-error` with a descriptive comment as a last resort for known type mismatches (see `graph.ts` for an example).

---

## 14. Testing

### Current State

- Agent tests: `cd apps/agent && bun test`
- No comprehensive test suite yet — this is a known gap.

### Testing Standards (For New Tests)

- Write assertions inside `it()` or `test()` blocks.
- Use `async/await` — never done callbacks.
- Don't commit `.only` or `.skip`.
- Keep test suites flat — avoid excessive `describe` nesting.
- Mock external services (LLM calls, Qdrant, shell execution).
- Test tool approval logic independently from graph execution.

---

## 15. Security Considerations

### PII Detection

- Automatic detection of email and phone patterns in `middleware/pii.ts`.
- Logs warnings but does not block (configurable via `ENABLE_PII_DETECTION`).
- Run in `StartMiddleware` before any LLM inference.

### Rate Limiting

- IP-based, configurable via `RATE_LIMIT_WINDOW` and env vars.
- Toggle with `ENABLE_RATE_LIMITING`.

### Shell Execution

- Dangerous pattern detection in `@horizon/agent-tools`.
- Approval workflow prevents accidental destructive commands.
- Configurable timeouts and output limits.
- Workspace path restriction via `config/horizon.json`.

### Authentication

- JWT-based sessions via `jose`.
- Password hashing with `bcryptjs`.
- SQLite database for user accounts.
- CSRF protection via SameSite cookies.
- API routes protected by auth middleware.

### API Keys

- **Never** stored on the backend — API keys are sent per-request from the frontend's encrypted `localStorage`.
- Agent env vars serve only as fallback defaults for development.

---

## 16. Autonomous Self-Improvement — Keeping `AGENTS.md` Current

This file is a **living document**. It is only useful if it accurately reflects the current state of the codebase. **Every AI agent working on Horizon has a standing obligation to update this file proactively.**

### When to Update (Mandatory)

You **must** update `AGENTS.md` as part of your current task whenever you:

1. **Add, rename, move, or delete** any file, directory, package, or app that is referenced in the Project Structure (Section 3).
2. **Add or remove** a dependency that changes the tech stack (Section 5), build commands (Section 9), or development workflows.
3. **Add or modify** a tool, graph node, API endpoint, Zustand store, or theme — update the corresponding tables/sections.
4. **Change** configuration behavior (env vars, `horizon.json` schema, feature flags).
5. **Deprecate or remove** a feature — remove all references from this file and add a note to the Roadmap (Section 11) if appropriate.
6. **Fix a bug** that was caused by, or related to, information in this file being wrong.

### When to Update (Proactive — Self-Improvement)

Even if your current task does **not** trigger the mandatory conditions above, you **should** update `AGENTS.md` if you notice:

- **Stale information**: A file path, directory, endpoint, or config value referenced here no longer exists or has changed.
- **Missing information**: A significant part of the codebase is not documented here and caused you confusion or wasted effort during your task.
- **Incorrect instructions**: A workflow, build command, or coding pattern described here is wrong or produces errors.
- **Outdated code snippets**: Any inline code example that no longer compiles or follows current patterns.

### How to Update

1. **Make surgical edits** — update only the specific sections that are stale. Do not rewrite the entire file.
2. **Update the `Last Updated` date** at the top of the file.
3. **Preserve the section numbering** — do not renumber existing sections unless a major restructure is needed.
4. **Add a context comment** in your commit message mentioning that `AGENTS.md` was updated and why.

### Self-Correction Feedback Loop

If you encounter an error or unexpected behavior **because this file gave you wrong information**, you must:

1. Fix the root cause of your task first.
2. Then fix the corresponding section in `AGENTS.md` so the next agent does not hit the same issue.
3. If the error revealed a broader gap (e.g., an entire subsystem is undocumented), add a skeleton section with a `<!-- TODO: expand this section -->` comment.

---

## 17. Autonomous Bug Fixing Protocol

When encountering or being asked to fix a bug, follow this systematic workflow. **Do not jump to editing code immediately.**

### Step 1: Reproduce & Understand

1. **Read the error message carefully** — extract the file path, line number, error type, and stack trace.
2. **Check if it's a known issue** — search `TODO.md`, this file's Troubleshooting section (Section 13), and recent git history (`git log --oneline -20`).
3. **Read the relevant source code** — understand what the code is *supposed* to do, not just where it crashes.
4. **Check `docs/LIBRARY_DOCS/`** — if the error involves LangGraph, LangChain, or another documented library, read the pinned docs before assuming the code is wrong. The library API may have changed.

### Step 2: Diagnose

1. **Identify the root cause** — distinguish between:
   - **Syntax/type errors**: Usually straightforward; fix the type mismatch or import.
   - **Logic errors**: The code runs but produces wrong results; trace the data flow.
   - **Integration errors**: Two systems disagree (e.g., frontend sends a shape the backend doesn't expect); check both sides.
   - **Dependency errors**: A library update broke something; check `package.json` versions and changelogs.
2. **Narrow the scope** — determine the minimum set of files that need to change. Resist the urge to refactor unrelated code.

### Step 3: Fix

1. **Make the smallest correct fix** — follow KISS. Don't over-engineer a fix for a simple bug.
2. **Verify the fix** — run `bun typecheck`, `bun x ultracite check`, and any relevant tests.
3. **Check for ripple effects** — if you changed a type, interface, or function signature, search for all callers and update them.

### Step 4: Prevent Recurrence

1. **If the bug was caused by stale docs**, update `AGENTS.md` (see Section 16).
2. **If the bug was in a tricky area**, add a code comment explaining the non-obvious behavior.
3. **If a test would have caught it**, note the testing gap (add a test if within scope, or note in `TODO.md`).

### Escalation

If after investigation you determine the bug:

- Requires user input to resolve (e.g., which of two valid behaviors is intended) — **ask the user**.
- Is a known upstream library bug — document the workaround and link to the issue.
- Is beyond the scope of the current task — log it in `TODO.md` and inform the user.

---

## 18. Sub-Agent Strategy — Parallel Execution Guidelines

This project benefits greatly from using **sub-agents** (browser agents, research agents, etc.) to keep the main agent context clean and focused. Use them **liberally** but **strategically**.

### Core Philosophy

> **One task per sub-agent. Keep the main context clean. Offload all research, exploration, and parallel analysis to sub-agents.**

The main agent should orchestrate, synthesize, and make final decisions. Sub-agents should do the legwork.

### ✅ When to Use Sub-Agents (DO)

| Scenario | Sub-Agent Task | Why |
|---|---|---|
| **Research** | Read documentation, search the web, explore an API reference | Keeps the main context free of noise; research output is summarized when sub-agent returns |
| **Exploration** | Scan a directory tree, read multiple files to understand a subsystem | Main agent gets a concise summary instead of raw file contents |
| **Parallel file analysis** | Analyze `frontend/` and `backend/` independently | Two sub-agents can work in parallel if they touch completely separate file sets |
| **Browser testing** | Navigate the running app, verify UI behavior, take screenshots | Browser interactions are noisy; isolate them in a sub-agent |
| **Code generation for separate files** | Generate a new component file while another sub-agent generates a new backend route | Safe if the files don't overlap |
| **Long-running commands** | Run a build, wait for output, check for errors | Frees the main agent to continue planning |
| **Reference project study** | Read and summarize code from `docs/REFERENCE_PROJECTS/` | Avoids polluting the main context with thousands of lines of reference code |

### ❌ When NOT to Use Parallel Sub-Agents (DON'T)

| Scenario | Risk | What to Do Instead |
|---|---|---|
| **Two sub-agents editing the same file** | Race condition — one sub-agent's edits will overwrite the other's | Use a single agent (main or one sub-agent) for all edits to the same file |
| **Sub-agent A's output is needed by Sub-agent B** | Dependency — B will proceed with stale or missing data | Run A first, wait for it to return, then launch B with A's results |
| **Editing tightly coupled files** (e.g., `state.ts` + `graph.ts` + a node) | Edits to state affect graph wiring which affects node implementation | Handle sequentially in one agent, or split very carefully with explicit coordination |
| **Making a change + verifying it in the same step** | Sub-agent may verify before the change is actually written | Make the change first, then launch a sub-agent to verify |
| **Multiple sub-agents writing to `AGENTS.md`** | This file is a shared resource — parallel writes will conflict | Only one agent should edit `AGENTS.md` at a time |
| **Debugging an error** (when the fix is unknown) | Debugging requires iterative context — sub-agents lose context between steps | Debug in the main agent context; use sub-agents only for targeted information gathering |

### Allocation Rules — Preventing Overlap

When launching parallel sub-agents, follow these strict rules:

1. **Partition by file**: Each sub-agent gets exclusive ownership of a specific set of files. No two sub-agents should ever touch the same file.
2. **Partition by concern**: Prefer splitting by domain boundary (frontend vs agent, component A vs component B) rather than by operation (read vs write).
3. **Define clear return contracts**: Tell each sub-agent exactly what information to return. Vague instructions lead to wasted context.
4. **Limit parallelism**: 2–3 parallel sub-agents is usually optimal. More than that increases coordination overhead and error risk.
5. **Always wait before synthesizing**: Do not start writing a final result until all parallel sub-agents have returned.

### Sub-Agent Prompting Best Practices

When spawning a sub-agent, your task description should include:

- **Exact goal**: What should the sub-agent accomplish?
- **File scope**: Which files should it read/modify (and which it must NOT touch)?
- **Return format**: What information should it report back? (e.g., "Return a summary of the function signatures in X" or "Return the exact error message from the build output")
- **Stop condition**: When should the sub-agent stop? (e.g., "Stop after reading the first 3 files" or "Stop when you find the function that handles tool approval")

**Example — Good sub-agent prompt:**

```text
Read all files in apps/agent/src/agent/nodes/ and return a summary for each node:
- Function name and signature
- What state fields it reads and writes
- Any external calls it makes (LLM, Qdrant, shell)
Do NOT modify any files. Return your findings as a markdown table.
```

**Example — Bad sub-agent prompt:**

```text
Look at the backend and figure out how it works.
```

### Recovery from Sub-Agent Failure

If a sub-agent fails or returns incomplete results:

1. **Read the sub-agent's output** — even failed sub-agents usually return partial information.
2. **Do not re-launch blindly** — understand why it failed first (missing file? permission error? unclear instructions?).
3. **Refine the task** and re-launch with a more specific prompt, or handle the remaining work in the main agent context.
