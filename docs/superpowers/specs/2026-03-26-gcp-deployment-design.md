# GCP Deployment Design

## Overview

Deploy Game Finder to Google Cloud Platform using Cloud Run for containerized apps, Cloud SQL for PostgreSQL, and GitHub Actions for CI/CD. Single environment (production), no Redis. Optimized for low cost and simplicity.

## Architecture

```
                    ┌─────────────┐
                    │   Internet   │
                    └──────┬───────┘
                           │
              ┌────────────┴────────────┐
              │                         │
     ┌────────▼─────────┐    ┌─────────▼─────────┐
     │  Cloud Run: web   │    │ Cloud Run: server  │
     │  (SSR, port 3000) │───▶│  (tRPC, port 4000) │
     └───────────────────┘    └───┬───────────────┘
                                  │
                           ┌──────▼──────┐
                           │  Cloud SQL   │
                           │ PostgreSQL 16│
                           └─────────────┘
```

### GCP Resources

| Resource | Service | Details |
| --- | --- | --- |
| Container images | Artifact Registry | Single Docker repo for both app images |
| API server | Cloud Run | Hono + tRPC, connects to Cloud SQL via built-in connector |
| Web server | Cloud Run | React Router 7 SSR via Hono, proxies `/trpc/*` to server |
| Database | Cloud SQL | PostgreSQL 16, `db-f1-micro`, single zone, no HA |
| Auth | Workload Identity Federation | GitHub Actions OIDC, no long-lived keys |
| IAM | Service Account | Cloud Run to Cloud SQL access, GitHub Actions to deploy |

### Estimated Monthly Cost

- Cloud SQL `db-f1-micro`: ~$7-10
- Cloud Run (scale-to-zero): ~$0-5
- Artifact Registry: ~$0-1
- **Total: ~$8-15/mo** at prototype traffic

## Cloud SQL Connection

Cloud Run provides a built-in Cloud SQL connector via the `--add-cloudsql-instances` flag. This creates a Unix socket at `/cloudsql/PROJECT:REGION:INSTANCE`. No separate Auth Proxy sidecar needed.

The `pg` Pool supports Unix sockets via the `host` parameter. The `packages/db/src/env.ts` config needs to support this:

- **`DB_HOST`**: Set to `/cloudsql/PROJECT:REGION:INSTANCE` (the Unix socket path)
- **`DB_PORT`**: Still required by `getDbConfig()` but unused for Unix socket connections. Set to `5432`. Alternatively, make `DB_PORT` optional when using socket paths.
- **`DB_NAME`**: `game_finder`
- **`DB_USER`**: Application database user
- **`DB_PASSWORD`**: Application database password

No code changes needed in `packages/db/src/client.ts`. The `pg` Pool handles Unix socket paths in the `host` field natively.

## Production Dockerfiles

Both images use multi-stage builds. The existing dev-mode Dockerfiles are renamed to `Dockerfile.dev` to preserve local `docker-compose` functionality. New production Dockerfiles are created at the repo root.

### Multi-Stage Build Pattern

1. **Base**: `node:22-slim`, enable corepack for pnpm
2. **Dependencies**: copy `pnpm-workspace.yaml`, `pnpm-lock.yaml`, and all `package.json` files, then `pnpm install --frozen-lockfile`
3. **Build**: copy full source, run `pnpm build` (Turborepo handles dependency order)
4. **Runtime**: use `pnpm deploy --filter=<app> --prod /app/pruned` to create a self-contained directory with only production deps and built output, then copy to a clean `node:22-slim` image

The `pnpm deploy` command resolves workspace dependencies and creates a standalone directory. This is the correct way to prune a pnpm monorepo for Docker. It must run after `pnpm build` so that built artifacts from workspace packages are available.

### Server Image (`Dockerfile.server`)

- Build context: repo root (monorepo needs full context)
- Runtime entry: `node dist/src/index.js` (from the pruned deploy directory)
- Env vars: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `PORT`
- Exposed port: 4000

### Web Image (`Dockerfile.web`)

- Build context: repo root
- Runtime entry: `node build/server/index.js` (from the pruned deploy directory)
- The `react-router-hono-server` Vite plugin bundles the custom Hono server (including the `/trpc/*` proxy) into `build/server/index.js`. This is a standalone Node entry point. `react-router-serve` must NOT be used as it would lose the custom Hono configuration.
- Env vars: `SERVER_URL` (Cloud Run URL of server service)
- Serves SSR handler + static assets from `build/client/`
- Exposed port: 3000

