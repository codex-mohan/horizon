# Horizon — Agent Coding Guidelines

> **Last Updated:** 2026-05-04
> **Version:** 2.0 (Spectra Rewrite)
> **Maintained by:** AI coding agents working on Horizon

> **IMPORTANT:** Before making ANY changes, read `PLAN.md` first. It contains the active implementation plan, architecture decisions, and current phase. This file (AGENTS.md) contains coding conventions and design rules. Both are required reading.

**This document is the single source of truth for AI agents working on this codebase.**

---

## 1. Project Identity

**Horizon** is a local-first, agentic AI assistant. Think Claude Desktop, but open and self-hosted.

**Tagline:** *"Past the Event Horizon, everything is possible."*

**Core Philosophy:**

- Local-first: Runs on your machine by default. No cloud required.
- Open: Self-hosted, inspectable, hackable.
- Simple: If a simpler approach works, use it.

**Two Deployment Targets:**

1. **Desktop** — Single-user, local-only, maximum privacy.
2. **Web** — Multi-user, scalable, production deployment with observability.

---

## 2. What Each App Does (and Doesn't Do)

### `apps/web/` — Web SPA

**What it does:**

- Vite + React SPA. Shared UI code consumed by both web and desktop.
- Renders the chat interface, settings, session management.
- Talks to `apps/relay/` via HTTP/SSE in web mode.
- Can optionally run the agent client-side for simple deployments (no relay needed).

**What it does NOT do:**

- Does NOT handle auth directly (delegated to relay).
- Does NOT store API keys in localStorage or browser storage.
- Does NOT execute system tools (shell, fs) — browser sandbox prevents this.
- Does NOT use Next.js, App Router, or SSR. Pure SPA.

**Tech:** Vite, React 19, Tailwind CSS 4, shadcn/ui.

---

### `apps/desktop/` — Tauri Desktop App

**What it does:**

- Wraps the same React UI as `apps/web/` in a Tauri window.
- Runs `@singularity-ai/spectra-agent` directly in the webview (frontend JS).
- System tools (shell, file system) execute via Tauri `invoke()` → Rust bridge.
- Stores sessions in SQLite via Tauri SQLite plugin.
- API keys stored in Tauri secure storage (Keychain on macOS, Credential Manager on Windows).

**What it does NOT do:**

- Does NOT run a separate HTTP server or sidecar. The agent loop lives in the webview.
- Does NOT use Electron (Tauri is smaller, faster, more secure).
- Does NOT bundle Node.js. The Rust binary is the only native runtime.

**Tech:** Tauri (Rust), Vite, React 19. Shared UI from `@horizon/ui`.

---

### `apps/relay/` — Web API (Production Only)

**What it does:**

- Hono HTTP API. Stateless. Horizontally scalable.
- Handles multi-user auth (JWT), session CRUD, rate limiting.
- Runs the Spectra agent loop server-side for web users.
- Streams agent events via SSE to the web frontend.
- Stores sessions in PostgreSQL. Caches in Redis.
- Exposes `/metrics` for Prometheus scraping.
- Structured JSON logging via Pino.

**What it does NOT do:**

- Does NOT serve static files (web SPA is served by CDN/reverse proxy).
- Does NOT store API keys in code or env vars per-user (keys are per-tenant/config).
- Does NOT run in desktop mode. Desktop has no relay.
- Does NOT use WebSockets (SSE is simpler, works through proxies, auto-reconnects).

**Tech:** Hono, Drizzle ORM, PostgreSQL, Redis, Pino, prom-client.

---

### `apps/cli/` — Desktop CLI Manager

**What it does:**

- Bun-based CLI for power users.
- Commands: `horizon start`, `horizon config`, `horizon logs`, `horizon session`.
- Talks to the desktop app via local IPC or config files.
- Dev-friendly output with color, spinners, and tables.

**What it does NOT do:**

- Does NOT manage the web relay.
- Does NOT replace the desktop GUI (complements it).

**Tech:** Bun, `commander` or `oclif`, `chalk`/`picocolors`, `ink` (optional for TUI).

---

## 3. What Each Package Does

### `packages/ui/` — `@horizon/ui`

**What it does:**

- Shared React components and theming.
- Tailwind CSS configuration with Aurora Void theme tokens.
- shadcn/ui base components (Button, Input, Card, etc.) adapted to Horizon design.
- Theme provider: minimal React context for dark/light mode toggle.

