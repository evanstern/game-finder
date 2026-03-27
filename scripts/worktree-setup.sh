#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_DIR"

# --- Port assignment via directory hash ---
DIR_NAME="$(basename "$PROJECT_DIR")"
HASH=$(echo -n "$DIR_NAME" | cksum | awk '{print $1}')

DB_PORT=$(( 5432 + (HASH % 100) ))
SERVER_PORT=$(( 4000 + (HASH % 100) ))
WEB_PORT=$(( 3000 + (HASH % 100) ))

echo "==> Worktree: $DIR_NAME"
echo "==> Assigned ports — DB: $DB_PORT, Server: $SERVER_PORT, Web: $WEB_PORT"

# --- Set up .env ---
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    echo "==> Created .env from .env.example"
  else
    echo "ERROR: No .env.example found" >&2
    exit 1
  fi
fi

# Update ports in .env (works whether values already exist or not)
update_env() {
  local key="$1" value="$2"
  if grep -q "^${key}=" .env; then
    sed -i '' "s/^${key}=.*/${key}=${value}/" .env
  else
    echo "${key}=${value}" >> .env
  fi
}

update_env "DB_PORT" "$DB_PORT"
update_env "PORT" "$SERVER_PORT"
update_env "WEB_PORT" "$WEB_PORT"
update_env "DB_HOST" "localhost"
update_env "SERVER_URL" "http://localhost:${SERVER_PORT}"

echo "==> Updated .env with assigned ports"

# --- Docker Compose project name (isolates containers per worktree) ---
export COMPOSE_PROJECT_NAME="gf-${DIR_NAME}"

echo "==> Starting Docker containers (project: $COMPOSE_PROJECT_NAME)..."
docker compose up -d --build

echo "==> Waiting for postgres to be healthy..."
RETRIES=30
until docker compose exec postgres pg_isready -U postgres > /dev/null 2>&1; do
  RETRIES=$((RETRIES - 1))
  if [ "$RETRIES" -le 0 ]; then
    echo "ERROR: Postgres did not become healthy in time" >&2
    exit 1
  fi
  sleep 1
done
echo "==> Postgres is ready"

# --- Run migrations and seed ---
echo "==> Running migrations..."
docker compose exec server pnpm --filter db migrate

echo "==> Seeding database..."
docker compose exec server pnpm --filter db seed

echo ""
echo "========================================"
echo "  Worktree ready!"
echo "  Web:    http://localhost:$WEB_PORT"
echo "  Server: http://localhost:$SERVER_PORT"
echo "  DB:     localhost:$DB_PORT"
echo "  Docker: $COMPOSE_PROJECT_NAME"
echo "========================================"
