# Horizon - Agent Coding Guidelines

**IMPORTANT: This file must be updated whenever the project structure, architecture, or workflows change. If you make changes that affect how agents should work on this codebase, update this document immediately.**

---

## Project Overview

**Horizon** is a sophisticated AI assistant platform that bridges large language models with local operating systems. It features a modern chat interface, multi-model support, long-term memory, and secure code execution capabilities.

### High-Level Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Next.js 16    │────▶│  LangGraph Agent │────▶│     Qdrant      │
│   (Web App)     │◄────│  (TypeScript)    │◄────│  (Vector DB)    │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌──────────────────┐
                        │  Tools (Web,     │
                        │  Shell, Memory)  │
                        └──────────────────┘
```

---

## Project Structure

### Repository Organization

This is a **Turborepo monorepo** using **pnpm workspaces** with Bun runtime support.

```
Horizon/
├── apps/
│   ├── web/                    # Next.js 16 frontend
│   ├── backend/               # TypeScript LangGraph agent server
│   ├── backend-py-legacy/     # Python FastAPI (legacy/reference)
│   └── sandbox/               # Dockerized secure code execution
├── packages/
│   ├── ui/                    # Shared shadcn/ui components
│   ├── agent-memory/          # Qdrant-based memory system
│   ├── agent-web/             # Web scraping/search tools
│   ├── shell/                 # Cross-platform shell execution
│   ├── typescript-config/     # Shared TS configurations
│   └── eslint-config/         # Shared ESLint configurations
├── docker-compose.yaml        # Development orchestration
├── docker-compose.prod.yaml   # Production orchestration
└── turbo.json                 # Turborepo task configuration
```

### Applications

#### 1. apps/web - Next.js 16 Chat Interface

**Technology Stack:**

- Next.js 16.0.10 with App Router
- React 19.2.0 + TypeScript 5.7.3
- Tailwind CSS 4.1.9
- Zustand 5.0.10 (state management)
- LangGraph SDK for streaming

**Key Features:**

- Real-time streaming AI chat
- Multi-theme glassmorphic UI (Horizon/Nebula/Aurora)
- JWT authentication with local SQLite
- File attachments (drag & drop, clipboard paste)
- Assistant management (custom prompts, model selection)
- Conversation branching (edit, retry, regenerate)
- Tool call visualization with generative UI
- Mobile-responsive design

**Directory Structure:**

```
app/
├── api/auth/              # Authentication API routes
│   ├── login/route.ts
│   ├── register/route.ts
│   └── me/route.ts
├── chat/
│   ├── page.tsx           # Chat index (redirects to /chat/new)
│   └── [threadId]/page.tsx # Dynamic conversation pages
├── auth/page.tsx          # Authentication page
├── layout.tsx             # Root layout with theme provider
└── page.tsx               # Home (redirects to auth/chat)

components/
├── chat/                  # Chat-specific components
│   ├── chat-area.tsx      # Main chat interface
│   ├── chat-input.tsx     # Input with attachments
│   ├── chat-bubble.tsx    # Message bubbles
│   ├── sidebar.tsx        # Navigation sidebar
│   ├── expanded-sidebar.tsx # Content panels
│   └── activity-timeline.tsx # Real-time activity feed
├── auth/                  # Authentication components
└── ui/                    # Base UI components

lib/
├── stores/                # Zustand stores
│   ├── auth.ts           # Authentication state
│   ├── conversation.ts   # Thread tracking
│   ├── chat-settings.ts  # UI preferences
│   └── assistants.ts     # Assistant management
├── chat.ts               # Core chat hook (LangGraph SDK)
├── threads.ts            # Thread management client
├── auth/                 # JWT utilities
└── db/                   # Local database (JSON-based)
```

#### 2. apps/backend - TypeScript LangGraph Agent

**Technology Stack:**

- LangGraph.js (TypeScript)
- Hono 4.7 web framework
- @hono/node-server
- Multiple LLM providers (OpenAI, Anthropic, Google, Groq, Ollama)
- Qdrant vector database

**Architecture:** Multi-node graph with conditional routing

**Graph Flow:**

```
START → StartMiddleware → MemoryRetrieval → AgentNode → [Conditional]
                                          ↓\n                                    [Has Tool Calls?]
                                    ↓ YES          ↓ NO
                              ApprovalGate      EndMiddleware
                                    ↓                ↓
                              [Approved Tools?]      END
                              ↓ YES        ↓ NO
                        ToolExecution    EndMiddleware
                              ↓                ↓
                        [Continue?]           END
                        ↓ YES      ↓ NO (Max calls)
                   AgentNode      EndMiddleware