### Docker Dev Preservation

- Rename existing `apps/server/Dockerfile` to `apps/server/Dockerfile.dev`
- Rename existing `apps/web/Dockerfile` to `apps/web/Dockerfile.dev`
- Update `docker-compose.yml` to reference `Dockerfile.dev` paths
- New production Dockerfiles at repo root: `Dockerfile.server`, `Dockerfile.web`

### `.dockerignore`

```text
node_modules
.git
.github
*.md
apps/*/build
apps/*/dist
.env*
.claude
```

## Redis Removal and Session Migration

Redis is the session store for authentication. Removing it requires migrating sessions to PostgreSQL.

### Current Session System

- `apps/server/src/auth/session.ts`: `createSession`, `getSession`, `deleteSession` using Redis key-value with 7-day TTL
- `apps/server/src/trpc/context.ts`: reads session from Redis on every request
- `apps/server/src/trpc/auth.ts`: creates/deletes sessions on login/signup/logout
- `apps/server/src/redis.ts`: Redis client singleton

### Migration Plan: PostgreSQL Sessions

Create a `session` table in PostgreSQL:

```sql
CREATE TABLE session (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_session_expires_at ON session(expires_at);
```

Replace the Redis-backed `session.ts` functions with Kysely queries:

- `createSession(db, userId)`: INSERT into session table, return session ID
- `getSession(db, sessionId)`: SELECT where id matches and expires_at > now()
- `deleteSession(db, sessionId)`: DELETE from session table

Expired session cleanup: a simple `DELETE FROM session WHERE expires_at < now()` can run periodically. For a prototype, this can be a manual task or triggered on each `getSession` call.

### Files to Change for Redis Removal

1. **New migration**: `packages/db/src/migrations/008-create-session.ts` (create session table)
2. **Rewrite** `apps/server/src/auth/session.ts`: replace Redis calls with Kysely queries
3. **Update** `apps/server/src/trpc/context.ts`: remove `redis` from context, pass `db` instead
4. **Update** `apps/server/src/trpc/auth.ts`: use `ctx.db` instead of `ctx.redis`
5. **Delete** `apps/server/src/redis.ts`
6. **Delete** `packages/db/src/redis.ts`
7. **Update** `packages/db/package.json`: remove `ioredis` dep, remove `./redis` export
8. **Update** `apps/server/package.json`: remove `ioredis` dep
9. **Remove** `REDIS_HOST` / `REDIS_PORT` from env configuration
10. **Update** `packages/db/src/env.ts`: remove `getRedisConfig()`
11. **Rewrite** `apps/server/tests/session.test.ts`: test against PostgreSQL instead of Redis
12. **Update** `apps/server/tests/helpers.ts`: remove Redis client, add `session` table to cleanup sequence (before `users` due to FK), update session helpers
13. **Update** `docker-compose.yml`: remove Redis service and volume

## CI/CD Pipeline

### Trigger

Push to `main` (merged PRs).

### Authentication

Workload Identity Federation. GitHub Actions exchanges its OIDC token for a short-lived GCP credential. No service account keys stored in GitHub secrets.

### Deploy Workflow (`.github/workflows/deploy.yml`)

```text
Push to main
    |
    +-- Lint + Typecheck + Test (parallel)
    |
    +-- Build and push server image --+
    |                                 +-- (parallel)
    +-- Build and push web image -----+
    |
    +-- Run database migrations (Cloud SQL Auth Proxy in runner)
    |
    +-- Deploy server to Cloud Run
    |
    +-- Deploy web to Cloud Run (SERVER_URL = server Cloud Run URL)
```

**Image tags:** `us-docker.pkg.dev/{PROJECT_ID}/{REPO}/{APP}:{GIT_SHA}`

**Migration:** Runs before deploying new code. GitHub Actions runner starts the Cloud SQL Auth Proxy as a background process, then runs `pnpm --filter db migrate`.

**Deploy order:** Server first, then web (web depends on server being available).

**Rollback:** Cloud Run retains previous revisions. Rollback via `gcloud run services update-traffic` to shift traffic to a prior revision.

**First deploy bootstrapping:** On the very first deploy, the server Cloud Run URL is not yet known when deploying web. Deploy server first, capture its URL via `gcloud run services describe game-finder-server --format='value(status.url)'`, then deploy web with that URL as `SERVER_URL`. Subsequent deploys reuse the stable Cloud Run URLs (they do not change unless the service is recreated).