**What it does NOT do:**

- Does NOT include app-specific logic (no API calls, no agent state).
- Does NOT include custom glassmorphism effects (solid surfaces only).

---

### `packages/agent/` — `@horizon/agent`

**What it does:**

- Agent configurations, system prompts, and tool definitions.
- Tool implementations that are platform-agnostic (web search, fetch).
- Platform-specific tool wrappers (shell, fs) that delegate to the host.
- Re-exports from `@singularity-ai/spectra-agent` for convenience.

**What it does NOT do:**

- Does NOT contain UI code.
- Does NOT contain database schemas (those live in `packages/types`).

---

### `packages/types/` — `@horizon/types`

**What it does:**

- Zod schemas for all API contracts, database models, and runtime types.
- Shared TypeScript interfaces used across all apps and packages.
- Single source of truth for data shapes.

**What it does NOT do:**

- Does NOT contain runtime logic, validation functions, or transformers.
- Does NOT depend on UI or framework-specific types.

---

### `packages/utils/` — `@horizon/utils`

**What it does:**

- Cross-platform helpers: `sleep`, `assertNever`, safe JSON parsing.
- Structured logger factory (see Logging section).
- Validation utilities.

**What it does NOT do:**

- Does NOT contain app-specific logic.
- Does NOT import from other `@horizon/*` packages (kept at bottom of dependency graph).

---

## 4. Tech Stack & Rationale

| Layer | Technology | Why |
|---|---|---|
| **UI Framework** | Vite + React 19 SPA | Fast DX, simple mental model, identical code for web and desktop. |
| **Styling** | Tailwind CSS 4 + shadcn/ui | Utility-first, design system out of the box, easy to theme. |
| **State** | Zustand | Lightweight, no boilerplate, works outside React where needed. |
| **Desktop Shell** | Tauri (Rust) | 600KB binary vs 100MB Electron. Native OS integrations. |
| **Agent Engine** | `@singularity-ai/spectra-agent` | Pure TS, runs in browser/webview, no server required. |
| **Web Server** | Hono | Lightweight, fast, middleware-based. Fits edge runtimes. |
| **ORM** | Drizzle | Type-safe, SQL-like syntax, works with SQLite and PostgreSQL. |
| **Desktop DB** | SQLite (Tauri plugin) | Zero config, file-based, portable. |
| **Web DB** | PostgreSQL | Concurrent writes, complex queries, fits Docker Compose. |
| **Cache** | Redis | Sessions, rate limits, pub/sub for multi-instance relay. |
| **Web Auth** | JWT (jose) + bcrypt | Stateless, no session store needed per request. |
| **Monorepo** | Turborepo + Bun workspaces | Fast installs, task caching, workspace dependencies. |
| **Validation** | Zod | Shared schemas between frontend and backend. |
| **Testing** | Vitest (TS), cargo test (Rust) | Fast, Vite-native, minimal config. |

---

## 5. Theme & Design System (Aurora Void)

### Philosophy

**Aurora Void** is a dark-first design language built for developer tools. It prioritizes:

- **Maximum contrast** for long coding/terminal sessions
- **Zero eye strain** with true black OLED backgrounds
- **Gradient energy** via large ambient blobs (inspired by Neon DB, Linear)
- **Sharp geometry** — no rounded corners anywhere
- **Solid surfaces** — no transparency, no glassmorphism

### Typography

| Role | Font | Weights | Usage |
|---|---|---|---|
| **Display / Headings** | Sora | 600, 700 | Page titles, section headers, chat sender labels, brand marks |
| **Body / UI** | Satoshi | 400, 500 | Chat messages, buttons, inputs, sidebar items, body text |
| **Mono / Code** | JetBrains Mono | 400, 500 | Code blocks, tool output, CLI text, timestamps, inline code |

**Rules:**

- Use Sora sparingly. Satoshi handles 90% of UI text.
- Never mix more than 3 font families on one screen.
- Mono is for technical content only — not for UI labels.

### Color Palette

#### Base

