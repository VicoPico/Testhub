# Testhub — Agent Quick Context (Read First)

Purpose

- Testhub is a test results hub: ingest runs/results, browse runs/tests, view analytics.
- Backend: Fastify + Prisma + PostgreSQL (api-ts). Frontend: React (Vite) + shadcn/ui (web).

How to run (high-level)

- API: api-ts (Fastify)
- Web: web (Vite)
- See README for exact commands/env.

Key areas

- Backend routes: api-ts/src/routes
- Prisma schema/migrations: api-ts/prisma
- Frontend pages: web/src/pages
- Frontend API client: web/src/lib/api.ts

Recent changes (last working session)

- Project rename UX with slug aliases:
  - Backend added ProjectSlugAlias model and logic to resolve by id/slug/alias.
  - PATCH /projects supports slug changes + alias preservation.
- Edited column in Projects list:
  - Projects list now shows Created + Edited using updatedAt.
  - Projects list refreshes on testhub.projectsChanged event.
- Scrollable lists:
  - Added shared ScrollableList component for consistent max-height scrolling.
  - Applied to Tests list and Run results list.
  - Scroll height increased to match Analytics chart height (h-64).
- Header labels use project name (Analytics/Runs/Run details) when available.
- Auth mode UI (session vs API key):
  - New auth mode storage key: testhub.authMode (see web/src/lib/auth.ts).
  - Settings page exposes mode selection + API key management.
  - AuthGate skips login redirects in API key mode.
  - apiFetch only sends x-api-key when API key mode is active.

Potential gotchas

- Prisma ESM: prefer app.prisma injected via plugin; avoid runtime Prisma imports.
- Project slug changes: ensure aliases keep old URLs working.
- Some UI states rely on CustomEvent: testhub.projectsChanged, testhub.projectNotFound, testhub.authChanged.
- If API key is cleared, auth mode falls back to session automatically.
- Only send x-api-key in API key mode; session mode relies on cookies.

If you touch these, re-check

- api-ts/src/routes/projects.ts
- api-ts/src/lib/requireProjectForOrg.ts
- web/src/pages/ProjectsPage.tsx
- web/src/pages/ProjectOverviewPage.tsx
- web/src/pages/TestsPage.tsx
- web/src/pages/RunDetailsPage.tsx
- web/src/components/common/ScrollableList.tsx
