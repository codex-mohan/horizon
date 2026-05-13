# Horizon Web — Production Implementation Plan

> **Version:** 1.0  
> **Created:** 2026-05-05  
> **Status:** Phase 1-4 Complete, Phase 5-7 In Progress  
> **Maintained by:** AI coding agents  

**This document is the single source of truth for building the Horizon web application.**  
All agents working on this codebase MUST read this file before making any changes.

### Phase Completion Status

| Phase | Status | Notes |
|---|---|---|
| P1: Foundation | ✅ Complete | Dependencies, ultracite, Tailwind theme, Docker Compose, DB schema, Spectra SDK linked |
| P2: Auth & API | ✅ Complete | OAuth (Google + GitHub), JWT, rate limiting, session CRUD, Stripe billing |
| P3: Chat Core | ✅ Complete | Spectra integration, SSE streaming, message persistence, BYOK support |
| P4: Frontend UI | ✅ Complete | All pages, Grok layout, Framer Motion, custom SVG icons, Zustand stores |
| P5: Sandbox | ✅ Complete | BullMQ workers, Docker-in-Docker sandbox (Python/Bash/Node.js) |
| P6: Observability | ✅ Complete | Prometheus metrics, Grafana dashboards (5), Pino + chalk logging |
| P7: Testing & CI | 🔄 In Progress | Vitest, Playwright, load tests, health checks, GitHub Actions CI skeleton created |

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Business Model](#2-business-model)
3. [Database Schema](#3-database-schema)
4. [API Routes](#4-api-routes)
5. [Frontend Design](#5-frontend-design)
6. [Tool Execution (Sandbox)](#6-tool-execution-sandbox)
7. [Observability (Grafana)](#7-observability-grafana)
8. [Logging](#8-logging)
9. [Testing Strategy](#9-testing-strategy)
10. [CI/CD](#10-cicd)
11. [Implementation Phases](#11-implementation-phases)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         User Browser                        │
│              React 19 SPA (Vite, Tailwind 4)                │
│         Framer Motion · Zustand · React Router · Lucide     │
└─────────────────────────────┬───────────────────────────────┘
                              │ HTTPS
┌─────────────────────────────┴───────────────────────────────┐
│                        VPS (Hetzner/DigitalOcean)          │
│  ┌─────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │  Caddy  │  │   Relay     │  │   Sandbox Workers       │ │
│  │ :443    │  │   (Hono)    │  │  (Python/Bash/Node.js)  │ │
│  │         │  │   :3001     │  │  (Docker-in-Docker)     │ │
│  └────┬────┘  └──────┬──────┘  └─────────────────────────┘ │
│       │              │                                       │
│       └──────────────┼──────────────────────────────────────┘
│                      │                                      │
│  ┌───────────────────┼───────────────────────────────────┐ │
│  │              Docker Compose Network                   │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐           │ │
│  │  │ Postgres │  │  Redis   │  │  BullMQ  │           │ │
│  │  │ (Drizzle)│  │ (cache)  │  │ (queue)  │           │ │
│  │  └──────────┘  └──────────┘  └──────────┘           │ │
│  │  ┌──────────┐  ┌──────────┐                         │ │
│  │  │Prometheus│  │ Grafana  │  ← REQUIRED             │ │
│  │  │  :9090   │  │  :3002   │                         │ │
│  │  └──────────┘  └──────────┘                         │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**Relay** uses `@singularity-ai/spectra-agent` / `@singularity-ai/spectra-ai` / `@singularity-ai/spectra-app` from the local `~/Development/Major-Projects/Spectra` workspace.

### Key Decisions
- **Cloud:** Hetzner Cloud or DigitalOcean (cheapest VPS, no lock-in)
- **Reverse Proxy:** Caddy (auto HTTPS, single binary)
- **Orchestration:** Docker Compose (start on one VPS, scale horizontally later)
- **Database:** PostgreSQL 16 (container, move to managed if needed)
- **Cache/Queue:** Redis 7 (sessions, rate limits, BullMQ job queue)
- **Observability:** Prometheus + Grafana (REQUIRED — scrapes relay metrics)

---

## 2. Business Model (Stripe)

| Tier | Price | API Keys | Rate Limit | Code Execution |
|---|---|---|---|---|
| **Free** | $0 | BYOK only | 10 req/min, 50/day | ❌ |
| **Pro** | $15/mo | Server keys + BYOK | 60 req/min, unlimited | ✅ |
| **Enterprise** | Custom | Server keys + BYOK | Custom | ✅ Dedicated |

### LLM Providers (Server Keys)
- **OpenAI** (and OpenAI-compatible endpoints)
- **Anthropic** (and Anthropic-compatible endpoints)

### Billing Integration
- **Stripe Checkout** for subscriptions
- **Stripe Customer Portal** for self-service billing
- **Usage metering:** Token count per session tracked in DB, reported to Stripe
- **Webhooks:** `invoice.paid`, `customer.subscription.deleted` to update user tiers

---

## 3. Database Schema (Drizzle ORM)

### Tables

| Table | Purpose |
|---|---|
| `users` | Auth (email/password + OAuth), tier, Stripe IDs |
| `api_keys` | BYOK storage (AES-256-GCM encrypted) |
| `sessions` | Chat sessions per user |
| `messages` | Chat messages (user/assistant/toolResult) |
| `usage_logs` | Per-request token metering for Stripe |

### Schema Details

```typescript
// users
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }), // null for OAuth-only
  name: varchar("name", { length: 255 }),
  avatarUrl: text("avatar_url"),
  tier: varchar("tier", { length: 50 }).default("free").notNull(),
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// api_keys (BYOK)
export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  provider: varchar("provider", { length: 50 }).notNull(),
  keyEncrypted: text("key_encrypted").notNull(),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// sessions
export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  title: varchar("title", { length: 255 }).default("New Session"),
  model: varchar("model", { length: 100 }).default("gpt-4o"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// messages
export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").references(() => sessions.id).notNull(),
  role: varchar("role", { length: 50 }).notNull(),
  content: text("content").notNull(),
  toolCallId: varchar("tool_call_id", { length: 255 }),
  toolName: varchar("tool_name", { length: 255 }),
  isError: boolean("is_error").default(false),
  tokenUsage: jsonb("token_usage"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

// usage_logs (metering)
export const usageLogs = pgTable("usage_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  sessionId: uuid("session_id").references(() => sessions.id).notNull(),
  model: varchar("model", { length: 100 }).notNull(),
  inputTokens: integer("input_tokens").default(0),
  outputTokens: integer("output_tokens").default(0),
  totalTokens: integer("total_tokens").default(0),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});
```

---

## 4. API Routes (Relay)

### Auth
```
POST /v1/auth/register          # Email/password registration
POST /v1/auth/login             # Email/password login
GET  /v1/auth/oauth/google      # Google OAuth redirect
GET  /v1/auth/oauth/github      # GitHub OAuth redirect
GET  /v1/auth/oauth/:provider/callback
POST /v1/auth/refresh           # JWT rotation
```

### User
```
GET    /v1/me                   # Profile
PATCH  /v1/me                   # Update profile
GET    /v1/api-keys             # List BYOK keys
POST   /v1/api-keys             # Add BYOK key
DELETE /v1/api-keys/:id         # Remove BYOK key
```

### Sessions
```
POST   /v1/sessions             # Create session
GET    /v1/sessions             # List (paginated)
GET    /v1/sessions/:id         # Get with messages
DELETE /v1/sessions/:id         # Delete
```

### Chat
```
POST   /v1/chat/stream          # SSE stream (auth + rate limit)
```

### Billing (Stripe)
```
POST   /v1/stripe/checkout      # Create checkout session
POST   /v1/stripe/webhook       # Stripe webhook handler
```

### Health & Metrics
```
GET    /health                  # Health check
GET    /metrics                 # Prometheus metrics
```

---

## 5. Frontend Design (Grok-Inspired Layout)

### Pages & Routing

| Route | Page | Auth Required |
|---|---|---|
| `/login` | `LoginPage` | No |
| `/signup` | `SignupPage` | No |
| `/pricing` | `PricingPage` | No |
| `/` | `ChatHome` (empty state) | Yes |
| `/c/:sessionId` | `ChatSession` | Yes |
| `/settings` | `SettingsPage` | Yes |

### Chat Layout

```
┌──────────────────────────────────────────────────────────────┐
│ [≡] HORIZON                              [Search] [Imagine]  │
├────┬─────────────────────────────────────────────────────────┤
│ 🏠 │                                                         │
│ 🔍 │              HORIZON (Animated SVG Logo)                │
│ 📝 │                                                         │
│ 📊 │    ┌─────────────────────────────────────────────┐      │
│ 📁 │    │  +  How can I help you today?      [Fast ▼] │      │
│ 🔄 │    └─────────────────────────────────────────────┘      │
│    │                                                         │
│    │     [Analyze data]  [Write code]  [Brainstorm ideas]    │
│    │                                                         │
├────┴─────────────────────────────────────────────────────────┤
│ [Avatar]  SuperHorizon                         [Try Free →]  │
└──────────────────────────────────────────────────────────────┘
```

### Design Rules (Aurora Void + AGENTS.md)

| Rule | Value |
|---|---|
| **Border radius** | 0px everywhere |
| **User messages** | Left gradient avatar + bordered bubble |
| **Assistant messages** | No bubble. Plain text only. |
| **Tool cards** | Inline, collapsible, left accent border, monospace |
| **Surfaces** | Solid only — no glassmorphism |
| **Ambient blobs** | 3-4 blurred gradient circles behind content |
| **Icons** | Custom animated SVG icons for logo, send, loading |
| **Animation** | Framer Motion for page transitions, message entrance, sidebar |

### Tech Stack Additions (Frontend)
```bash
react-router-dom  zustand  framer-motion  lucide-react
```

---

## 6. Tool Execution (Sandbox)

### Supported Languages
- **Python** — data analysis, ML, scripting
- **Bash** — system commands, file operations
- **Node.js** — PPTXGenJS, PDF generation, programmatic workflows

### Architecture
- **BullMQ** job queue backed by Redis
- **Dedicated sandbox worker containers** with Docker-in-Docker
- Each execution: ephemeral container, 30s timeout, 0.5 CPU, 512MB RAM
- **Pro-only feature** — Free tier sees upsell CTA

---

## 7. Observability (Grafana)

> **Grafana is REQUIRED.** Prometheus scrapes `/metrics` on relay. Pre-built dashboards.

### Prometheus Metrics

```
horizon_http_requests_total{method, route, status}
horizon_chat_requests_total{user_tier, model}
horizon_chat_duration_seconds{model}
horizon_tool_executions_total{tool_name, status}
horizon_rate_limit_hits_total{user_tier}
horizon_active_sessions
horizon_active_sse_connections
horizon_sandbox_queue_depth
horizon_sandbox_workers_busy
```

### Grafana Dashboards

1. **API Overview** — Request rate, latency p50/p95/p99, error rate
2. **Chat Metrics** — Messages/min, tokens/min, model distribution
3. **Business** — Active users by tier, MRR (from Stripe)
4. **Infrastructure** — CPU, memory, Postgres connections, Redis memory
5. **Sandbox** — Queue depth, execution duration, failure rate

---

## 8. Logging

| Environment | Library | Format |
|---|---|---|
| **Development** | `chalk` + `console.*` | Colored human-readable |
| **Production** | `pino` | Structured JSON to stdout |

### Example Dev Output
```bash
[11:32:04] [INFO] [Relay] Starting server on :3001
[11:32:04] [INFO] [DB] Connected to PostgreSQL
[11:32:04] [WARN] [RateLimit] User abc123 approaching limit: 58/60
[11:32:05] [ERROR] [Sandbox] Execution timeout: job-456
```

---

## 9. Testing Strategy

### Unit Tests (Vitest)
- `packages/utils`, `packages/types`
- Relay: Auth middleware, rate limiter, session store

### Integration Tests
- Auth flow: Register → Login → Protected route
- Chat flow: Create session → SSE stream → Verify DB state
- Rate limiting: Burst → 429 response

### E2E Tests (Playwright)
- Login → New chat → Send message → Verify assistant response
- Session persistence: Refresh page → Messages restored

### Test Scripts
- **`scripts/health-check.ts`** — Validates all services: Web, Relay, Postgres, Redis, Prometheus, Grafana
- **`scripts/load-test.ts`** — Simulates 100 concurrent users

---

## 10. CI/CD (GitHub Actions)

### `.github/workflows/ci.yml`
- **Lint:** `bun run lint` (ultracite)
- **Typecheck:** `bun run typecheck`
- **Test:** `bun run test` (with Postgres + Redis services)

### `.github/workflows/release-web.yml`
- **Trigger:** Tag `web/v*`
- **Steps:** Build SPA → Upload to CDN; Build relay Docker image → Push to GHCR

---

## 11. Implementation Phases

| Phase | Status | Duration | Deliverable |
|---|---|---|---|
| **P1: Foundation** | ✅ Complete | ~2 sessions | Dependencies, ultracite, Tailwind theme, DB schema, Docker Compose, Spectra SDK link |
| **P2: Auth & API** | ✅ Complete | ~2 sessions | OAuth (Google + GitHub), JWT, rate limiting, session CRUD, Stripe billing |
| **P3: Chat Core** | ✅ Complete | ~2 sessions | Spectra integration, SSE streaming, message persistence, BYOK support |
| **P4: Frontend UI** | ✅ Complete | ~2 sessions | All pages, Grok layout, Framer Motion, custom SVG icons |
| **P5: Sandbox** | ✅ Complete | ~1 session | BullMQ workers, Docker-in-Docker sandbox (Python/Bash/Node.js) |
| **P6: Observability** | ✅ Complete | ~1 session | Prometheus metrics, Grafana dashboards, Pino + chalk logging |
| **P7: Testing & CI** | 🔄 In Progress | ~1 session | Vitest, Playwright, load tests, health checks, GitHub Actions |

---

## Tech Stack Additions Summary

### Frontend (`apps/web`)
```bash
react-router-dom  zustand  framer-motion  lucide-react
```

### Relay (`apps/relay`)
```bash
hono  drizzle-orm  postgres  ioredis  bullmq  pino  prom-client
jose  bcryptjs  stripe  chalk
# dev: drizzle-kit  @types/bcryptjs
```

### Root
```bash
ultracite  # enforced across all packages
```

---

## File Structure (Target)

```
horizon/
├── apps/
│   ├── web/
│   │   ├── src/
│   │   │   ├── main.tsx
│   │   │   ├── App.tsx
│   │   │   ├── index.css
│   │   │   ├── routes/
│   │   │   │   ├── login.tsx
│   │   │   │   ├── signup.tsx
│   │   │   │   ├── pricing.tsx
│   │   │   │   ├── chat-home.tsx
│   │   │   │   ├── chat-session.tsx
│   │   │   │   └── settings.tsx
│   │   │   ├── components/
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── sidebar.tsx
│   │   │   │   ├── chat-input.tsx
│   │   │   │   ├── message-list.tsx
│   │   │   │   ├── user-bubble.tsx
│   │   │   │   ├── assistant-message.tsx
│   │   │   │   ├── tool-card.tsx
│   │   │   │   ├── animated-logo.tsx
│   │   │   │   └── icons/
│   │   │   ├── stores/
│   │   │   │   ├── auth-store.ts
│   │   │   │   ├── chat-store.ts
│   │   │   │   └── session-store.ts
│   │   │   └── lib/
│   │   │       ├── api.ts
│   │   │       └── sse.ts
│   │   └── index.html
│   ├── relay/
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── app.ts
│   │   │   ├── db/
│   │   │   ├── routes/
│   │   │   │   ├── auth.ts
│   │   │   │   ├── sessions.ts
│   │   │   │   ├── chat.ts
│   │   │   │   └── stripe.ts
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts
│   │   │   │   ├── rate-limit.ts
│   │   │   │   └── tier.ts
│   │   │   ├── services/
│   │   │   │   ├── agent-runner.ts
│   │   │   │   ├── sandbox-queue.ts
│   │   │   │   └── stripe.ts
│   │   │   └── lib/
│   │   │       ├── logger.ts
│   │   │       ├── metrics.ts
│   │   │       └── crypto.ts
│   │   └── drizzle.config.ts
│   └── sandbox/
│       ├── Dockerfile
│       ├── src/
│       │   └── worker.ts
│       └── runtimes/
│           ├── python.Dockerfile
│           ├── node.Dockerfile
│           └── bash.Dockerfile
├── packages/
│   ├── ui/
│   ├── types/
│   ├── agent/
│   └── utils/
├── grafana/
│   └── dashboards/
│       ├── api-overview.json
│       ├── chat-metrics.json
│       ├── business.json
│       ├── infrastructure.json
│       └── sandbox.json
├── scripts/
│   ├── health-check.ts
│   └── load-test.ts
├── docker-compose.yml
├── ultracite.json
├── PLAN.md
└── .github/
    └── workflows/
        ├── ci.yml
        └── release-web.yml
```

---

## Agent Instructions

**Before making ANY change to the codebase:**

1. Read `PLAN.md` (this file) to understand the current phase and architecture.
2. Read `AGENTS.md` for coding conventions, design system, and anti-patterns.
3. Ensure changes align with the active implementation phase.
4. Update `PLAN.md` if the architecture or plan changes.
5. Follow the Aurora Void design system strictly — 0px border radius, solid surfaces, no glassmorphism.
6. Use **named exports only** — no default exports.
7. Never use `any` — use `unknown` with type guards.
8. All console logs MUST use `chalk` for coloring.
9. **Grafana is required** — all metrics must be exposed via Prometheus and visualized in Grafana.

**If something in this file is wrong or outdated, fix it immediately. Stale documentation is worse than no documentation.**