| Token | Hex | Usage |
|---|---|---|
| `--bg-void` | `#000000` | True black background. OLED perfect. Never use off-black. |
| `--bg-surface` | `#121212` | Cards, panels, sidebar. Visible against void. |
| `--bg-elevated` | `#1E1E1E` | Modals, popovers, inputs, hover states. |
| `--border-subtle` | `rgba(255,255,255,0.14)` | 1px hairline borders for definition. |
| `--border-hover` | `rgba(255,255,255,0.24)` | Hover/active border states. |
| `--text-primary` | `#F8FAFC` | Headings, primary content. |
| `--text-secondary` | `#94A3B8` | Body text, descriptions. |
| `--text-muted` | `#7A8BA3` | Timestamps, placeholders, disabled states. |

#### Accents

| Token | Hex | Usage |
|---|---|---|
| `--accent-indigo` | `#6366F1` | Primary accent. Buttons, links, active states, user bubbles. |
| `--accent-pink` | `#EC4899` | Secondary accent. Highlights, tags. |
| `--accent-emerald` | `#10B981` | Tertiary accent. Success states, status dots. |

#### Gradients

| Token | Value | Usage |
|---|---|---|
| `--gradient-from` | `#4F46E5` | Gradient start (deep indigo). |
| `--gradient-via` | `#6366F1` | Gradient mid (bright indigo). |
| `--gradient-to` | `#06B6D4` | Gradient end (cyan). |

**Gradient applications:**

- Primary CTA buttons: `linear-gradient(135deg, from, via, to)` + glow shadow
- Logo dot, user avatar, accent borders
- Ambient background blobs (heavily blurred, low opacity)
- Never use gradient for body text or long paragraphs

**The only accent palette is Horizon.** No alternative theme variants(yet).

### Visual Language

#### Sharp Corners

- **Border radius: 0px everywhere.** Buttons, cards, inputs, modals, avatars — all sharp.
- This is intentional. It creates a technical, editor-like aesthetic.

#### Solid Surfaces

- **No `backdrop-filter: blur()`.** No glassmorphism. No frosted effects.
- Cards and panels use solid `--bg-surface` or `--bg-elevated`.
- Nav bar is solid black (`--bg-void` or `rgba(0,0,0,0.85)`), not blurred.

#### Ambient Blobs

- 3-4 large radial gradient circles positioned absolutely behind content.
- `filter: blur(80px-120px)`, `opacity: 0.4-0.6`.
- Colors: indigo, violet, cyan — matching the accent gradient.
- Slow CSS float animation (`20s ease-in-out infinite`).
- Blobs are **ambient only** — never placed behind readable text.

#### Depth & Elevation

- Use **borders** (`--border-subtle`) and **background shifts** (`#000 → #121212 → #1E1E1E`) for depth.
- Never use shadows for elevation (except gradient button glows).
- Hover states: border lightens (`--border-hover`) or background shifts up one level.

#### Buttons

- **Primary:** Gradient fill (`135deg, #4F46E5, #6366F1, #06B6D4`) + glow shadow (`box-shadow: 0 4px 24px rgba(99,102,241,0.35)`). Hover intensifies glow.
- **Secondary:** Solid `--bg-surface` + `--border-subtle` border. Hover: `--border-hover` + `--bg-elevated`.
- **Ghost:** Transparent background + text color. Hover: `--bg-surface`.

#### Tool Cards (Inline)

- Compact, left-border accent (`2px solid gradient`), monospace font.
- Background: `--bg-void` (darker than chat bubble to distinguish).
- Expandable. Default to collapsed.

### Component Styling Rules

**DO:**

- Use Tailwind utility classes exclusively.
- Use design tokens (CSS variables) — never hardcode hex values in components.
- Use `border` utility with token colors for all borders.
- Use `font-sora`, `font-satoshi`, `font-mono` utilities.

**DON'T:**

- No `rounded-md`, `rounded-lg`, `rounded-xl` — use `rounded-none` or omit.
- No `bg-white/10`, `bg-black/20` — solid colors only.
- No `backdrop-blur`, `backdrop-filter`.
- No gradient text (hard to read, poor accessibility).
- No animated scrollbars (distracting).
- No box-shadows on cards (use borders for definition).

### Theme

**Horizon** is the only theme. The accent palette is fixed: indigo/cyan gradient.

No theme toggle for accent colors (only one palette exists). Dark/light mode toggle is required via `data-theme-mode` attribute on `<html>` (`dark` | `light`). The app defaults to dark.

---

## 6. System Design

### Desktop Architecture (Local-First)

