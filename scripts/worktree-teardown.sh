#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_DIR"

DIR_NAME="$(basename "$PROJECT_DIR")"
export COMPOSE_PROJECT_NAME="gf-${DIR_NAME}"

echo "==> Tearing down Docker containers (project: $COMPOSE_PROJECT_NAME)..."
docker compose down -v

if [ "${1:-}" = "--clean" ]; then
  if [ -f .env ]; then
    rm .env
    echo "==> Removed .env"
  fi
fi

echo "==> Teardown complete"