### PR Workflow (`.github/workflows/ci.yml`)

Runs on pull requests. Lint, typecheck, and test only. No build or deploy. Acts as a merge gate.

### GitHub Actions Secrets and Variables

| Name | Type | Value |
| --- | --- | --- |
| `GCP_PROJECT_ID` | Variable | GCP project ID |
| `GCP_REGION` | Variable | e.g., `us-central1` |
| `GCP_WIF_PROVIDER` | Variable | Workload Identity Federation provider resource name |
| `GCP_SERVICE_ACCOUNT` | Variable | Service account email for deployments |
| `CLOUD_SQL_INSTANCE` | Variable | `PROJECT:REGION:INSTANCE` connection name |
| `DB_NAME` | Secret | Database name |
| `DB_USER` | Secret | Database user |
| `DB_PASSWORD` | Secret | Database password |

## GCP Setup Runbook

A `docs/gcp-setup.md` file with copy-paste `gcloud` commands covering:

1. **Enable APIs**: `run.googleapis.com`, `sqladmin.googleapis.com`, `artifactregistry.googleapis.com`, `iamcredentials.googleapis.com`
2. **Create Artifact Registry repo**: single Docker repo in chosen region
3. **Create Cloud SQL instance**: PostgreSQL 16, `db-f1-micro`, single zone
4. **Create database and user**: `game_finder` database, application user with password
5. **Create service account**: for Cloud Run services to access Cloud SQL
6. **Initial Cloud Run deploys**: deploy server first, capture URL, then deploy web with `SERVER_URL`
7. **Workload Identity Federation**: pool + provider for GitHub Actions OIDC
8. **IAM role grants**: GitHub Actions gets Artifact Registry Writer, Cloud Run Developer, Cloud SQL Client
9. **Configure GitHub repo**: set Actions variables and secrets listed above

## Files to Create/Modify

### New Files

| File | Purpose |
| --- | --- |
| `Dockerfile.server` | Production multi-stage build for server (repo root) |
| `Dockerfile.web` | Production multi-stage build for web (repo root) |
| `.dockerignore` | Exclude node_modules, .git, build artifacts from build context |
| `.github/workflows/deploy.yml` | Deploy pipeline: build, migrate, deploy on push to main |
| `.github/workflows/ci.yml` | PR gate: lint, typecheck, test |
| `docs/gcp-setup.md` | One-time GCP setup runbook with gcloud commands |
| `packages/db/src/migrations/008-create-session.ts` | Session table migration |

### Modified Files

| File | Change |
| --- | --- |
| `apps/server/src/auth/session.ts` | Rewrite: Redis to Kysely/PostgreSQL |
| `apps/server/src/trpc/context.ts` | Remove `redis` from context |
| `apps/server/src/trpc/auth.ts` | Use `ctx.db` for sessions instead of `ctx.redis` |
| `apps/server/tests/session.test.ts` | Rewrite: test against PostgreSQL |
| `apps/server/tests/helpers.ts` | Remove Redis client, update session helpers |
| `apps/web/package.json` | Update `start` script to `node build/server/index.js` |
| `apps/server/package.json` | Remove `ioredis` dependency |
| `packages/db/package.json` | Remove `ioredis` dep, remove `./redis` export |
| `packages/db/src/env.ts` | Remove `getRedisConfig()` |
| `docker-compose.yml` | Remove Redis service/volume, update Dockerfile paths to `Dockerfile.dev` |
| `apps/server/Dockerfile` | Rename to `Dockerfile.dev` |
| `apps/web/Dockerfile` | Rename to `Dockerfile.dev` |

### Deleted Files

| File | Reason |
| --- | --- |
| `packages/db/src/redis.ts` | Redis client factory no longer needed |
| `apps/server/src/redis.ts` | Redis singleton no longer needed |

## Out of Scope

- Staging environment (add later via separate Cloud Run services + Cloud SQL instance)
- PR preview environments
- Custom domain / SSL (Cloud Run provides `*.run.app` HTTPS URLs)
- Redis / Memorystore
- Terraform / infrastructure as code
- Monitoring / alerting (Cloud Run provides basic metrics out of the box)
- CDN / Cloud Storage for static assets (Cloud Run serves them directly)
- Secret Manager for DB credentials (Cloud Run env vars for now, upgrade later)