```

**Directory Structure:**

```
src/
├── agent/
│   ├── graph.ts              # Main graph builder and wiring
│   ├── state.ts              # Agent state schema (Annotation.Root)
│   ├── fs-checkpointer.ts    # FileSystem checkpointer
│   ├── nodes/                # Graph nodes
│   │   ├── StartMiddleware.ts     # Initialize execution, PII detection
│   │   ├── MemoryRetrieval.ts     # Retrieve memories from Qdrant
│   │   ├── Agent.ts               # LLM inference with tools
│   │   ├── ApprovalGate.ts        # Human-in-the-loop approval
│   │   ├── ToolExecution.ts       # Execute approved tools
│   │   └── EndMiddleware.ts       # Finalize, calculate metrics
│   ├── tools/                # Tool definitions
│   │   └── index.ts          # Tool registry
│   └── middleware/           # Shared middleware logic
│       └── pii.ts            # PII detection utilities
├── assistants/               # Assistant management API
│   ├── types.ts              # Assistant schema
│   ├── router.ts             # CRUD routes
│   └── db.ts                 # JSON file storage
├── lib/
│   ├── config.ts             # Environment configuration (Zod)
│   ├── llm.ts                # LLM client factory
│   └── utils.ts              # Utility functions
├── middleware/
│   └── rateLimit.ts          # IP-based rate limiting
└── index.ts                  # Hono server entry point
```

**Key Components:**

1. **Agent State** (`state.ts`): Comprehensive state management including messages, model calls, token usage, interrupt handling for human-in-the-loop, tool tracking, reasoning steps, and UI streaming.

2. **Tools** (`tools/index.ts`):
   - Web search (DuckDuckGo)
   - URL content fetching (Cheerio)
   - Shell execution with approval modes

3. **Configuration** (`lib/config.ts`): Extensive environment-based configuration using Zod validation for model providers, feature flags, limits, and custom prompts.

4. **API Endpoints:**
   - `/health` - Service health check
   - `/threads` - Thread management
   - `/threads/:id/runs/stream` - Streaming runs with SSE
   - `/threads/:id/runs/resume` - Resume after interrupt
   - `/assistants` - Assistant CRUD operations
   - `/config` - Non-sensitive configuration

#### 3. Packages

##### @horizon/ui - Shared UI Components

- shadcn/ui-based components
- Radix UI primitives
- Tailwind CSS styling
- Glassmorphic design tokens

##### @horizon/agent-memory - Vector Memory System

- Qdrant vector database client
- MemoryClient for high-level operations
- PreferenceExtractor for user learning
- Hybrid retrieval (semantic + recency)
- Support for multiple memory types (conversation, fact, preference, document, summary)

##### @horizon/agent-web - Web Tools

- DuckDuckGo search integration
- URL content extraction with Cheerio
- Content cleaning (removes scripts, styles, nav)

##### @horizon/shell - Shell Execution

- Cross-platform command execution (Bun/Node)
- Approval modes: always, never, dangerous, custom
- Dangerous pattern detection (rm -rf, sudo, DROP TABLE, etc.)
- Configurable timeouts and output limits

---

## Build Commands

### Root Level (Turborepo)

```bash
# Development
bun dev              # Start all dev servers (web + backend)

# Building
bun build            # Build all packages

# Linting
bun lint             # Lint all packages

# Testing
bun test             # Run all tests
```

### Web App (Next.js)

```bash
cd apps/web

# Development
bun dev              # Development server (port 3000)

# Building
bun build            # Production build
bun start            # Production server

# Linting
bun lint             # ESLint
```

### Backend (TypeScript)

```bash
cd apps/backend

# Development
bun dev              # Start LangGraph dev server (uses langgraph-cli)
bun start            # Production server

# Building
bun build            # Compile TypeScript

# Linting
bun lint             # ESLint
```

### Legacy Python Backend (backend-py-legacy)

```bash
cd apps/backend-py-legacy

# Install dependencies
pip install -e ".[dev]"    # Install with dev dependencies
pip install -e .           # Production only

