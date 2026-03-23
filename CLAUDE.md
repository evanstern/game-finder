# Game Finder

## Project Overview

Game Finder is a prototype app for finding local tabletop games (board games, D&D, etc.) to join. Users search by zip code + search term, browse results, read game details, and contact the host via email/text. A classifieds board for tabletop gaming.

## Architecture

- Monorepo: pnpm + Turborepo
- Language: TypeScript everywhere
- Database: PostgreSQL
- ORM: Kysely (with kysely-codegen for type generation)
- Cache/Queue: Redis (when needed)

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

### Naming

- Files and directories: `kebab-case`
- Components and types: `PascalCase`
- Functions and variables: `camelCase`
- Constants: `SCREAMING_SNAKE_CASE`

### Environment Variables

- Never fallback required env vars — throw if missing

## Package Manager

- Use `pnpm` (not npm/yarn)

## Git

- Conventional Commits: `<type>(<scope>): <subject>`
- Do not push unless explicitly asked
- Do not amend commits unless explicitly asked

## Testing

- Write tests for new features and bug fixes
- Run tests before committing
