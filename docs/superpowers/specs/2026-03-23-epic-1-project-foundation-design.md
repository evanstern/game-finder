# Epic 1: Project Foundation — Design Spec

## Overview

Monorepo scaffolding, Docker Compose, and all infrastructure needed before feature work begins. After this epic, `docker compose up` starts the full stack with hot reload, and the web app communicates with the server via tRPC.

## Decisions

- **Node version:** 22 LTS
- **Hot reload:** Volume mounts into containers (source code synced from host)
- **tRPC integration:** tRPC + React Query for type-safe data fetching with caching
- **Dockerfiles:** Dev-only for now (production stages added later)
- **UI package:** Shared `packages/ui` with Shadcn components exported to the web app
- **Testing:** Vitest across all packages, Turborepo `test` pipeline

## Monorepo Structure

```
game-finder/
├── apps/
│   ├── web/              # React Router 7 + Hono SSR
│   └── server/           # Hono + tRPC API
├── packages/
│   ├── db/               # Kysely connection + migration tooling
│   ├── contracts/        # Zod schemas + shared types
│   ├── shared/           # Utility functions
│   └── ui/               # Shadcn components + Tailwind config
├── docker-compose.yml
├── turbo.json
├── pnpm-workspace.yaml
├── tsconfig.json         # Base config
├── .env.example
└── .gitignore
```

### Workspace configuration

- `pnpm-workspace.yaml` defines `apps/*` and `packages/*`
- `turbo.json` configures `build`, `dev`, `lint`, `format`, `typecheck`, and `test` pipelines
- Base `tsconfig.json` at root; each package/app extends it
- Internal packages use workspace protocol (`"@game-finder/db": "workspace:*"`)

## Docker Compose

### Services

- **postgres** — PostgreSQL 16. Named volume for data persistence. Health check so dependents wait for readiness. Exposed on port 5432.
- **redis** — Redis 7. Named volume for persistence. Exposed on port 6379. Placeholder for future use (caching, queues).
- **server** — `apps/server`. Node 22 base image. Volume-mounts the entire workspace. Runs dev script with file watching/hot reload. Depends on postgres health check. Exposed on port 4000.
- **web** — `apps/web`. Node 22 base image. Volume-mounts the entire workspace. Runs dev script with Vite HMR. Exposed on port 3000.

### Volume strategy

- Source code: bind mounts from host (enables hot reload)
- `node_modules`: anonymous volumes (installed inside container, not synced from host). Avoids platform-specific binary issues between host and container.
- Postgres/Redis data: named volumes for persistence across restarts.

### Environment

- `.env` file loaded via `env_file` in compose
- `.env.example` documents all required variables
- `SERVER_URL` env var (e.g., `http://server:4000`) set in the web service's environment so it can discover the tRPC server

## Package Details

### packages/db

- Kysely instance configured from env vars: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- Throw if any required env var is missing (per CLAUDE.md convention)
- Migration tooling set up using Kysely's built-in migrator — no migrations yet, just the infrastructure and an empty migrations directory
- Exports the Kysely instance and a `Database` type (empty for now, populated by kysely-codegen once tables exist)
- Vitest configured

### packages/contracts

- Package scaffolding only — barrel file, ready for Zod schemas in Epic 2
- Vitest configured

### packages/shared

- Package scaffolding only — barrel file, ready for utility functions
- Vitest configured

### packages/ui

- Tailwind CSS config (shared across the monorepo)
- Shadcn CLI configured to generate components into this package
- A base Button component to verify the setup works
- Exports components for the web app to consume

### apps/server

- Hono app with a `/health` endpoint (returns JSON with status and DB connectivity)
- tRPC router scaffolding with a single `health.check` procedure
- Listens on port from `PORT` env var
- Vitest configured with a test for the health check endpoint

### apps/web

- React Router 7 with Hono SSR adapter
- Tailwind configured, consuming styles from `@game-finder/ui`
- tRPC client configured via `SERVER_URL` env var + React Query provider wired up
- Single route (`/`) that renders a hello world page and calls the server's tRPC `health.check` to verify end-to-end connectivity
- Dev server with Vite HMR

## Dev Tooling

- **Biome** for linting and formatting (single tool, root config shared across all packages)
- **Vitest** as the test runner across all packages
- Turborepo `test` pipeline: `pnpm test` runs tests across all packages
- `.env.example` documenting all required env vars
- `.gitignore` covering node_modules, dist, .env, .superpowers

## Exit Criteria

1. `docker compose up` starts Postgres, Redis, server, and web containers
2. Web app renders at `http://localhost:3000`
3. Server responds to health check at `http://localhost:4000/health`
4. Web app successfully calls the server's tRPC `health.check` and displays the result
5. Web app imports and renders a component from `@game-finder/ui`
6. DB connection works (server can connect to Postgres)
7. `pnpm build`, `pnpm lint`, `pnpm format`, `pnpm typecheck`, and `pnpm test` pass across all packages
8. Server health check endpoint has a passing test
