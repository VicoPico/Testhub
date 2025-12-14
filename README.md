# Testhub

Testhub is a fast, developer-friendly platform to ingest, store, and explore automated test results (JUnit / Pytest), with a focus on performance, usability, and long-term maintainability

It is designed as a realistic backend-heavy product that demonstrates:

- explicit data modeling
- SQL-first performance thinking
- clean REST APIs
- a modern, scalable SPA UI

### Goals

Primary goals

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

Non-goals (by design)

- ❌ Microservices
- ❌ Event buses / Kafka
- ❌ Generic query builders
- ❌ Complex permission models (v1)
- ❌ “One giant dashboard page”

### High-level architecture

```
txt
                +-------------------+
                |   React SPA       |
                |  (shadcn/ui)      |
                +---------+---------+
                          |
                    REST API (v1)
                          |
                +---------+---------+
                |   Go Backend      |
                |  Explicit SQL     |
                +---------+---------+
                          |
                    PostgreSQL

```

### UI model

Testhub is a Single Page Application (SPA) with:

- client-side routing
- a persistent app shell (top bar + sidebar)
- fast in-place navigation
- drawers instead of excessive page navigation

### Core UI patterns

- Lists are pages
- Details open in drawers
- Deep analysis has dedicated routes
- Filters live in the URL
- Charts are read-only and aggregated

### Route map

```

/                             → redirect to last project
/projects/:projectId          → Project overview
/projects/:projectId/runs     → Runs list
/runs/:runId                  → Run details (tests, suites)
/projects/:projectId/tests    → Tests explorer
/tests/:testId                → Test history
/projects/:projectId/analytics→ Analytics dashboards
/projects/:projectId/settings → Project settings & ingestion docs

```

### UI layout (wireframe)

```
┌───────────────────────────────────────────────────────────────┐
│ TopBar: Project ▾ | Search | ⌘K | 🌙/☀ | User ▾               │
└───────────────────────────────────────────────────────────────┘
┌───────────────┬───────────────────────────────────────────────┐
│ Sidebar       │ Main content (routed)                         │
│               │                                               │
│  Overview     │  Page header                                  │
│  Runs         │  Filters                                      │
│  Tests        │  Tables / Charts                              │
│  Analytics    │  Drawers for details                          │
│  Settings     │                                               │
└───────────────┴───────────────────────────────────────────────┘

```

### Key UI primitives

These components are stable contracts and should be reused everywhere.

Layout

- AppShell
- TopBar
- SidebarNav
- Breadcrumbs

Page composition

- PageHeader
- StatCards
- FilterBar
- DataTable
- Drawer
- ChartCard
- CodeBlock
- BadgeStatus

> Rule: New features should compose existing primitives before introducing new ones.

### Feature ownership

```

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

Shared UI lives in components/common.

### Backend principles

- SQL is a first-class citizen
- Queries are explicit and reviewable
- Pagination, filtering, sorting are mandatory for list endpoints
- Heavy text blobs (stack traces, stdout) are lazy-loaded
- JSONB is used only for extensible metadata

### Design tokens & theming

Testhub uses design tokens (CSS variables) to guarantee:
• consistent light/dark mode
• easy UI evolution
• zero hard-coded colors

### Base tokens

```

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

```

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

```

--chart-1
--chart-2
--chart-3
--chart-4
--chart-5

```

Token rules

- ❌ No hard-coded hex colors in components
- ❌ No text-red-500 for statuses
- ✅ All status colors use status tokens
- ✅ All charts use --chart-\* tokens
- ✅ Components use semantic classes (bg-card, text-muted-foreground)

Performance rules (non-negotiable)

- All list endpoints are paginated
- No endpoint returns unbounded result sets
- Summary counts are precomputed or indexed
- Tables do not fetch stack traces by default
- UI shows loading skeletons instead of blocking

Extension points (future-ready)

- Multiple report formats (JUnit → Pytest → others)
- Flaky test detection heuristics
- Slow test regression tracking
- Materialized views for heavy analytics
- Test ownership & tagging
- CI deep-linking

These are planned, not implemented in v1.

Why Testhub exists

Testhub is intentionally scoped to:

- feel like a real internal tool
- highlight backend and data modeling skills
- demonstrate thoughtful UI/UX engineering
- remain fast and pleasant as it grows

It favors clarity over cleverness and usability over abstraction.

### Status

🚧 Early development / MVP phase
