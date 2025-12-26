# Testhub Roadmap

This document describes the **intended development path** of Testhub.
It is a guideline, not a strict checklist. The goal is to evolve the product
organically while keeping the architecture coherent.

---

## Current baseline

Testhub currently provides:

- Fastify + Prisma + Postgres backend
- API-key–based authentication via `x-api-key`
- Request context with strict organization scoping
- Protected runs API (list, details, results, ingestion)
- SPA frontend with:
  - Runs list
  - Run details & results
  - Dev UI to set/clear API key

This is the foundation for all further work.

---

## Phase 1 — Stabilize the foundation (current focus)

**Goal:** Make the existing system boringly reliable.

- Finalize the public API surface
  - Document existing endpoints in `contracts/openapi.yaml`
  - Align error semantics (401 vs 403 vs 404)
- Improve dev ergonomics
  - One-command local bootstrap
  - Scripted API key creation & revocation
- Harden cross-cutting behavior
  - Deterministic CORS configuration
  - Consistent auth enforcement on all protected routes
- Add lightweight observability
  - Request IDs
  - Structured logs for auth and routing

---

## Phase 2 — Auth model evolution

**Goal:** Move from “dev auth” to a usable security model.

- API key management
  - List keys (masked)
  - Create & revoke keys
  - Track `lastUsedAt`
- Key semantics
  - Decide on scopes or key types (read vs ingest)
- UI evolution
  - Keep Settings-based key input for dev
  - Introduce Org-level settings later

---

## Phase 3 — Runs as a first-class product feature

**Goal:** Make runs genuinely useful day-to-day.

- Results UX
  - Filtering (status, suite, tags)
  - Sorting
  - Search by test name
- Run lifecycle
  - RUNNING → COMPLETED transitions
  - Accurate timestamps & durations
- Pagination
  - Cursor-based pagination everywhere
  - Filters persisted in URL

---

## Phase 4 — Ingestion MVP (real-world usage)

**Goal:** Accept real CI data safely and reliably.

- Ingestion endpoints
  - Idempotency guarantees
  - Payload validation & size limits
- Format support
  - Start with a canonical JSON format
  - Optionally add JUnit XML parsing
- Security
  - Separate ingestion keys from read keys
  - Minimal audit logging

---

## Phase 5 — Tests explorer & history

**Goal:** Make individual tests first-class citizens.

- Tests list page
  - Pass rate, failure rate, flakiness signals
- Test detail view
  - Historical timeline across runs
- Storage strategy
  - Avoid heavy blobs in list endpoints
  - Index for common queries

---

## Phase 6 — Analytics (aggregated, read-only)

**Goal:** Provide insight without hurting performance.

- Core metrics
  - Failures over time
  - Slowest tests
  - Most unstable suites
- Data strategy
  - Aggregation endpoints only
  - Materialized views if needed

---

## Phase 7 — Production readiness

**Goal:** Safe to deploy and operate.

- Configuration
  - Strict env validation
  - Dev / staging / prod separation
- Reliability
  - Rate limiting
  - Graceful shutdown
  - Timeouts & limits
- Security
  - API key rotation
  - Hardening auth paths
- CI/CD
  - Typecheck, lint, tests
  - Migration strategy
- Deployment
  - Docker images
  - Repeatable seeding for demos

---

## Guiding principles

- API contracts are explicit and documented
- Org scoping is mandatory everywhere
- Unauthorized access must not leak existence
- Heavy data is never returned by default
- Primitives first, abstractions later