# Linting & Type Checking
ruff check .               # Lint Python files
ruff check --fix .         # Auto-fix linting issues
mypy .                     # Type checking

# Testing
pytest                     # Run all tests
pytest tests/unit_tests    # Unit tests only
pytest tests/integration_tests  # Integration tests
pytest -v                  # Verbose output
pytest -k "test_name"      # Run tests matching pattern
```

---

## Code Style Guidelines

### TypeScript/JavaScript

**Package Manager:** Use `bun` (version 1.3.6+), not pnpm/npm

**Imports:**

- Group imports: React → external libraries → workspace packages (`@horizon/*`) → app imports (`@/*`) → local imports
- Use named exports for utilities and hooks
- Use default exports for page components

```typescript
import { useState } from "react";
import { useChat } from "@langchain/langgraph-sdk";
import { Button } from "@horizon/ui/components/ui/button";
import { useAuth } from "@/lib/stores/auth";
import { ChatArea } from "./chat-area";
```

**Formatting:**

- Prettier configured in package.json
- 2 spaces for indentation
- Single quotes for strings
- Semicolons required
- Trailing commas in multi-line objects/arrays

**Types:**

- Use explicit TypeScript types, avoid `any`
- Use `Record<K, V>` for object types
- Use `T[]` notation for arrays (not `Array<T>`)
- Use `interface` for object shapes, `type` for unions/intersections

**Naming:**

- Components: PascalCase (e.g., `ChatInterface`)
- Hooks: camelCase with `use` prefix (e.g., `useChat`)
- Variables/functions: camelCase (e.g., `isLoading`, `processEvent`)
- Constants: SCREAMING_SNAKE_CASE or camelCase for config objects
- Files: kebab-case for utilities, PascalCase for components

**React Patterns:**

- Mark client components with `"use client"` directive
- Use functional components with TypeScript interfaces
- Use early returns for conditionals
- Destructure props explicitly
- Use `console.log` for debugging with context prefix

```typescript
"use client";

import { useState } from "react";

export interface ChatInterfaceProps {
  threadId: string;
}

export function ChatInterface({ threadId }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);

  if (!threadId) {
    return <Loading />;
  }

  console.log("[Chat] Initializing with thread:", threadId);

  return <div>{/* ... */}</div>;
}
```

**Error Handling:**

- Use `try/catch` with specific error types
- Log errors with context: `console.error("[Chat] Error:", error)`
- Use optional chaining and nullish coalescing: `value?.property ?? default`
- Create custom error types for domain errors

### Python (Legacy Backend Only)

**Imports:**

- Standard library → Third party → Local application
- Relative imports for internal modules

```python
from langgraph.graph import StateGraph, START, END
from typing import Annotated, TypedDict, Any

from agent.state import AgentState
from agent.config import AgentConfig
```

**Docstrings:**

- Use Google-style docstrings
- Required for all public functions and classes
- Include Args, Returns, Raises sections

```python
def build_graph(config: AgentConfig = None) -> CompiledStateGraph:
    """Build the agent graph.

    Args:
        config: Optional agent configuration. Uses environment config if None.

    Returns:
        Compiled StateGraph instance ready for execution.

    Raises:
        ValueError: If configuration is invalid.
    """