```
┌─────────────────────────────────────┐
│  Tauri Window (WebKit/WebView)     │
│  ┌───────────────────────────────┐ │
│  │  React App                     │ │
│  │  ┌──────────────────────────┐ │ │
│  │  │  @horizon/ui components   │ │ │
│  │  │  @horizon/agent (tools)   │ │ │
│  │  │  Spectra Agent (in-view)  │ │ │
│  │  └──────────────────────────┘ │ │
│  └───────────────────────────────┘ │
│              │                      │
│              ▼ Tauri invoke()      │
│  ┌───────────────────────────────┐ │
│  │  Rust Layer                    │ │
│  │  - Shell commands              │ │
│  │  - File system access          │ │
│  │  - Secure API key storage      │ │
│  │  - SQLite (sessions)           │ │
│  └───────────────────────────────┘ │
└─────────────────────────────────────┘
```

**Key Decisions:**

- Agent loop runs in the webview, not a sidecar. This is possible because Spectra is pure TS.
- System tools call Tauri `invoke()` which delegates to Rust. The Rust side has OS-level permissions.
- API keys are stored in OS-native secure storage (Keychain/Credential Manager), not in code or localStorage.
- SQLite is accessed via Tauri plugin, not a separate server process.

---

### Web Architecture (Production)

```
                    ┌──────────────┐
                    │   User       │
                    └──────┬───────┘
                           │ HTTPS
                           ▼
                    ┌──────────────┐
                    │  CDN / Nginx │  (Static SPA)
                    └──────┬───────┘
                           │ API calls / SSE
                           ▼
              ┌────────────────────────┐
              │      Hono Relay        │
              │  ┌──────────────────┐  │
              │  │ Auth middleware   │  │
              │  │ Rate limiting     │  │
              │  │ Session routes    │  │
              │  │ Chat stream (SSE) │  │
              │  │ /metrics          │  │
              │  └──────────────────┘  │
              └───────────┬────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
    ┌──────────┐   ┌──────────┐   ┌──────────┐
    │PostgreSQL│   │  Redis   │   │Prometheus│
    │ (Drizzle)│   │ (cache)  │   │ (metrics)│
    └──────────┘   └──────────┘   └────┬─────┘
                                        │
                                        ▼
                                 ┌──────────┐
                                 │  Grafana │
                                 │(dashboard)│
                                 └──────────┘
```

**Key Decisions:**

- Relay is stateless. Any instance can handle any request. Scale horizontally.
- Agent loop runs in the relay process, not the browser. API keys are server-side secrets.
- SSE (Server-Sent Events) for streaming. Simpler than WebSockets, works through proxies/firewalls.
- PostgreSQL for persistence. Redis for ephemeral state (rate limits, session cache).
- Prometheus scrapes `/metrics`. Grafana visualizes. Pino logs to stdout (collected by Docker/log aggregator).

---

## 7. Patterns (DO)

- **Flat message streams.** No branching, no complex grouping. Linear chat history.
- **Tool calls render as inline expandable cards.** Compact, unobtrusive, expandable for detail.
- **Desktop: Spectra subscriber pattern.** `agent.subscribe()` for global state, `agent.prompt()` to trigger runs.
- **Web: Spectra generator pattern.** `for await...of agent.run()` streamed over SSE.
- **One `@horizon/ui` package.** All React components and theming live here. Both web and desktop consume it.
- **Tools are plain JS functions.** Passed to Spectra's `Agent` constructor. No special framework.
- **Explicit error handling.** Try/catch with context. Never swallow errors silently.
- **Named exports.** No default exports for components or utilities.
- **Zod schemas at boundaries.** Validate all external input (API requests, localStorage, config files).
- **Environment-driven config.** Behavior changes via env vars, not code branches.

---

## 8. Anti-Patterns (DON'T)

- **No LangGraph-style state machines.** Spectra is a lightweight loop, not a graph.
- **No glassmorphism.** Solid surfaces only. No `backdrop-filter: blur()`.
- **No client-side API key storage.** Never store keys in localStorage, cookies, or frontend code.
- **No generative UI as separate heavy components.** Inline compact cards only.
- **No server for desktop.** The desktop app runs Spectra directly in the webview.
- **No branching conversation trees.** Flat linear history. If users want to fork, create a new session.
- **No Next.js.** This is a SPA. No SSR, no App Router, no hydration complexity.
- **No Electron.** Tauri is the desktop shell.
- **No speculative abstractions.** Build what is needed now. Clean extension points are enough.

