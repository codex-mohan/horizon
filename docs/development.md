# Horizon Development Guide

This guide covers setting up a development environment and contributing to Horizon.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Code Style](#code-style)
- [Testing](#testing)
- [Debugging](#debugging)
- [Common Tasks](#common-tasks)

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Bun | >= 1.3.6 | Runtime and package manager |
| Node.js | >= 20 | Alternative runtime |
| Docker | Latest | Qdrant, Redis containers |
| Git | Latest | Version control |

### Installing Bun

```bash
# Windows (PowerShell)
powershell -c "irm bun.sh/install.ps1 | iex"

# macOS/Linux
curl -fsSL https://bun.sh/install | bash
```

## Getting Started

### 1. Clone and Install

```bash
git clone https://github.com/your-org/horizon.git
cd horizon
bun install
```

### 2. Start Infrastructure

```bash
# Start Qdrant for memory features
docker run -d --name qdrant -p 6333:6333 qdrant/qdrant

# Optional: Start Redis for sessions
docker run -d --name redis -p 6379:6379 redis:alpine
```

### 3. Configure Environment

```bash
# Backend environment
cp apps/backend/.env.example apps/backend/.env
```

Edit `apps/backend/.env`:

```env
# Choose your LLM provider
MODEL_PROVIDER=groq
MODEL_NAME=meta-llama/llama-4-scout-17b-16e-instruct

# API Keys (at least one required)
GROQ_API_KEY=your-key-here
# OPENAI_API_KEY=your-key-here
# ANTHROPIC_API_KEY=your-key-here

# JWT secret for authentication
JWT_SECRET=dev-secret-change-in-production
```

### 4. Start Development Servers

```bash
# Start both frontend and backend
bun dev

# Or start individually
bun dev:web      # Frontend only (port 3000)
bun dev:backend  # Backend only (port 2024)
```

### 5. Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:2024
- **Qdrant Dashboard**: http://localhost:6333/dashboard

## Project Structure

This is a **Turborepo monorepo** with pnpm workspaces.

```
Horizon/
├── apps/
│   ├── web/                    # Next.js 16 frontend
│   │   ├── app/               # App Router pages
│   │   ├── components/        # React components
│   │   ├── lib/               # Utilities, stores, hooks
│   │   └── data/              # Local JSON database
│   │
│   ├── backend/               # TypeScript LangGraph agent
│   │   ├── src/
│   │   │   ├── agent/        # Graph, nodes, tools
│   │   │   ├── assistants/   # Assistant management
│   │   │   └── lib/          # Config, utilities
│   │   └── langgraph.json    # LangGraph config
│   │
│   └── backend-py-legacy/     # Python FastAPI (reference)
│
├── packages/
│   ├── ui/                    # Shared shadcn/ui components
│   ├── agent-memory/          # Qdrant memory system
│   ├── agent-web/             # Web scraping tools
│   └── shell/                 # Shell execution
│
├── config/                    # Configuration files
│   ├── config.schema.json
│   ├── horizon.example.json
│   └── horizon.json          # Your local config (gitignored)
│
├── docs/                      # Documentation
├── turbo.json                 # Turborepo config
└── pnpm-workspace.yaml        # Workspace definition
```

## Development Workflow

### Available Scripts

| Command | Description |
|---------|-------------|
| `bun dev` | Start all dev servers |
| `bun dev:web` | Start frontend only |
| `bun dev:backend` | Start backend only |
| `bun build` | Build all packages |
| `bun lint` | Check code style |
| `bun lint:fix` | Fix code style issues |
| `bun typecheck` | Type check all packages |

### Turborepo

Turbo manages task execution across the monorepo:

```bash
# Run dev in all packages with dependencies
turbo dev

# Build only changed packages
turbo build --filter=...[origin/main]

# Run lint in parallel
turbo lint --parallel
```

### Making Changes

1. **Create a branch**: `git checkout -b feature/my-feature`
2. **Make changes**: Edit relevant files
3. **Run checks**: `bun lint && bun typecheck`
4. **Test**: Verify functionality
5. **Commit**: `git commit -m "feat: add my feature"`

## Code Style

This project uses **Ultracite** (Biome) for linting and formatting.

### Quick Reference

```bash
# Check for issues
bun lint

# Auto-fix issues
bun lint:fix
```

### Key Style Rules

- **TypeScript**: Explicit types, avoid `any`, use `unknown` when needed
- **React**: Function components, hooks at top level, proper key props
- **Imports**: Grouped (React → external → workspace → local)
- **Naming**: PascalCase components, camelCase functions/variables
- **Formatting**: 2 spaces, single quotes, semicolons required

See `.kilocode/rules/ultracite.md` for detailed rules.

### Editor Setup

**VS Code**:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "biomejs.biome",
  "[typescript]": {
    "editor.defaultFormatter": "biomejs.biome"
  }
}
```

## Testing

### TypeScript Tests

```bash
# Run all tests
bun test

# Run specific test file
bun test path/to/test.ts
```

### Python Tests (Legacy Backend)

```bash
cd apps/backend-py-legacy

# Run all tests
pytest

# Run with coverage
pytest --cov=src
```

## Debugging

### Backend Debugging

```bash
# Enable debug logging
DEBUG=langgraph:* bun dev:backend
```

### Frontend Debugging

Open browser DevTools. Key areas:

- **React components**: React DevTools extension
- **State**: Zustand devtools middleware
- **Network**: Check `/api/` requests and SSE streams

### Common Debug Points

```typescript
// Agent graph execution
console.log("[Agent] State:", state);

// Tool execution
console.log("[Tool] Calling:", toolName, args);

// Config loading
console.log("[Config] Loaded from:", configPath);
```

## Common Tasks

### Adding a New Tool

1. Define tool in `apps/backend/src/agent/tools/index.ts`:

```typescript
export const myTool = tool({
  name: "my_tool",
  description: "Does something useful",
  schema: z.object({
    input: z.string(),
  }),
  func: async ({ input }) => {
    // Implementation
    return "result";
  },
});
```

2. Add to tools array
3. Create UI renderer in `apps/web/components/chat/` if needed

### Adding a New UI Component

1. Create in `packages/ui/src/components/ui/` if shared
2. Or in `apps/web/components/` if app-specific
3. Export from appropriate `index.ts`

### Modifying Agent Behavior

1. Edit state in `apps/backend/src/agent/state.ts`
2. Modify nodes in `apps/backend/src/agent/nodes/`
3. Update graph edges in `apps/backend/src/agent/graph.ts`

### Adding Environment Variables

1. Add to `apps/backend/src/lib/config.ts` schema
2. Document in `.env.example`
3. Update `docs/configuration.md`

## Troubleshooting

### Build Errors

```bash
# Clear caches
rm -rf .turbo apps/*/.next apps/*/dist
bun install
```

### Port Already in Use

```bash
# Find process using port
lsof -i :3000
lsof -i :2024

# Kill process
kill -9 <PID>
```

### Qdrant Connection Failed

```bash
# Check Qdrant is running
docker ps | grep qdrant

# Restart Qdrant
docker restart qdrant
```

### Type Errors After Pull

```bash
# Rebuild packages
bun build

# Or just typecheck
bun typecheck
```
