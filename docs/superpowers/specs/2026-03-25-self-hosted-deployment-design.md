# Self-Hosted Deployment Design

## Overview

Deploy Game Finder to vm-103.local.infinity-node.win as a Docker Compose stack running in dev mode. Traefik handles routing via `game-finder.local.infinity-node.win`. Manual deploy workflow — no CI/CD.

## Server Environment

- **Host:** vm-103.local.infinity-node.win (Ubuntu, 8 cores, 32GB RAM)
- **Docker:** 29.1.5, Compose v5.0.1
- **Reverse proxy:** Traefik v3.0 on `traefik-network`, file-based dynamic config at `/home/evan/.config/traefik/dynamic.yml` (watch mode enabled)
- **Container management:** Portainer CE
- **Access:** SSH as `evan` user from local machine

## Architecture

### Containers

| Container | Image | Internal Port | Purpose |
|---|---|---|---|
| `game-finder-postgres` | `postgres:16` | 5432 | Dedicated Postgres instance |
| `game-finder-redis` | `redis:7` | 6379 | Cache/queue |
| `game-finder-server` | Built from `apps/server/Dockerfile` | 4000 | Hono + tRPC API |
| `game-finder-web` | Built from `apps/web/Dockerfile` | 3000 | React Router SSR (dev mode) |

### Networking

- All containers join a `game-finder` bridge network for inter-service DNS resolution.
- `game-finder-web` and `game-finder-server` additionally join `traefik-network` (external) so Traefik can route to them.
- No host port mappings — all external access goes through Traefik on ports 80/443.

### Traefik Routing

| Subdomain | Target |
|---|---|
| `game-finder.local.infinity-node.win` | `game-finder-web:3000` |
| `game-finder-api.local.infinity-node.win` | `game-finder-server:4000` |

Routing is configured via file-based dynamic config (`/home/evan/.config/traefik/dynamic.yml`), matching the existing pattern for all other services on vm-103. Traefik watches this file and auto-reloads on change.

### Data Persistence

- **Postgres:** Named volume `game-finder-pgdata` survives `docker compose down`.
- **Redis:** Named volume `game-finder-redisdata` for persistence.
- No backup strategy for now (demo/prototype use).

## File Layout on vm-103

```
/home/evan/stacks/game-finder/
  .env                    # Environment variables (DB creds, app config)
  docker-compose.yml      # Deployment compose file (not the repo's dev compose)
  <cloned repo files>
```

The repo is cloned directly into this directory. The deployment compose file replaces the repo's dev-oriented `docker-compose.yml`.

## Docker Compose Changes (vs. existing dev compose)

The deployment compose file differs from the repo's local dev compose:

1. **Container names** prefixed with `game-finder-` to avoid conflicts with other stacks on vm-103.
2. **No host port mappings** — Traefik handles external access.
3. **External `traefik-network`** added for web and server containers.
4. **Volume mounts removed** — source is copied into the image at build time (no live-reload on server). The Dockerfiles `COPY . .` the source and run `pnpm dev`.
5. **Container names are explicit** so Traefik's file-based config can reference them by DNS name.

## Dockerfile Changes

The existing Dockerfiles are almost ready. They install deps, copy source, and run `pnpm dev`. No changes needed for the dev-mode approach.

## Environment Variables

The `.env` file on the server provides:

```
# Database
DB_HOST=game-finder-postgres
DB_PORT=5432
DB_NAME=game_finder
DB_USER=postgres
DB_PASSWORD=<generate-a-password>

# Redis
REDIS_HOST=game-finder-redis
REDIS_PORT=6379

# Server
PORT=4000

# Web
SERVER_URL=http://game-finder-server:4000
```

## Deploy Process

### Initial Setup (one-time)

1. SSH into vm-103 as `evan`.
2. `mkdir -p /home/evan/stacks/game-finder`
3. Clone the repo into that directory.
4. Create `.env` with the variables above.
5. Create or update the deployment `docker-compose.yml`.
6. Add game-finder routes to Traefik's `dynamic.yml`.
7. `docker compose up -d --build`
8. Run migrations: `docker exec game-finder-server pnpm --filter db migrate`
9. Seed data: `docker exec game-finder-server pnpm --filter db seed`

### Updating

```bash
cd /home/evan/stacks/game-finder
git pull
docker compose up -d --build
# If there are new migrations:
docker exec game-finder-server pnpm --filter db migrate
```

## Traefik Dynamic Config Addition

Add to `/home/evan/.config/traefik/dynamic.yml`:

```yaml
# Under http.routers:
game-finder:
  rule: "Host(`game-finder.local.infinity-node.win`)"
  entryPoints:
    - web
  service: game-finder

game-finder-api:
  rule: "Host(`game-finder-api.local.infinity-node.win`)"
  entryPoints:
    - web
  service: game-finder-api

# Under http.services:
game-finder:
  loadBalancer:
    servers:
      - url: "http://game-finder-web:3000"

game-finder-api:
  loadBalancer:
    servers:
      - url: "http://game-finder-server:4000"
```

## Error Handling

- Postgres healthcheck gates server startup (`service_healthy` condition).
- Redis uses `service_started` condition.
- `docker compose logs -f` for diagnostics.
- `docker compose down && docker compose up -d --build` for full rebuild.
- Postgres data persists across rebuilds (named volume). Only lost if explicitly removed with `docker volume rm`.

## Future Upgrade Path

When production builds are desired:
1. Update Dockerfiles to multi-stage builds (`pnpm build` then `pnpm start`).
2. Optionally add GitHub Actions for automated build + deploy via SSH.
3. Add `pg_dump` cron for backups.

## Decisions

- **Dev mode over production builds:** Server has ample resources (32GB RAM, 8 cores). Dev mode avoids build complexity and is explicitly acceptable for prototype/demo use.
- **Dedicated Postgres over shared:** Isolation from paperless DB. Clean separation of data.
- **File-based Traefik config over Docker labels:** Matches existing vm-103 pattern. All other services use file-based config.
- **No CI/CD:** Manual deploy via `git pull && docker compose up -d --build`. Appropriate for single-developer prototype.
- **No backups:** Demo use only. Trivial to add later.