---

## 9. Deployment Strategy

### Desktop

**Distribution:**

- GitHub Releases with Tauri auto-updater.
- Windows: `.msi` installer.
- macOS: `.dmg` + `.app` (signed + notarized for production).
- Linux: `.AppImage` or `.deb`.

**Release Flow:**

1. Tag `desktop/vX.Y.Z`.
2. GitHub Actions runs `cargo tauri build` for all platforms.
3. Artifacts attached to release.
4. Auto-updater checks GitHub releases on app start.

---

### Web

**Infrastructure:**

- Docker Compose for self-hosted deployment.
- Reverse proxy: Caddy (auto HTTPS) or Nginx.
- Static SPA served by CDN or Nginx.
- Relay runs as container(s) behind load balancer.

**Docker Compose Stack:**

```yaml
services:
  relay:       # Hono API
  postgres:    # Session DB
  redis:       # Cache + rate limiting
  prometheus:  # Metrics scraping
  grafana:     # Dashboards
```

**Scaling:**

- Relay is stateless. Scale to N instances behind a load balancer.
- PostgreSQL handles concurrency. Read replicas if needed.
- Redis handles distributed rate limiting.

**Cloud Deployment (Optional):**

- Fly.io: Native Docker support, auto-SSL, global edge.
- Railway: Simple Git-based deploys.
- Hetzner/Vultr: Self-managed VPS (cheapest for sustained load).

---

## 10. GitHub Workflows

### `.github/workflows/ci.yml`

- Triggers: PR, push to main.
- Jobs:
  - `lint`: `bun run lint` across all packages.
  - `typecheck`: `bun run typecheck` across all packages.
  - `test`: `bun run test` across all packages.
  - `build`: `bun run build` to verify no build errors.

### `.github/workflows/release-desktop.yml`

- Triggers: Tag `desktop/v*`.
- Jobs:
  - Build Tauri app on `ubuntu-latest`, `macos-latest`, `windows-latest`.
  - Upload artifacts to GitHub Release.

### `.github/workflows/release-web.yml`

- Triggers: Tag `web/v*`.
- Jobs:
  - Build SPA static files.
  - Build Docker image for relay.
  - Push to container registry (GHCR or Docker Hub).

---

## 11. Testing Strategy

### Unit Tests

- **Packages:** Vitest. Test pure functions, Zod schemas, utility helpers.
- **Agent tools:** Mock external calls. Test tool argument validation and error handling.

### Integration Tests

- **Relay:** Spin up test PostgreSQL (testcontainers or ephemeral DB). Test auth flow, session CRUD, SSE streaming.
- **Desktop:** Tauri does not easily support automated E2E. Manual QA for critical paths.

### E2E Tests

- **Web:** Playwright. Test chat flow, settings, auth.
- Run against a local Docker Compose stack.

### Test Data

- Never use production API keys in tests.
- Mock LLM responses for deterministic agent behavior tests.

---

## 12. Logging & Telemetry

### Desktop (Local-First)

**Goal:** Dev-friendly, human-readable logs.

- **Library:** `picocolors` or `chalk` for colored output.
- **Format:** Plain text with context labels.

  ```
  [Agent] Starting run with model=gpt-4o
  [Tool:shell] Executing: du -sh /
  [Tool:shell] Completed in 340ms
  ```

- **Storage:** Logs written to `~/.horizon/logs/horizon.log` (rotated daily).
- **CLI:** `horizon logs --tail` streams the log file with color.
- **No telemetry sent to external servers.** Privacy is paramount.

### Web (Production)

**Goal:** Structured, queryable, observable.

- **Library:** Pino (structured JSON logging).
- **Format:** JSON lines to stdout.

  ```json
  {"level":"info","time":1714819200000,"msg":"Chat stream started","sessionId":"abc123","userId":"user456","model":"gpt-4o"}
  ```

- **Collection:** Docker log driver or Fluent Bit forwards to Loki / Elasticsearch.
- **Metrics:** `prom-client` exposes counters and histograms at `/metrics`.
  - `horizon_chat_requests_total`
  - `horizon_chat_duration_seconds`
  - `horizon_tool_executions_total`
  - `horizon_active_sessions`
