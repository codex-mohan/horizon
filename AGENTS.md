# AGENTS.md

This document provides guidelines for agentic coding assistants working on the Horizon codebase.

## Project Overview

Horizon is a monorepo with:

- **apps/web**: Next.js 16 React application (TypeScript)
- **apps/backend**: Python FastAPI + LangGraph agent
- **packages/ui**: Shared UI components
- **packages/typescript-config**: TypeScript configuration
- **packages/eslint-config**: ESLint configuration

## Build Commands

### Root Level (Turborepo)

```bash
pnpm build          # Build all packages
pnpm dev            # Run all dev servers
pnpm lint           # Lint all packages
pnpm format         # Format all files with Prettier
```

### Web App (Next.js)

```bash
cd apps/web
pnpm build          # Production build
pnpm dev            # Development server (port 3000)
pnpm lint           # Run ESLint
pnpm start          # Production server
```

### Python Backend

```bash
cd apps/backend
# Install dependencies
pip install -e ".[dev]"    # Install with dev dependencies
pip install -e .           # Install production only

# Linting & Type Checking
ruff check .               # Lint Python files
ruff check --fix .         # Auto-fix linting issues
mypy .                     # Type checking

# Testing
pytest                     # Run all tests
pytest tests/              # Run specific test directory
pytest tests/file.py       # Run specific test file
pytest file.py::test_func  # Run specific test function
pytest -v                  # Verbose output
pytest -k "test_name"      # Run tests matching pattern
```

## Code Style Guidelines

### TypeScript/JavaScript

**Imports:**

- Use absolute imports with `@/` alias for app imports
- Use `@workspace/ui/*` for shared UI package imports
- Group imports: React → external libraries → app imports → local imports
- Use named exports for utilities and hooks
- Use default exports for page components

```typescript
import { useState } from "react";
import { useChat } from "@/lib/chat";
import { ChatArea } from "./chat-area";
import type { Message } from "@/types";
```

**Formatting:**

- Use Prettier (configured in package.json)
- 2 spaces for indentation
- Single quotes for strings
- Semicolons required
- Trailing commas in multi-line objects/arrays

**Types:**

- Use explicit TypeScript types, avoid `any`
- Use `Record<K, V>` for object types
- Use `Array<T>` or `T[]` consistently (project uses `T[]`)
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

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);

  if (!isReady) {
    return <Loading />;
  }

  return <div>{/* ... */}</div>;
}
```

**Error Handling:**

- Use `try/catch` with specific error types
- Log errors with context: `console.error("Chat error:", error)`
- Use optional chaining and nullish coalescing: `value?.property ?? default`
- Create custom error types for domain errors

### Python

**Imports:**

- Use `isort` for import sorting (ruff handles this)
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

**Error Handling:**

- Use specific exception types
- Log with context using middleware console
- Let exceptions propagate for unexpected errors
- Handle known error cases explicitly

```python
try:
    config = AgentConfig.from_env()
    max_calls = config.max_model_calls
except Exception:
    max_calls = 20
```

**Linting Rules (ruff):**

- pycodestyle (E) and pyflakes (F) enabled
- isort (I) for import sorting
- pydocstyle (D) with Google convention
- No print statements (T201)
- Ignore: UP006 (from **future**), UP007 (annotations), D417 (undocumented params)

## Testing

### Python Backend

- Tests located in `tests/` directory
- Use `pytest` as the test runner
- Fixtures go in `conftest.py`
- Follow naming: `test_*.py` files, `test_*` functions

### TypeScript/Web

- No test configuration found; follow existing patterns if adding tests
- Use Testing Library or Vitest conventions

## Directory Structure

```
apps/web/
  app/           Next.js App Router pages
  components/    React components (grouped by feature)
  lib/           Utilities and configs
  hooks/         Custom React hooks
  types/         TypeScript type definitions

apps/backend/src/agent/
  graph.py       Main graph builder
  state.py       State schema definition
  tools/         Tool implementations
  middleware/    Middleware components
  config/        Configuration loading
  prompts/       Prompt templates
```

## Key Patterns

### TypeScript Component

```typescript
"use client";

import { useState } from "react";

export interface ComponentProps {
  title: string;
  onAction?: () => void;
}

export function Component({ title, onAction }: ComponentProps) {
  const [state, setState] = useState(false);

  if (!state) {
    return null;
  }

  return <button onClick={onAction}>{title}</button>;
}
```

### Python State Definition

```python
from typing import TypedDict, Annotated, Any
from langgraph.graph.message import add_messages
from langchain_core.messages import BaseMessage

class AgentState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    model_calls: int
    metadata: dict[str, Any]
```

## Environment Variables

- Web: `NEXT_PUBLIC_*` prefix for client-side variables
- Python: Use `python-dotenv`, load via `AgentConfig.from_env()`
- Never commit `.env` files; use `.env.example` as template

## Other Notes

- Use `pnpm` as the package manager (version 10.4.1+)
- Node.js 20+ required
- Prettier formats on save in IDE
- ruff format for Python
- Run `pnpm lint` before committing
