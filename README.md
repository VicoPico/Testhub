# Testhub

Testhub is a fast, developer-focused platform to ingest, store, and explore automated test results (JUnit, Pytest), with a strong emphasis on performance, clarity, and long-term maintainability.

It is designed as a realistic backend-heavy product that demonstrates:

- explicit data modeling
- SQL-first performance thinking
- clean REST APIs
- a modern, scalable SPA UI
- production-oriented authentication and access control

---

## Goals

### Primary goals

- Fast by default
- Predictable SQL queries
- Pagination everywhere
- No ORM magic or N+1 surprises
- Great UX for testers
- Instant navigation
- Powerful filtering
- Clear failure diagnostics
- Easy to grow
- Modular backend and frontend
- Stable UI primitives
- Thoughtful extension points

### Non-goals (by design)

- Microservices
- Event buses / Kafka
- Generic query builders
- Complex permission models (v1)
- “One giant dashboard page”

---

## High-level architecture

```txt
            +-------------------+
            |   React SPA       |
            |  (Vite + shadcn)  |
            +---------+---------+
                      |
                REST API (v1)
                      |
            +---------+---------+
            | Node.js Backend   |
            | Fastify + Prisma  |
            +---------+---------+
                      |
                PostgreSQL

```

## Authentication & access model

Testhub uses API-key–based authentication with strict organization scoping.

- Every request is associated with a request context
- API keys belong to an organization (and optionally a user)
- All protected routes require authentication via the `x-api-key` header
- Projects are always resolved within an organization
- Cross-organization access is prevented by design
- Non-owned resources return 404 to avoid information leakage

This model keeps authorization logic explicit and auditable, without introducing unnecessary complexity in v1.

### Development workflow

In development, API keys can be generated directly via Prisma and stored
locally in the browser through the Settings page.

Keys are sent on each request using the `x-api-key` header.

## Development roadmap

Testhub is developed incrementally, with a strong focus on correctness,
explicit contracts, and long-term maintainability.

The project currently sits at the end of the **foundation phase**, with:

- a stable backend core
- authenticated, org-scoped APIs
- a functional SPA for runs and results

A high-level, non-binding roadmap is maintained in
[`docs/roadmap.md`](docs/roadmap.md), describing the intended evolution
from foundation → ingestion → analytics → production readiness.

## UI model

Testhub is a Single Page Application (SPA) with:

- client-side routing
- a persistent app shell (top bar + sidebar)
- fast in-place navigation
- drawers and dedicated routes instead of deep modal stacks

---

## Core UI patterns

- Lists are pages
- Details open in drawers or dedicated routes
- Deep analysis has dedicated routes
- Filters live in the URL
- Charts are read-only and aggregated

---

## Route map

```txt

/                                   → redirect to last project
/projects/:projectSlug              → Project overview
/projects/:projectSlug/runs         → Runs list
/projects/:projectSlug/runs/:id     → Run details (results, metadata)
/projects/:projectSlug/tests        → Tests explorer
/tests/:testId                      → Test history
/projects/:projectSlug/analytics    → Analytics dashboards
/projects/:projectSlug/settings     → Project settings & ingestion docs

```

### UI layout (wireframe)

```txt
┌───────────────────────────────────────────────────────────────┐
│ TopBar: Project ▾ | Search | ⌘K | Theme | User ▾              │
└───────────────────────────────────────────────────────────────┘
┌───────────────┬───────────────────────────────────────────────┐
│ Sidebar       │ Main content (routed)                         │
│               │                                               │
│  Overview     │  Page header                                  │
│  Runs         │  Filters                                      │
│  Tests        │  Tables / Charts                              │
│  Analytics    │  Drawers / Details                            │
│  Settings     │                                               │
└───────────────┴───────────────────────────────────────────────┘

```

## Key UI primitives

These components are stable contracts and should be reused everywhere.

### Layout

- AppShell
- TopBar
- SidebarNav
- Breadcrumbs

### Page composition

- PageHeader
- StatCards
- FilterBar
- DataTable
- Drawer
- ChartCard
- CodeBlock
- BadgeStatus

> Rule: new features should compose existing primitives before introducing new ones.

---

## Feature ownership

```txt

features/
  projects/    → project selection & overview
  runs/        → runs list, run details, ingestion metadata
  tests/       → test explorer & history
  analytics/   → trends and aggregates

```

Each feature owns:

- its routes
- its API hooks
- its domain-specific UI components

Shared UI lives in `components/common`.

---

## Backend principles

- SQL is a first-class citizen
- Queries are explicit and reviewable
- Pagination, filtering, and sorting are mandatory for list endpoints
- Heavy text blobs (stack traces, stdout, stderr) are lazy-loaded
- JSONB is used only for extensible metadata
- Authentication and org scoping are enforced at the route boundary

---

## Design tokens & theming

Testhub uses design tokens (CSS variables) to guarantee:

- consistent light and dark modes
- easy UI evolution
- zero hard-coded colors

### Base tokens

```txt

--background
--foreground
--card
--card-foreground
--border
--input
--ring
--primary
--primary-foreground
--secondary
--secondary-foreground
--muted
--muted-foreground
--accent
--accent-foreground
--destructive
--destructive-foreground
--radius

```

### Status tokens

```txt

--status-pass
--status-pass-foreground
--status-fail
--status-fail-foreground
--status-skip
--status-skip-foreground
--status-flaky
--status-flaky-foreground

```

### Chart tokens

```txt

--chart-1
--chart-2
--chart-3
--chart-4
--chart-5

```

### Token rules

- No hard-coded hex colors in components
- No utility colors for status (e.g. text-red-500)
- All status colors use status tokens
- All charts use chart tokens
- Components use semantic classes (bg-card, text-muted-foreground)

---

## Performance rules (non-negotiable)

- All list endpoints are paginated
- No endpoint returns unbounded result sets
- Summary counts are precomputed or indexed
- Tables do not fetch stack traces by default
- UI shows loading skeletons instead of blocking

---

## Extension points (future-ready)

- Multiple report formats (JUnit, Pytest, others)
- Flaky test detection heuristics
- Slow test regression tracking
- Materialized views for heavy analytics
- Test ownership and tagging
- CI deep-linking

These are planned, not implemented in v1.

---

## Status

Early development / MVP phase

Backend foundation, authentication, and org scoping complete.
Frontend integration begins in Step 9 (WIP).