- **Dashboards:** Grafana with pre-built panels.
- **Alerting:** Prometheus Alertmanager → Slack/PagerDuty for error rate spikes.
- **OpenTelemetry (optional):** Trace requests across relay → DB → LLM API.

---

## 13. Maintenance Strategy

### Dependency Updates

- **Weekly:** Automated PRs via Dependabot or Renovate.
- **Security patches:** Applied immediately.
- **Major versions:** Evaluated monthly. Breaking changes handled in dedicated PRs.

### Database Migrations

- Drizzle handles schema migrations.
- Migrations run automatically on relay startup (`drizzle-kit migrate`).
- Never modify existing migrations. Create new ones.

### Backward Compatibility

- API versioning in URL (`/v1/chat`).
- Desktop auto-updater ensures users are on latest.
- Session export/import for data portability.

### Monitoring & Alerts (Web)

- Error rate > 1% → Alert.
- Response time p95 > 2s → Alert.
- Disk usage > 80% → Alert.
- LLM API error rate spike → Alert.

---

## 14. Project Structure

```
horizon/
├── apps/
│   ├── web/              # Vite + React SPA
│   ├── desktop/          # Tauri + Vite + React
│   ├── relay/            # Hono API (web production only)
│   └── cli/              # Bun CLI for desktop management
├── packages/
│   ├── ui/               # @horizon/ui — React components, Tailwind theme
│   ├── agent/            # @horizon/agent — Agent configs, tools, prompts
│   ├── types/            # @horizon/types — Zod schemas, shared types
│   └── utils/            # @horizon/utils — Logger, helpers, validators
├── turbo.json
├── package.json          # Bun workspaces
├── docker-compose.yaml   # Web stack
└── AGENTS.md             # This file
```

---

## 15. Agent Guidelines

### Before Making Changes

1. Read the relevant section of this file.
2. Check if the change affects multiple apps/packages.
3. Prefer modifying one package at a time.

### When Adding a Feature

1. Start with `packages/types/` — define the schema.
2. Implement in the relevant app/package.
3. Add tests if the project has test infrastructure for that area.
4. Update this file if the architecture or boundaries change.

### Code Style

- **TypeScript:** Explicit types, no `any`. Use `unknown` when necessary.
- **React:** Function components only. Named exports. Props destructured with interfaces.
- **Imports:** External → `@horizon/*` → Relative.
- **Error handling:** Contextual try/catch. Log then re-throw or return error result.

### Commit Messages

Follow Conventional Commits:

```
feat(web): add model selector dropdown
fix(relay): resolve SSE connection leak
refactor(ui): extract chat bubble component
docs(agents): update deployment strategy
```

---

## 16. Dependency Management

> **Package Manager:** Bun 1.3+

**Never edit `package.json` dependencies manually.** Always use `bun add` so Bun resolves the correct, latest compatible version and updates the lockfile.

### Adding Dependencies

```bash
# Add to a specific app/package
bun add --cwd apps/web react-router-dom
bun add --cwd packages/ui @radix-ui/react-dialog

# Add dev dependency
bun add --cwd apps/relay -D drizzle-kit

# Add to root (only if used by 3+ packages)
bun add -D turbo
```

**Rules:**

- Only add to root `package.json` if used by 3+ packages/apps.
- Use `workspace:*` for internal `@horizon/*` dependencies (Bun handles this automatically when linking).
- Never pin exact versions unless there's a known bug. Let Bun's lockfile handle reproducibility.
- **Prefer fewer dependencies.** Every dependency is a liability.
- **Audit before adding:** Check bundle size, maintenance status, and license.

### Updating Dependencies

```bash
bun update                # Update all to latest compatible
bun update hono          # Update specific package
```

- **Security patches:** Apply immediately via `bun update <pkg>`.
- **Minor updates:** Weekly via Dependabot/Renovate PRs.
- **Major updates:** Evaluate breaking changes in isolation. Update one major dependency at a time.
- **Never update everything at once.** If something breaks, you won't know what caused it.

### Removing Dependencies

```bash
bun remove --cwd apps/web some-package
```

- When removing, run `bun install` to clean up the lockfile.
- Check if the dependency is used transitively by other packages before removing.

### Lockfile

`bun.lockb` is committed to git. Never edit it manually. It is Bun's source of truth for reproducible installs.

