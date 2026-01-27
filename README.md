# Testhub

Testhub is a fast, developer-focused platform to ingest, store, and explore automated test results. Built with a strong emphasis on performance, clarity, and long-term maintainability, it provides a clean REST API and modern SPA interface for managing test runs and results.

## Features

- Full CRUD operations for projects and test runs
- Batch ingestion of test results with automatic test case management
- Organization-scoped API key authentication
- Real-time test result tracking and filtering
- Tests explorer with history and status breakdowns
- Tags on test cases with tag-based filtering
- Project-scoped search across runs and tests
- Analytics dashboards with tables and charts (time series, slowest tests, most failing tests)
- Chart view toggles (tabular vs charts, bars vs stacked area)
- shadcn-styled chart components with themed tooltips/legends
- PostgreSQL-backed persistent storage with optimized queries
- Type-safe API contracts with OpenAPI specification
- Modern React SPA with shadcn/ui components
- Recharts-based data visualizations

## Stack

**Backend:**

- Node.js with Fastify
- TypeScript
- Prisma ORM
- PostgreSQL 16
- OpenAPI 3.0 contract

**Frontend:**

- React 19
- Vite
- TailwindCSS 4
- shadcn/ui
- Recharts
- React Router 7

---

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm (package manager)
- Docker and Docker Compose (for PostgreSQL)

### Setup

1. Clone the repository:

```bash
git clone <repository-url>
cd Testhub
```

2. Start the PostgreSQL database:

```bash
docker-compose up -d
```

3. Set up the backend:

```bash
cd api-ts
pnpm install
pnpm prisma:generate
pnpm prisma:migrate
pnpm seed  # Creates test organization and API key
```

4. Start the backend server:

```bash
pnpm dev  # Runs on http://localhost:8080
```

5. Set up the frontend (in a new terminal):

```bash
cd web
pnpm install
pnpm dev  # Runs on http://localhost:5173
```

6. Access the application at `http://localhost:5173`

### Testing the API

A comprehensive test script is included to verify all CRUD operations:

```bash
# Get your API key from the seed output or create one
export API_KEY="your-api-key-here"

# Run all tests
./test-api.sh
```

The test script validates:

- Health and readiness endpoints
- Project CRUD operations (create, read, update, delete)
- Run CRUD operations
- Batch result ingestion
- Error handling (401, 404, 400)

---

## API Endpoints

### Health

- `GET /health` - Server liveness check (no auth)
- `GET /ready` - Database readiness check (no auth)

### Projects

- `GET /projects` - List all projects
- `POST /projects` - Create a new project
- `GET /projects/:projectId` - Get project details
- `PATCH /projects/:projectId` - Update project
- `DELETE /projects/:projectId` - Delete project

### Runs

- `GET /projects/:projectId/runs` - List runs with filtering and pagination
- `POST /projects/:projectId/runs` - Create a new run
- `GET /projects/:projectId/runs/:runId` - Get run details
- `DELETE /projects/:projectId/runs/:runId` - Delete run

### Results

- `GET /projects/:projectId/runs/:runId/results` - List test results
- `POST /projects/:projectId/runs/:runId/results/batch` - Batch ingest test results

### Tests

- `GET /projects/:projectId/tests` - List test cases with last status
- `GET /projects/:projectId/tests/:testCaseId/history` - Test execution history

### Search

- `GET /projects/:projectId/search` - Search tests and runs within a project

### Analytics

- `GET /projects/:projectId/analytics/timeseries` - Failures over time
- `GET /projects/:projectId/analytics/slowest-tests` - Slowest tests (avg/max duration)
- `GET /projects/:projectId/analytics/most-failing-tests` - Most failing tests

All protected endpoints require the `x-api-key` header.

---

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

## Architecture

### High-level Overview

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
                PostgreSQL 16
