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
|----------|---------|---------|
| Container images | Artifact Registry | Single Docker repo for both app images |
| API server | Cloud Run | Hono + tRPC, connects to Cloud SQL via Auth Proxy sidecar |
| Web server | Cloud Run | React Router 7 SSR via Hono, proxies /trpc/* to server |
| Database | Cloud SQL | PostgreSQL 16, `db-f1-micro`, single zone, no HA |
| Auth | Workload Identity Federation | GitHub Actions OIDC, no long-lived keys |
| IAM | Service Account | Cloud Run → Cloud SQL access, GitHub Actions → deploy |

### Estimated Monthly Cost

- Cloud SQL `db-f1-micro`: ~$7-10
- Cloud Run (scale-to-zero): ~$0-5
- Artifact Registry: ~$0-1
- **Total: ~$8-15/mo** at prototype traffic

## Production Dockerfiles

Both images use multi-stage builds:

1. **Base** — `node:22-slim`, install pnpm via corepack
2. **Dependencies** — copy workspace manifests, `pnpm install --frozen-lockfile`
3. **Build** — copy source, `pnpm build` (Turborepo handles dependency order)
4. **Runtime** — copy only built output + production node_modules, minimal image

### Server Image (`apps/server/Dockerfile`)

- Entry point: `node apps/server/dist/src/index.js`
- Env vars: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `PORT`
- Cloud SQL Auth Proxy sidecar handles database connection (Unix socket)
- Exposed port: 4000

### Web Image (`apps/web/Dockerfile`)

- Entry point: `node apps/web/build/server/index.js`
- Env vars: `SERVER_URL` (Cloud Run URL of server service)
- Serves SSR handler + static assets from `build/client/`
- Exposed port: 3000

### Monorepo Build Context

Both apps share packages (db, contracts, shared, ui). The full monorepo is the Docker build context. Turborepo's `--filter` ensures only the necessary packages are built. A root `.dockerignore` excludes `node_modules`, `.git`, and build artifacts.

## CI/CD Pipeline

### Trigger

Push to `main` (merged PRs).

### Authentication

Workload Identity Federation — GitHub Actions exchanges its OIDC token for a short-lived GCP credential. No service account keys stored in GitHub secrets.

### Deploy Workflow (`.github/workflows/deploy.yml`)

```
Push to main
    │
    ├── Lint + Typecheck + Test (parallel)
    │
    ├── Build & push server image ──┐
    │                               ├── (parallel)
    ├── Build & push web image ─────┘
    │
    ├── Run database migrations (Cloud SQL Auth Proxy in runner)
    │
    ├── Deploy server to Cloud Run
    │
    └── Deploy web to Cloud Run (SERVER_URL = server's Cloud Run URL)
```

**Image tags:** `us-docker.pkg.dev/{PROJECT_ID}/{REPO}/{APP}:{GIT_SHA}`

**Migration:** Runs before deploying new code. GitHub Actions runner connects to Cloud SQL via Auth Proxy and runs `pnpm --filter db migrate`.

**Deploy order:** Server first, then web (web depends on server being available).

**Rollback:** Cloud Run retains previous revisions. Rollback via `gcloud run services update-traffic` to shift traffic to a prior revision.

### PR Workflow (`.github/workflows/ci.yml`)

Runs on pull requests — lint, typecheck, and test only. No build or deploy. Acts as a merge gate.

## Redis Removal

Redis is removed to reduce cost and operational complexity. Changes required:

1. **Remove** `packages/db/src/redis.ts` (Redis client factory)
2. **Remove** `ioredis` dependency from `packages/db/package.json`
3. **Remove** Redis exports from `packages/db/package.json` (`./redis` export)
4. **Remove** Redis imports/usage from the server app
5. **Remove** `REDIS_HOST` / `REDIS_PORT` env vars from all configuration
6. **Replace** any Redis-backed functionality:
   - Caching → remove cache layer, query DB directly (acceptable at prototype traffic)
   - Session storage → stateless cookies/JWT (if applicable)
   - Rate limiting → drop or use in-memory (acceptable for single instances)

## GCP Setup Runbook

A `docs/gcp-setup.md` file with copy-paste `gcloud` commands covering:

1. **Enable APIs** — `run.googleapis.com`, `sqladmin.googleapis.com`, `artifactregistry.googleapis.com`, `iamcredentials.googleapis.com`
2. **Create Artifact Registry repo** — single Docker repo in chosen region
3. **Create Cloud SQL instance** — PostgreSQL 16, `db-f1-micro`, single zone
4. **Create database + user** — `game_finder` database, application user with password
5. **Create service account** — for Cloud Run services to access Cloud SQL
6. **Initial Cloud Run deploys** — both services with env vars and Cloud SQL connection
7. **Workload Identity Federation** — pool + provider for GitHub Actions OIDC
8. **IAM role grants** — GitHub Actions gets Artifact Registry Writer, Cloud Run Developer, Cloud SQL Client

## Files to Create/Modify

### New Files

| File | Purpose |
|------|---------|
| `apps/server/Dockerfile` | Production multi-stage build (replace existing dev Dockerfile) |
| `apps/web/Dockerfile` | Production multi-stage build (replace existing dev Dockerfile) |
| `.dockerignore` | Exclude node_modules, .git, build artifacts from build context |
| `.github/workflows/deploy.yml` | Deploy pipeline — build, migrate, deploy on push to main |
| `.github/workflows/ci.yml` | PR gate — lint, typecheck, test |
| `docs/gcp-setup.md` | One-time GCP setup runbook with gcloud commands |

### Modified Files

| File | Change |
|------|--------|
| `packages/db/package.json` | Remove `ioredis` dep, remove `./redis` export |
| `packages/db/src/redis.ts` | Delete |
| `apps/server/src/**` | Remove Redis imports/usage |
| `docker-compose.yml` | Remove Redis service (optional — local dev still works without it) |

## Out of Scope

- Staging environment (add later via separate Cloud Run services + Cloud SQL instance)
- PR preview environments
- Custom domain / SSL (Cloud Run provides `*.run.app` HTTPS URLs)
- Redis / Memorystore
- Terraform / infrastructure as code
- Monitoring / alerting (Cloud Run provides basic metrics out of the box)
- CDN / Cloud Storage for static assets (Cloud Run serves them directly)