---

## 17. Coding Principles

These principles govern all code written for Horizon. Listed in order of priority.

### 1. KISS — Keep It Simple, Stupid

> If a simpler approach works, use it. Avoid clever abstractions.

- Prefer straightforward, readable solutions.
- Avoid premature optimization. Optimize only when profiling shows a need.
- A 10-line function that anyone can understand is better than a 2-line function that requires a PhD.

### 2. YAGNI — You Aren't Gonna Need It

> Do not implement speculative features. Build only what is needed now.

- Do not add abstraction layers "just in case."
- Do not build admin dashboards before you have users.
- Do not add config options for scenarios that don't exist yet.
- Clean extension points are enough. Build the door frame, not the door.

### 3. DRY — Don't Repeat Yourself

> Extract shared logic into utilities, hooks, or shared packages.

- Never duplicate business logic across frontend and backend.
- If you write the same code 3 times, extract it.
- Shared packages (`@horizon/*`) exist for this reason.

### 4. Separation of Concerns

> Each module, component, and function should have a single, clear responsibility.

- UI components display data. They do not fetch it.
- API routes handle HTTP. They do not contain business logic.
- Business logic lives in services/utilities, not scattered in handlers.

### 5. Fail Fast, Fail Loud

> Validate inputs early. Throw descriptive errors. Never swallow exceptions silently.

- Use Zod schemas at all boundaries (API, config, external data).
- Use early returns to reduce nesting.
- Log errors with context, then re-throw or return a proper error result.

### 6. Explicit Over Implicit

> Use explicit types, named exports, and clear function signatures.

- No `any`. Use `unknown` when the type is genuinely uncertain.
- Named exports only. No default exports.
- Function parameters should be self-documenting.

### 7. Composition Over Inheritance

> Build functionality by composing smaller, focused units.

- Prefer hooks and utility functions over class hierarchies.
- Spectra tools are plain functions, not classes.
- React components compose, they don't inherit.

### 8. Interface Segregation

> Don't force consumers to depend on what they don't use.

- Split large interfaces into smaller, focused ones.
- A component's props interface should only include what it needs.
- A package's exports should be granular.

---

## 18. Critical Principles

### API Design

- **Version in URL:** `/v1/chat`, not in headers.
- **Consistent error format:** `{ error: string, code?: string }`.
- **Never break backward compatibility without a version bump.**

### Security

- **Never commit secrets.** Use `.env` files (gitignored) and Tauri secure storage.
- **Validate all inputs.** Zod on the backend, form validation on the frontend.
- **Sanitize output.** Escape HTML in user-generated content.
- **CSP headers** in web deployment to prevent XSS.

### Performance

- **Lazy load routes** in the SPA.
- **Virtualize long lists** (sessions, messages) with `react-window` or similar.
- **Memoize expensive computations** with `useMemo`, but only when profiling shows a benefit.
- **Bundle size matters.** Use tree-shakeable imports.

### State Management

- **Use Zustand for client state.** Lightweight, no boilerplate.
- **Server state belongs on the server.** Don't mirror the entire DB in the frontend.
- **URL is state.** Use query params for shareable/filterable views.

### CSS / Styling

- **Tailwind utility classes only.** No custom CSS files unless absolutely necessary.
- **Design tokens in Tailwind config.** No hardcoded hex values in components.
- **Mobile-first responsive design.**

### Database

- **Drizzle ORM for all DB access.** Raw SQL only for complex queries.
- **Migrations are immutable.** Never edit a deployed migration.
- **Index foreign keys and query patterns.**

### Documentation

- **This file is the source of truth.** Update it when architecture changes.
- **Code comments explain WHY, not WHAT.** The code should explain what.
- **README files per app/package** for setup and usage.

---

## 19. Quick Reference

| Task | Command |
|---|---|
| Install deps | `bun install` |
| Dev (all) | `bun dev` |
| Dev (web only) | `bun dev:web` |
| Build (all) | `bun run build` |
| Type check | `bun run typecheck` |
| Desktop build | `cd apps/desktop && cargo tauri build` |
| Relay dev | `cd apps/relay && bun dev` |
| DB migrate | `cd apps/relay && bun run db:migrate` |

---

**If something in this file is wrong or outdated, fix it immediately. Stale documentation is worse than no documentation.**