```

**Types:**

- Use Python type hints throughout
- Use `typing` module for complex types
- Prefer `TypedDict` for structured state

**Naming:**

- Functions/variables: snake_case (e.g., `build_graph`, `model_calls`)
- Classes: PascalCase (e.g., `AgentState`, `ModelCallMiddleware`)
- Constants: SCREAMING_SNAKE_CASE (e.g., `MAX_TOKENS`)
- Private methods/variables: prefix with `_`

**Linting Rules (ruff):**

- pycodestyle (E) and pyflakes (F) enabled
- isort (I) for import sorting
- pydocstyle (D) with Google convention
- No print statements (T201) - use logging
- Ignore: UP006, UP007, UP035, D417, E501

---

## Key Features & Workflows

### 1. Multi-Model AI Support

The backend supports multiple LLM providers:

- **OpenAI** (GPT-4, GPT-3.5)
- **Anthropic** (Claude 3/3.5)
- **Google** (Gemini)
- **Groq** (Fast inference)
- **Ollama** (Local models)

Configuration via environment variables:

```bash
MODEL_PROVIDER=groq
MODEL_NAME=meta-llama/llama-4-scout-17b-16e-instruct
TEMPERATURE=0.7
MAX_TOKENS=4096
```

### 2. Human-in-the-Loop Workflow

The agent implements a sophisticated approval system:

1. Agent generates tool calls
2. ApprovalGate node checks if approval is needed
3. For dangerous tools (shell, file operations), auto-approval is currently enabled
4. Stream is interrupted with `interrupt_status: "waiting_approval"`
5. Frontend shows approval UI
6. User approves/rejects
7. Stream resumes via `/threads/:id/runs/resume`

**State Management:**

- `interrupt_status`: "idle" | "waiting_approval" | "approved" | "rejected" | "error"
- `interrupt_data`: Contains tool calls pending approval
- `pending_tool_calls`: Tools waiting for approval

### 3. Long-Term Memory System

**Architecture:**

- Qdrant vector database for semantic search
- OpenAI/Ollama embeddings
- Multiple memory types: conversation, fact, preference, document, summary
- Privacy levels: public, private, sensitive
- Hybrid retrieval combining semantic similarity and recency

**Memory Node** (`nodes/MemoryRetrieval.ts`):

- Retrieves relevant memories before agent inference
- Embeds user query
- Searches Qdrant for similar memories
- Injects context into system prompt

### 4. Assistant System

Users can create custom AI assistants:

- Custom system prompts
- Model provider selection
- Tool configuration
- Public/private sharing
- Avatar uploads
- Default assistant per user

**Storage:** JSON file at `data/assistants.json`

### 5. Generative UI for Tool Calls

Tools emit UI events during execution:

- Tool start/complete/fail events
- Custom renderers for each tool type
- Expandable/collapsible results
- Real-time status updates

### 6. Shell Execution Security

The shell tool has multiple safety layers:

- **Approval modes:** always, never, dangerous, custom
- **Dangerous patterns:** rm -rf, sudo, chmod, mkfs, dd, npm install, git push, DROP TABLE, etc.
- **Timeouts:** Configurable (default 30s)
- **Output limits:** 1MB max output
- **Working directory:** Restricted scope

---

## Docker Development

### Development Stack

```bash
# Start all services
docker-compose up

# Services:
# - web: Next.js dev server (port 3000)
# - backend: LangGraph agent (port 2024)
# - qdrant: Vector database (port 6333)
# - redis: Session store (port 6379)
```

### Production Stack

```bash
# Production deployment
docker-compose -f docker-compose.prod.yaml up

# Services:
# - web: Next.js production
# - backend: LangGraph agent
# - sandbox: Isolated code execution
# - redis: Session store
# - nginx: Reverse proxy with SSL
```

### Sandbox Environment

The sandbox provides isolated Python execution:

- Minimal Docker image (Python 3.11-slim)
- Resource limits (CPU, memory)
- No network access
- Read-only filesystem except /tmp
- Suitable for running untrusted code

---

## Environment Variables

### Web App (.env.local)

```bash
# Required
NEXT_PUBLIC_LANGGRAPH_API_URL=http://localhost:2024
JWT_SECRET=your-secret-key

# Optional
NEXT_PUBLIC_APP_NAME=Horizon
NEXT_PUBLIC_APP_DESCRIPTION="AI Assistant Platform"
```

### Backend (.env)

```bash
# Server
PORT=2024
ENVIRONMENT=development

# Model Configuration
MODEL_PROVIDER=groq
MODEL_NAME=meta-llama/llama-4-scout-17b-16e-instruct
TEMPERATURE=0.7
MAX_TOKENS=4096

# API Keys (at least one required)
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_API_KEY=
GROQ_API_KEY=

# Feature Flags
ENABLE_MEMORY=true
ENABLE_SUMMARIZATION=true
ENABLE_PII_DETECTION=true
ENABLE_RATE_LIMITING=true
ENABLE_TOOL_APPROVAL=true

# Vector Database
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=

# Limits
MAX_MODEL_CALLS=10
MAX_TOOL_CALLS=20
MAX_RETRIES=3
```

---

## Testing

### TypeScript/JavaScript

```bash
# Run all tests
bun test

# Run specific test
bun test -- --grep "test name"
```

### Python (Legacy Backend)

```bash
cd apps/backend-py-legacy

# Run all tests
pytest

# Run with coverage
pytest --cov=src --cov-report=html

# Run specific test file
pytest tests/unit_tests/test_configuration.py