```

### Data Model

The application uses a well-structured relational schema:

- **Organization** - Top-level tenant for access control
- **User** - Individual users with organization memberships
- **Membership** - User-to-organization relationships with roles
- **ApiKey** - Organization-scoped authentication keys
- **Project** - Test projects within an organization
- **TestCase** - Unique test definitions with stable external IDs
- **TestRun** - Execution runs with status tracking and metadata
- **TestResult** - Individual test outcomes linked to runs and test cases

All entities use cascade deletes to maintain referential integrity.

---

## Design Principles

### Backend Principles

- SQL is a first-class citizen with explicit, reviewable queries
- Pagination, filtering, and sorting are mandatory for list endpoints
- Heavy text blobs (stack traces, stdout, stderr) are available but not loaded by default
- JSONB is used only for extensible metadata fields
- Authentication and organization scoping are enforced at the route boundary
- No N+1 queries or ORM magic

### Frontend Principles

- Client-side routing with persistent app shell
- Fast in-place navigation without full page reloads
- Lists are pages, details open in drawers or dedicated routes
- Filters live in the URL for shareability
- Loading skeletons instead of blocking states
- Type-safe API client generated from OpenAPI spec
- Charts use shared UI primitives for consistent styling

### Performance Rules

- All list endpoints are paginated with cursor-based pagination
- No endpoint returns unbounded result sets
- Summary counts are precomputed and denormalized
- UI components use semantic design tokens (no hard-coded colors)
- Optimistic updates where appropriate

---

## Authentication & Authorization

Testhub uses API-key-based authentication with strict organization scoping.

### How It Works

- Every request is associated with a request context containing organization and user information
- API keys belong to an organization and optionally a specific user
- All protected routes require authentication via the `x-api-key` header
- Projects and runs are always resolved within the authenticated organization
- Cross-organization access is prevented by design
- Non-owned resources return 404 to avoid information leakage

### Development Workflow

1. Run the seed script to create a test organization and API key:

   ```bash
   cd api-ts
   pnpm seed
   ```

2. Copy the generated API key from the output

3. Use the API key in requests:

   ```bash
   curl -H "x-api-key: YOUR_API_KEY" http://localhost:8080/projects
   ```

4. In the web UI, configure the API key in Settings to persist it locally

This model keeps authorization logic explicit and auditable without introducing unnecessary complexity.

---

## Project Structure

```txt
Testhub/
├── api-ts/                 # Backend API
│   ├── src/
│   │   ├── server.ts       # Main server entry point
│   │   ├── lib/            # Auth and request helpers
│   │   ├── plugins/        # Fastify plugins (auth, cors, prisma)
│   │   ├── routes/         # API route handlers
│   │   └── schemas/        # Validation schemas
│   ├── prisma/
│   │   ├── schema.prisma   # Database schema
│   │   ├── seed.ts         # Database seeding
│   │   └── migrations/     # Schema migrations
│   └── package.json
│
├── web/                    # Frontend SPA
│   ├── src/
│   │   ├── app/            # Router configuration
│   │   ├── components/     # React components
│   │   │   ├── common/     # Shared components
│   │   │   ├── layout/     # Layout components (AppShell, TopBar, Sidebar)
│   │   │   ├── theme/      # Theme provider and toggle
│   │   │   └── ui/         # shadcn/ui primitives
│   │   ├── gen/            # Generated OpenAPI types
│   │   ├── lib/            # Utilities and hooks
│   │   ├── pages/          # Route page components
│   │   └── styles/         # Global styles
│   └── package.json
│
├── contracts/
│   └── openapi.yaml        # OpenAPI 3.0 specification
│
├── docs/
│   ├── architecture.md     # Architecture documentation
│   └── roadmap.md          # Development roadmap
│
├── docker-compose.yml      # PostgreSQL service
├── test-api.sh             # API testing script
└── README.md
```

---

## Development Roadmap

The project is currently in active development with a working MVP that includes:

- Complete CRUD operations for projects and runs
- Batch test result ingestion with automatic test case management
- Organization-scoped authentication and authorization
- Functional SPA with project listing, run management, and result viewing
- Type-safe API client generated from OpenAPI specification

### Planned Features

- Advanced test filtering and search
- Test history and trend analysis
- Flaky test detection
- Performance regression tracking
- Real-time run status updates via WebSocket
- CI/CD integration examples
- Multi-format ingestion support (JUnit, Pytest, etc.)
- Materialized views for analytics

See [docs/roadmap.md](docs/roadmap.md) for detailed planning.

---

## UI Architecture

### UI Model

Testhub is a Single Page Application (SPA) featuring:

- Client-side routing with React Router
- Persistent app shell with top bar and sidebar navigation
- Fast in-place navigation without full page reloads
- Drawers for quick details and dedicated routes for deep analysis
- URL-based filtering for shareable views

### Route Map

```txt
/                                   → Redirect to last visited project
/projects/:projectSlug              → Project overview
/projects/:projectSlug/runs         → Runs list with filtering
/projects/:projectSlug/runs/:id     → Run details (results, metadata)
/projects/:projectSlug/tests        → Tests explorer
/tests/:testId                      → Test history and trends
/projects/:projectSlug/analytics    → Analytics dashboards
/projects/:projectSlug/settings     → Project settings
/settings                           → Global settings (API key management)
```

### UI Layout

```txt
┌───────────────────────────────────────────────────────────────┐
│ TopBar: Project selector | Search | Theme toggle | User menu  │
└───────────────────────────────────────────────────────────────┘
┌───────────────┬───────────────────────────────────────────────┐
│ Sidebar       │ Main content (routed)                         │
│               │                                               │
│  Overview     │  Page header                                  │
│  Runs         │  Filters & controls                           │
│  Tests        │  Tables / Charts                              │
│  Analytics    │  Drawers for details                          │
│  Settings     │                                               │
└───────────────┴───────────────────────────────────────────────┘
```

### Component Architecture

**Layout Components:**

- `AppShell` - Main application wrapper
- `TopBar` - Navigation and global actions
- `SidebarNav` - Main navigation menu

**Common Components:**

- `PageState` - Empty states and error messages
- `AuthRequiredCallout` - Authentication prompts

**UI Primitives (shadcn/ui):**

- Badge, Button, Input, Select, Tooltip
- DropdownMenu, Sheet (drawer)
- Separator

All components follow the shadcn/ui pattern for easy customization and theming.

---

## Theming & Design Tokens

Testhub uses CSS custom properties for consistent theming across light and dark modes.

### Base Tokens

All colors use semantic naming:

- `--background`, `--foreground` - Page-level colors
- `--card`, `--card-foreground` - Card containers
- `--primary`, `--secondary`, `--accent` - Action colors
- `--muted` - Subtle backgrounds
- `--destructive` - Error and delete actions
- `--border`, `--input`, `--ring` - Form elements

### Status Tokens

Test results use dedicated status tokens:

- `--status-pass`, `--status-pass-foreground`
- `--status-fail`, `--status-fail-foreground`
- `--status-skip`, `--status-skip-foreground`
- `--status-flaky`, `--status-flaky-foreground`

### Chart Tokens

Analytics and trends use chart tokens:

- `--chart-1` through `--chart-5`

### Design Rules

- No hard-coded hex colors in components
- Use semantic token classes (`bg-card`, `text-muted-foreground`)
- All status indicators use status tokens
- All charts use chart tokens
- Dark mode works automatically via CSS variables

---

## Contributing

This project follows these principles:

1. **Explicit over implicit** - No magic, clear data flow
2. **SQL-first thinking** - Queries are reviewable and optimized
3. **Type safety** - TypeScript everywhere, generated from contracts
4. **Component reuse** - Build with existing primitives first
5. **Performance by default** - Pagination and lazy loading everywhere

### Development Commands

**Backend (api-ts):**

```bash
pnpm dev              # Start dev server with hot reload
pnpm typecheck        # Run TypeScript type checking
pnpm prisma:generate  # Generate Prisma client
pnpm prisma:migrate   # Run database migrations
pnpm prisma:studio    # Open Prisma Studio GUI
pnpm seed             # Seed test data
```

**Frontend (web):**

```bash
pnpm dev              # Start Vite dev server
pnpm build            # Build for production
pnpm typecheck        # Run TypeScript type checking
pnpm lint             # Run ESLint
pnpm gen:openapi      # Generate TypeScript types from OpenAPI spec
```

---

## License

MIT License - See [LICENSE](LICENSE) file for details.

---

## Status

Active development - MVP complete with all core CRUD operations implemented.

The application is functional for managing test projects, runs, and results with a clean API and modern web interface. See the roadmap for planned enhancements.
