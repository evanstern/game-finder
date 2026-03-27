# Game Finder

## Project Overview

Game Finder is a prototype app for finding local tabletop games (board games, D&D, etc.) to join. Users search by zip code + search term, browse results, read game details, and contact the host via email/text. A classifieds board for tabletop gaming.

## Architecture

- Monorepo: pnpm + Turborepo
- Language: TypeScript everywhere
- Database: PostgreSQL
- ORM: Kysely (with kysely-codegen for type generation)
- Cache/Queue: Redis (when needed)
- Linter/Formatter: Biome
- Test Runner: Vitest
- Node: >=22 required

### Apps

- `apps/web` — React Router 7 (SSR via Hono), Tailwind, Shadcn
- `apps/server` — Hono + tRPC API server

### Packages

- `packages/db` — Kysely connection, migrations, generated types
- `packages/shared` — Shared utilities and helpers
- `packages/contracts` — Shared TypeScript types and Zod schemas
- `packages/ui` — Shadcn component library

## Conventions

### Code Style

- No `any` — use `unknown` for dynamic content
- Prefer functional patterns over class-based
- Keep functions small and focused
- No unnecessary comments — code is self-documenting
- Edit existing files over creating new ones
- Prototype mindset — favor simplicity and speed over perfection

### UI Components

- Always use components from `packages/ui` — never use raw HTML elements (`<button>`, `<input>`, `<select>`, `<textarea>`) when a UI component exists
- Available components: Button, Input, Label, Card, Badge, Checkbox, Select, RadioGroup, Pagination, Table, Textarea
- If a needed variant or style doesn't exist, add it to the UI package component — don't inline custom styles on raw elements

### Naming

- Files and directories: `kebab-case`
- Components and types: `PascalCase`
- Functions and variables: `camelCase`
- Constants: `SCREAMING_SNAKE_CASE`

### Environment Variables

- Never fallback required env vars — throw if missing

## Commands

```bash
pnpm dev              # Start all apps in dev mode
pnpm build            # Build all packages
pnpm test             # Run all tests (Vitest)
pnpm lint             # Lint all packages (Biome)
pnpm format           # Format all packages (Biome)
pnpm typecheck        # Type-check all packages
```

### Database

```bash
pnpm --filter db migrate       # Run migrations
pnpm --filter db seed           # Seed database
pnpm --filter db seed:zip-codes # Seed zip code data
```

### Worktree Setup

```bash
./scripts/worktree-setup.sh    # Set up Docker + DB for this worktree (auto-assigns ports)
./scripts/worktree-teardown.sh # Tear down containers and volumes
./scripts/worktree-teardown.sh --clean # Also removes .env
```

Each worktree gets isolated Docker containers with unique ports derived from the directory name. The setup script handles `.env` creation, port assignment, `docker compose up`, migrations, and seeding in one command.

## Package Manager

- Use `pnpm` (not npm/yarn)

## Git

- Conventional Commits: `<type>(<scope>): <subject>`
- Do not push unless explicitly asked
- Do not amend commits unless explicitly asked

## Testing

- Write tests for new features and bug fixes
- Run tests before committing