# Run specific test
pytest tests/unit_tests/test_configuration.py::test_config_loading
```

---

## CI/CD

### GitHub Actions (backend-py-legacy/.github/workflows/)

1. **unit-tests.yml**
   - Triggers: Push to main, PRs, manual dispatch
   - Python 3.11 & 3.12 matrix
   - Steps: Install uv, lint with ruff, type check with mypy, run pytest

2. **integration-tests.yml**
   - Schedule: Daily at 14:37 UTC
   - Requires: ANTHROPIC_API_KEY, LANGSMITH_API_KEY
   - Runs integration tests against real APIs

---

## Common Development Tasks

### Adding a New Tool

1. Define tool schema in `apps/backend/src/agent/tools/index.ts`
2. Implement tool logic
3. Add to tools array in graph
4. Create UI renderer in web app (if needed)
5. Update assistant tool configuration

### Adding a New Graph Node

1. Create file in `apps/backend/src/agent/nodes/`
2. Implement node function with proper types
3. Add to graph in `graph.ts`
4. Wire edges appropriately
5. Update state types if needed

### Adding a New UI Component

1. Add to `packages/ui/src/components/ui/` if shared
2. Or add to `apps/web/components/` if app-specific
3. Export from `packages/ui/src/index.ts` if shared
4. Update theme tokens if needed

### Modifying State Schema

1. Update `AgentStateAnnotation` in `apps/backend/src/agent/state.ts`
2. Update reducers for new fields
3. Update types in `packages/agent-memory` if memory-related
4. Update frontend types if needed

---

## Troubleshooting

### Common Issues

**Build Errors:**

- Run `bun install` to ensure dependencies are up to date
- Clear `.turbo` cache: `rm -rf .turbo`
- Clear Next.js cache: `rm -rf apps/web/.next`

**LangGraph SDK Connection:**

- Ensure backend is running on port 2024
- Check `NEXT_PUBLIC_LANGGRAPH_API_URL` environment variable
- Verify no CORS issues in browser console

**Qdrant Connection:**

- Ensure Qdrant container is running: `docker-compose ps`
- Check `QDRANT_URL` environment variable
- Verify network connectivity: `curl http://localhost:6333/healthz`

**Authentication Issues:**

- Check `JWT_SECRET` is set
- Clear browser cookies/localStorage
- Verify user exists in database

### Debug Logging

Enable debug logging:

```bash
# Backend
DEBUG=langgraph:* bun dev

# Web
NEXT_PUBLIC_DEBUG=true bun dev
```

---

## Security Considerations

### PII Detection

- Automatic detection of emails, phone numbers, SSNs
- Logs warnings but doesn't block (configurable)
- Pattern-based detection in StartMiddleware

### Rate Limiting

- IP-based rate limiting (100 requests/minute default)
- Configurable via `RATE_LIMIT_WINDOW` and `RATE_LIMIT_MAX_REQUESTS`
- Toggle with `ENABLE_RATE_LIMITING`

### Shell Execution

- Dangerous pattern detection
- Configurable approval workflow
- Resource limits (timeout, output size)
- Never run shell commands without understanding the context

### Authentication

- JWT-based sessions
- Password hashing with bcrypt
- Protected route middleware
- CSRF protection via SameSite cookies

---

## Documentation Updates

**When to Update This File:**

1. **New Features:** Adding major features (new tools, UI components, workflows)
2. **Architecture Changes:** Modifying graph structure, state schema, or API
3. **New Dependencies:** Adding packages that change build/test commands
4. **Configuration Changes:** New environment variables or feature flags
5. **Workflow Updates:** Changes to Docker, CI/CD, or development processes
6. **Breaking Changes:** Any change that affects how agents work on this codebase

**Update Process:**

1. Make your code changes
2. Update AGENTS.md to reflect the changes
3. Include code examples where helpful
4. Update the "Last Updated" date below
5. Commit both code and documentation changes together

---

## Resources

- **Main README:** `/README.md`
- **Legacy Backend README:** `/apps/backend-py-legacy/README.md`
- **Package Documentation:** See individual package READMEs in `/packages/*/`
- **LangGraph Docs:** https://langchain-ai.github.io/langgraphjs/
- **Next.js Docs:** https://nextjs.org/docs

---

**Last Updated:** 2026-02-08

**Maintained by:** AI coding assistants working on Horizon

**Questions?** Check the main README.md or ask in the project chat.
