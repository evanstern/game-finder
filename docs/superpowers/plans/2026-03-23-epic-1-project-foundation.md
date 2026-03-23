# Epic 1: Project Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up the full monorepo infrastructure so `docker compose up` starts Postgres, Redis, server, and web with hot reload, and the web app calls the server's tRPC health check.

**Architecture:** pnpm + Turborepo monorepo with 4 packages (db, contracts, shared, ui) and 2 apps (server, web). Everything runs in Docker containers with volume mounts for hot reload. Server uses Hono + tRPC, web uses React Router 7 with Hono SSR adapter.

**Tech Stack:** Node 22, TypeScript, pnpm, Turborepo, Biome, Vitest, Hono, tRPC v11, React Router 7, Tailwind CSS, Shadcn, Kysely, PostgreSQL 16, Redis 7, Docker Compose

**Spec:** `docs/superpowers/specs/2026-03-23-epic-1-project-foundation-design.md`

---

## File Structure

```
game-finder/
├── .gitignore                          # Updated with node_modules, dist, .env, .superpowers
├── .env.example                        # All required env vars documented
├── .env                                # Local env (gitignored)
├── biome.json                          # Biome linting + formatting config
├── docker-compose.yml                  # Full stack: postgres, redis, server, web
├── package.json                        # Root workspace package
├── pnpm-workspace.yaml                 # Workspace definition
├── tsconfig.json                       # Base TypeScript config
├── turbo.json                          # Turborepo pipeline config
│
├── apps/
│   ├── server/
│   │   ├── Dockerfile                  # Dev Dockerfile
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vitest.config.ts
│   │   ├── src/
│   │   │   ├── app.ts                  # Hono app setup (no side effects)
│   │   │   ├── index.ts                # Entry: imports app, starts server
│   │   │   ├── trpc/
│   │   │   │   ├── init.ts             # initTRPC, exports router/procedure
│   │   │   │   ├── context.ts          # tRPC context factory
│   │   │   │   └── router.ts           # appRouter with health.check
│   │   │   └── routes/
│   │   │       └── health.ts           # /health HTTP route
│   │   └── tests/
│   │       └── health.test.ts          # Health check endpoint test
│   │
│   └── web/
│       ├── Dockerfile                  # Dev Dockerfile
│       ├── package.json
│       ├── tsconfig.json
│       ├── react-router.config.ts      # React Router config
│       ├── vite.config.ts              # Vite + React Router + Hono server plugin
│       ├── app/
│       │   ├── root.tsx                # Root layout with providers
│       │   ├── routes.ts               # Route definitions
│       │   ├── routes/
│       │   │   └── home.tsx            # Home route (/)
│       │   └── trpc/
│       │       ├── query-client.ts     # React Query client factory
│       │       └── provider.tsx        # tRPC + React Query provider
│       └── public/
│
├── packages/
│   ├── contracts/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       └── index.ts                # Empty barrel file
│   │
│   ├── db/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts                # Barrel: exports db, Database type
│   │   │   ├── types.ts                # Database type definition
│   │   │   ├── client.ts               # Kysely instance creation
│   │   │   ├── env.ts                  # Env var validation (throws if missing)
│   │   │   ├── migrate.ts              # Migration runner CLI script
│   │   │   └── migrations/             # Empty migrations directory
│   │   │       └── .gitkeep
│   │   └── vitest.config.ts
│   │
│   ├── shared/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       └── index.ts                # Empty barrel file
│   │
│   └── ui/
│       ├── package.json
│       ├── tsconfig.json
│       ├── components.json             # Shadcn CLI config
│       └── src/
│           ├── components/
│           │   └── button.tsx          # Shadcn Button component
│           ├── lib/
│           │   └── utils.ts            # cn() utility
│           └── styles/
│               └── globals.css         # Tailwind + Shadcn CSS vars
```

---

## Task 1: Root Monorepo Scaffolding

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `tsconfig.json`
- Modify: `.gitignore`
- Create: `.env.example`
- Create: `.env`
- Create: `biome.json`

- [ ] **Step 1: Create root `package.json`**

```json
{
  "name": "game-finder",
  "private": true,
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint",
    "format": "turbo run format",
    "format:check": "turbo run format:check",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.0",
    "turbo": "^2.3.0",
    "typescript": "^5.7.0"
  },
  "packageManager": "pnpm@9.15.0",
  "engines": {
    "node": ">=22"
  }
}
```

- [ ] **Step 2: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 3: Create `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "format": {
      "cache": false
    },
    "format:check": {},
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"]
    }
  }
}
```

- [ ] **Step 4: Create base `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

- [ ] **Step 5: Update `.gitignore`**

```
node_modules/
dist/
.env
.superpowers/
.turbo/
*.tsbuildinfo
```

- [ ] **Step 6: Create `.env.example`**

```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=game_finder
DB_USER=postgres
DB_PASSWORD=postgres

# Server
PORT=4000

# Web
SERVER_URL=http://server:4000
```

- [ ] **Step 7: Create `.env`** (copy from `.env.example` with same values for local dev)

- [ ] **Step 8: Create `biome.json`**

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "suspicious": {
        "noExplicitAny": "error"
      }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "semicolons": "asNeeded"
    }
  }
}
```

- [ ] **Step 9: Install dependencies**

Run: `pnpm install`
Expected: lockfile created, no errors

- [ ] **Step 10: Commit**

```bash
git add package.json pnpm-workspace.yaml turbo.json tsconfig.json .gitignore .env.example biome.json pnpm-lock.yaml
git commit -m "chore: initialize monorepo with pnpm, Turborepo, and Biome"
```

---

## Task 2: packages/contracts and packages/shared Scaffolding

**Files:**
- Create: `packages/contracts/package.json`
- Create: `packages/contracts/tsconfig.json`
- Create: `packages/contracts/src/index.ts`
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`

- [ ] **Step 1: Create `packages/contracts/package.json`**

```json
{
  "name": "@game-finder/contracts",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "lint": "biome check .",
    "format": "biome format --write .",
    "format:check": "biome format .",
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] **Step 2: Create `packages/contracts/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `packages/contracts/src/index.ts`**

```typescript
// @game-finder/contracts — shared types and Zod schemas
// Populated in Epic 2
export {}
```

- [ ] **Step 4: Create `packages/shared/package.json`**

```json
{
  "name": "@game-finder/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "lint": "biome check .",
    "format": "biome format --write .",
    "format:check": "biome format .",
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] **Step 5: Create `packages/shared/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 6: Create `packages/shared/src/index.ts`**

```typescript
// @game-finder/shared — utility functions
// Populated as needed
export {}
```

- [ ] **Step 7: Install and verify**

Run: `pnpm install && pnpm typecheck --filter @game-finder/contracts --filter @game-finder/shared`
Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add packages/contracts packages/shared pnpm-lock.yaml
git commit -m "chore(packages): scaffold contracts and shared packages"
```

---

## Task 3: packages/db — Kysely Setup

**Files:**
- Create: `packages/db/package.json`
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/src/env.ts`
- Create: `packages/db/src/client.ts`
- Create: `packages/db/src/migrate.ts`
- Create: `packages/db/src/index.ts`
- Create: `packages/db/src/migrations/.gitkeep`

- [ ] **Step 1: Create `packages/db/package.json`**

```json
{
  "name": "@game-finder/db",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "lint": "biome check .",
    "format": "biome format --write .",
    "format:check": "biome format .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "migrate": "tsx src/migrate.ts"
  },
  "dependencies": {
    "kysely": "^0.27.0",
    "pg": "^8.13.0"
  },
  "devDependencies": {
    "@types/pg": "^8.11.0",
    "tsx": "^4.19.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create `packages/db/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `packages/db/src/env.ts`**

This validates and exports required DB env vars, throwing if any are missing (per CLAUDE.md convention).

```typescript
function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export function getDbConfig() {
  return {
    host: requireEnv('DB_HOST'),
    port: Number.parseInt(requireEnv('DB_PORT'), 10),
    database: requireEnv('DB_NAME'),
    user: requireEnv('DB_USER'),
    password: requireEnv('DB_PASSWORD'),
  }
}
```

- [ ] **Step 4: Create `packages/db/src/types.ts`**

```typescript
export type Database = Record<string, never>
```

- [ ] **Step 5: Create `packages/db/src/client.ts`**

```typescript
import { Kysely, PostgresDialect } from 'kysely'
import pg from 'pg'
import type { Database } from './types.js'
import { getDbConfig } from './env.js'

const { Pool } = pg

export function createDb(): Kysely<Database> {
  const config = getDbConfig()
  return new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: new Pool({
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        password: config.password,
        max: 10,
      }),
    }),
  })
}
```

- [ ] **Step 6: Create `packages/db/src/migrate.ts`**

```typescript
import path from 'node:path'
import { promises as fs } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { FileMigrationProvider, Migrator } from 'kysely'
import { createDb } from './client.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function migrateToLatest() {
  const db = createDb()

  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: path.join(__dirname, 'migrations'),
    }),
  })

  const { error, results } = await migrator.migrateToLatest()

  for (const result of results ?? []) {
    if (result.status === 'Success') {
      console.log(`Migration "${result.migrationName}" executed successfully`)
    } else if (result.status === 'Error') {
      console.error(`Failed to execute migration "${result.migrationName}"`)
    }
  }

  if (error) {
    console.error('Migration failed')
    console.error(error)
    process.exit(1)
  }

  await db.destroy()
}

migrateToLatest()
```

- [ ] **Step 7: Create `packages/db/src/index.ts`**

```typescript
export type { Database } from './types.js'
export { createDb } from './client.js'
export { getDbConfig } from './env.js'
```

- [ ] **Step 8: Create empty migrations directory**

Create: `packages/db/src/migrations/.gitkeep` (empty file)

- [ ] **Step 9: Install and verify**

Run: `pnpm install && pnpm typecheck --filter @game-finder/db`
Expected: no errors

- [ ] **Step 10: Commit**

```bash
git add packages/db pnpm-lock.yaml
git commit -m "feat(db): set up Kysely with PostgreSQL dialect and migration tooling"
```

---

## Task 4: packages/ui — Shadcn Setup

**Files:**
- Create: `packages/ui/package.json`
- Create: `packages/ui/tsconfig.json`
- Create: `packages/ui/components.json`
- Create: `packages/ui/src/lib/utils.ts`
- Create: `packages/ui/src/styles/globals.css`
- Create: `packages/ui/src/components/button.tsx` (via shadcn CLI)

- [ ] **Step 1: Create `packages/ui/package.json`**

```json
{
  "name": "@game-finder/ui",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    "./components/*": "./src/components/*.tsx",
    "./lib/*": "./src/lib/*.ts",
    "./styles/*": "./src/styles/*"
  },
  "scripts": {
    "lint": "biome check .",
    "format": "biome format --write .",
    "format:check": "biome format .",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "lucide-react": "^0.460.0",
    "tailwind-merge": "^2.6.0"
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "tailwindcss": "^4.0.0"
  }
}
```

- [ ] **Step 2: Create `packages/ui/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `packages/ui/src/lib/utils.ts`**

```typescript
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 4: Create `packages/ui/src/styles/globals.css`**

```css
@import "tailwindcss";

@layer base {
  :root {
    --background: oklch(1 0 0);
    --foreground: oklch(0.145 0 0);
    --card: oklch(1 0 0);
    --card-foreground: oklch(0.145 0 0);
    --popover: oklch(1 0 0);
    --popover-foreground: oklch(0.145 0 0);
    --primary: oklch(0.205 0 0);
    --primary-foreground: oklch(0.985 0 0);
    --secondary: oklch(0.97 0 0);
    --secondary-foreground: oklch(0.205 0 0);
    --muted: oklch(0.97 0 0);
    --muted-foreground: oklch(0.556 0 0);
    --accent: oklch(0.97 0 0);
    --accent-foreground: oklch(0.205 0 0);
    --destructive: oklch(0.577 0.245 27.325);
    --destructive-foreground: oklch(0.577 0.245 27.325);
    --border: oklch(0.922 0 0);
    --input: oklch(0.922 0 0);
    --ring: oklch(0.708 0 0);
    --radius: 0.625rem;
  }

  .dark {
    --background: oklch(0.145 0 0);
    --foreground: oklch(0.985 0 0);
    --card: oklch(0.145 0 0);
    --card-foreground: oklch(0.985 0 0);
    --popover: oklch(0.145 0 0);
    --popover-foreground: oklch(0.985 0 0);
    --primary: oklch(0.985 0 0);
    --primary-foreground: oklch(0.205 0 0);
    --secondary: oklch(0.269 0 0);
    --secondary-foreground: oklch(0.985 0 0);
    --muted: oklch(0.269 0 0);
    --muted-foreground: oklch(0.708 0 0);
    --accent: oklch(0.269 0 0);
    --accent-foreground: oklch(0.985 0 0);
    --destructive: oklch(0.396 0.141 25.723);
    --destructive-foreground: oklch(0.637 0.237 25.331);
    --border: oklch(0.269 0 0);
    --input: oklch(0.269 0 0);
    --ring: oklch(0.439 0 0);
  }
}

@layer base {
  * {
    @apply border-[var(--border)];
  }
  body {
    @apply bg-[var(--background)] text-[var(--foreground)];
  }
}
```

- [ ] **Step 5: Create `packages/ui/components.json`**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/styles/globals.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "iconLibrary": "lucide",
  "aliases": {
    "components": "@game-finder/ui/components",
    "utils": "@game-finder/ui/lib/utils",
    "hooks": "@game-finder/ui/hooks",
    "lib": "@game-finder/ui/lib",
    "ui": "@game-finder/ui/components"
  }
}
```

- [ ] **Step 6: Add Button component**

Run from `packages/ui`: `pnpm dlx shadcn@latest add button`

If the CLI doesn't work in the monorepo context, manually create `packages/ui/src/components/button.tsx`. Refer to https://ui.shadcn.com/docs/components/button for the source.

- [ ] **Step 7: Install and verify**

Run: `pnpm install && pnpm typecheck --filter @game-finder/ui`
Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add packages/ui pnpm-lock.yaml
git commit -m "feat(ui): set up Shadcn component library with Tailwind and Button component"
```

---

## Task 5: apps/server — Hono + tRPC API

**Files:**
- Create: `apps/server/package.json`
- Create: `apps/server/tsconfig.json`
- Create: `apps/server/vitest.config.ts`
- Create: `apps/server/src/trpc/context.ts`
- Create: `apps/server/src/trpc/init.ts`
- Create: `apps/server/src/trpc/router.ts`
- Create: `apps/server/src/routes/health.ts`
- Create: `apps/server/src/app.ts`
- Create: `apps/server/src/index.ts`
- Create: `apps/server/tests/health.test.ts`

- [ ] **Step 1: Create `apps/server/package.json`**

```json
{
  "name": "@game-finder/server",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    "./trpc/router": "./src/trpc/router.ts"
  },
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "lint": "biome check .",
    "format": "biome format --write .",
    "format:check": "biome format .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@game-finder/db": "workspace:*",
    "@hono/node-server": "^1.13.0",
    "@trpc/server": "^11.0.0",
    "hono": "^4.6.0"
  },
  "devDependencies": {
    "tsx": "^4.19.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create `apps/server/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 3: Create `apps/server/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
  },
})
```

- [ ] **Step 4: Write the failing health check test**

Create `apps/server/tests/health.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { app } from '../src/app.js'

describe('Health check', () => {
  it('GET /health returns 200 with status ok', async () => {
    const res = await app.request('/health')
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.status).toBe('ok')
  })
})
```

- [ ] **Step 5: Run test to verify it fails**

Run: `pnpm test --filter @game-finder/server`
Expected: FAIL — cannot find module `../src/app.js`

- [ ] **Step 6: Create `apps/server/src/trpc/context.ts`**

```typescript
export function createContext() {
  return {}
}

export type Context = Awaited<ReturnType<typeof createContext>>
```

- [ ] **Step 7: Create `apps/server/src/trpc/init.ts`**

```typescript
import { initTRPC } from '@trpc/server'
import type { Context } from './context.js'

const t = initTRPC.context<Context>().create()

export const createRouter = t.router
export const publicProcedure = t.procedure
```

- [ ] **Step 8: Create `apps/server/src/trpc/router.ts`**

```typescript
import { createRouter, publicProcedure } from './init.js'

export const appRouter = createRouter({
  health: createRouter({
    check: publicProcedure.query(() => {
      return { status: 'ok' as const }
    }),
  }),
})

export type AppRouter = typeof appRouter
```

- [ ] **Step 9: Create `apps/server/src/routes/health.ts`**

```typescript
import { Hono } from 'hono'

export const healthRoutes = new Hono()

healthRoutes.get('/health', (c) => {
  return c.json({ status: 'ok' })
})
```

- [ ] **Step 10: Create `apps/server/src/app.ts`**

The Hono app is separated from the server startup so it can be imported in tests without side effects.

```typescript
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createContext } from './trpc/context.js'
import { appRouter } from './trpc/router.js'
import { healthRoutes } from './routes/health.js'

export const app = new Hono()

app.use('/*', cors())

app.route('/', healthRoutes)

app.use('/trpc/*', async (c) => {
  const response = await fetchRequestHandler({
    endpoint: '/trpc',
    req: c.req.raw,
    router: appRouter,
    createContext,
  })
  return response
})
```

- [ ] **Step 11: Create `apps/server/src/index.ts`**

```typescript
import { serve } from '@hono/node-server'
import { app } from './app.js'

if (!process.env.PORT) {
  throw new Error('Missing required environment variable: PORT')
}
const port = Number.parseInt(process.env.PORT, 10)

serve({ fetch: app.fetch, port }, () => {
  console.log(`Server running on http://localhost:${port}`)
})
```

- [ ] **Step 12: Run test to verify it passes**

Run: `pnpm test --filter @game-finder/server`
Expected: PASS

- [ ] **Step 13: Commit**

```bash
git add apps/server pnpm-lock.yaml
git commit -m "feat(server): set up Hono server with tRPC router and health check endpoint"
```

---

## Task 6: apps/web — React Router 7 + Hono SSR

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/react-router.config.ts`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/app/routes.ts`
- Create: `apps/web/app/trpc/query-client.ts`
- Create: `apps/web/app/trpc/provider.tsx`
- Create: `apps/web/app/root.tsx`
- Create: `apps/web/app/routes/home.tsx`

- [ ] **Step 1: Create `apps/web/package.json`**

```json
{
  "name": "@game-finder/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "react-router dev",
    "build": "react-router build",
    "start": "react-router-serve ./build/server/index.js",
    "lint": "biome check .",
    "format": "biome format --write .",
    "format:check": "biome format .",
    "typecheck": "react-router typegen && tsc --noEmit"
  },
  "dependencies": {
    "@game-finder/server": "workspace:*",
    "@game-finder/ui": "workspace:*",
    "@react-router/node": "^7.5.0",
    "@react-router/serve": "^7.5.0",
    "@tanstack/react-query": "^5.62.0",
    "@trpc/client": "^11.0.0",
    "@trpc/tanstack-react-query": "^11.0.0",
    "hono": "^4.6.0",
    "isbot": "^5.1.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router": "^7.5.0",
    "react-router-hono-server": "^2.0.0"
  },
  "devDependencies": {
    "@hono/vite-dev-server": "^0.19.0",
    "@react-router/dev": "^7.5.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/vite": "^4.0.0",
    "vite": "^6.0.0",
    "vite-tsconfig-paths": "^5.1.0"
  }
}
```

Note: `@game-finder/server` is a workspace dependency so the web app can import the `AppRouter` type for type-safe tRPC.

- [ ] **Step 2: Create `apps/web/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "outDir": "dist",
    "rootDir": ".",
    "types": ["vite/client"]
  },
  "include": ["app", "vite.config.ts", "react-router.config.ts"]
}
```

- [ ] **Step 3: Create `apps/web/react-router.config.ts`**

```typescript
import type { Config } from '@react-router/dev/config'

export default {
  ssr: true,
} satisfies Config
```

- [ ] **Step 4: Create `apps/web/vite.config.ts`**

```typescript
import { reactRouter } from '@react-router/dev/vite'
import { reactRouterHonoServer } from 'react-router-hono-server/dev'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [
    reactRouterHonoServer(),
    tailwindcss(),
    reactRouter(),
    tsconfigPaths(),
  ],
})
```

- [ ] **Step 5: Create `apps/web/app/routes.ts`**

```typescript
import { type RouteConfig, index } from '@react-router/dev/routes'

export default [
  index('routes/home.tsx'),
] satisfies RouteConfig
```

- [ ] **Step 6: Create `apps/web/app/trpc/query-client.ts`**

```typescript
import { QueryClient } from '@tanstack/react-query'

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
      },
    },
  })
}
```

- [ ] **Step 7: Create `apps/web/app/trpc/provider.tsx`**

```tsx
import type { QueryClient } from '@tanstack/react-query'
import { QueryClientProvider } from '@tanstack/react-query'
import { createTRPCClient, httpBatchLink } from '@trpc/client'
import { createTRPCContext } from '@trpc/tanstack-react-query'
import { useState } from 'react'
import type { AppRouter } from '@game-finder/server/trpc/router'
import { makeQueryClient } from './query-client.js'

export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>()

let browserQueryClient: QueryClient | undefined

function getQueryClient() {
  if (typeof window === 'undefined') {
    return makeQueryClient()
  }
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient()
  }
  return browserQueryClient
}

export function TRPCReactProvider({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient()
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [
        httpBatchLink({
          url: typeof window !== 'undefined'
            ? '/trpc'
            : `${process.env.SERVER_URL ?? 'http://localhost:4000'}/trpc`,
        }),
      ],
    }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  )
}
```

Note: On the server side (SSR), uses `SERVER_URL` env var. On the client side, uses relative `/trpc` path which will need a proxy or direct connection — this will be refined in the Docker setup (Task 8) based on runtime behavior.

- [ ] **Step 8: Create `apps/web/app/root.tsx`**

```tsx
import { Suspense } from 'react'
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from 'react-router'
import { TRPCReactProvider } from './trpc/provider.js'
import '@game-finder/ui/styles/globals.css'

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export default function Root() {
  return (
    <TRPCReactProvider>
      <Suspense fallback={<div>Loading...</div>}>
        <Outlet />
      </Suspense>
    </TRPCReactProvider>
  )
}
```

- [ ] **Step 9: Create `apps/web/app/routes/home.tsx`**

```tsx
import { useSuspenseQuery } from '@tanstack/react-query'
import { Button } from '@game-finder/ui/components/button'
import { useTRPC } from '../trpc/provider.js'

export default function Home() {
  const trpc = useTRPC()
  const { data } = useSuspenseQuery(trpc.health.check.queryOptions())

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold">Game Finder</h1>
      <p className="text-muted-foreground">
        Server status: {data.status}
      </p>
      <Button>Get Started</Button>
    </div>
  )
}
```

This verifies: tRPC connectivity (health.check call), `@game-finder/ui` import (Button component), and Tailwind styling.

- [ ] **Step 10: Install and verify**

Run: `pnpm install && pnpm typecheck --filter @game-finder/web`
Expected: no errors (may need to run `react-router typegen` first)

- [ ] **Step 11: Commit**

```bash
git add apps/web pnpm-lock.yaml
git commit -m "feat(web): set up React Router 7 with tRPC client and Shadcn UI"
```

---

## Task 7: Docker Compose

**Files:**
- Create: `apps/server/Dockerfile`
- Create: `apps/web/Dockerfile`
- Create: `docker-compose.yml`

- [ ] **Step 1: Create `apps/server/Dockerfile`**

```dockerfile
FROM node:22-slim

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json ./apps/server/
COPY packages/db/package.json ./packages/db/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/shared/package.json ./packages/shared/

RUN pnpm install --frozen-lockfile

COPY . .

EXPOSE 4000

CMD ["pnpm", "--filter", "@game-finder/server", "dev"]
```

- [ ] **Step 2: Create `apps/web/Dockerfile`**

```dockerfile
FROM node:22-slim

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/ui/package.json ./packages/ui/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/shared/package.json ./packages/shared/
COPY apps/server/package.json ./apps/server/
COPY packages/db/package.json ./packages/db/

RUN pnpm install --frozen-lockfile

COPY . .

EXPOSE 3000

CMD ["pnpm", "--filter", "@game-finder/web", "dev"]
```

Note: The web Dockerfile includes `apps/server` and `packages/db` because the web app imports `AppRouter` type from server.

- [ ] **Step 3: Create `docker-compose.yml`**

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: game_finder
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7
    ports:
      - "6379:6379"
    volumes:
      - redisdata:/data

  server:
    build:
      context: .
      dockerfile: apps/server/Dockerfile
    ports:
      - "4000:4000"
    env_file:
      - .env
    environment:
      DB_HOST: postgres
      PORT: "4000"
    volumes:
      - .:/app
      - /app/node_modules
      - /app/apps/server/node_modules
      - /app/apps/web/node_modules
      - /app/packages/db/node_modules
      - /app/packages/ui/node_modules
      - /app/packages/contracts/node_modules
      - /app/packages/shared/node_modules
    depends_on:
      postgres:
        condition: service_healthy

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    ports:
      - "3000:3000"
    env_file:
      - .env
    environment:
      SERVER_URL: http://server:4000
    volumes:
      - .:/app
      - /app/node_modules
      - /app/apps/server/node_modules
      - /app/apps/web/node_modules
      - /app/packages/db/node_modules
      - /app/packages/ui/node_modules
      - /app/packages/contracts/node_modules
      - /app/packages/shared/node_modules
    depends_on:
      - server

volumes:
  pgdata:
  redisdata:
```

Key design notes:
- Source code bind-mounted from host (`.:/app`)
- `node_modules` uses anonymous volumes to avoid host/container platform conflicts
- `DB_HOST: postgres` overrides the `.env` value so the server connects to the Postgres container
- `SERVER_URL: http://server:4000` lets the web container reach the server container by Docker service name
- Postgres health check gates the server startup

- [ ] **Step 4: Verify Docker Compose config**

Run: `docker compose config`
Expected: valid YAML output, no errors

- [ ] **Step 5: Commit**

```bash
git add apps/server/Dockerfile apps/web/Dockerfile docker-compose.yml
git commit -m "feat(docker): add Dockerfiles and Docker Compose for full dev stack"
```

---

## Task 8: Integration Verification

This task verifies all exit criteria are met.

- [ ] **Step 1: Start the full stack**

Run: `docker compose up --build`
Expected: All 4 services start (postgres, redis, server, web). Watch logs for:
- `Server running on http://localhost:4000`
- Web dev server output on port 3000

- [ ] **Step 2: Verify server health check**

Run (in separate terminal): `curl http://localhost:4000/health`
Expected: `{"status":"ok"}`

- [ ] **Step 3: Verify web app renders**

Open: `http://localhost:3000`
Expected: Page renders with "Game Finder" heading, server status shows "ok", and a styled Button component from `@game-finder/ui`

- [ ] **Step 4: Verify tRPC end-to-end**

The home page calling `trpc.health.check.queryOptions()` and displaying the result confirms tRPC connectivity.

- [ ] **Step 5: Verify DB connectivity**

Run: `docker compose exec postgres psql -U postgres -d game_finder -c 'SELECT 1'`
Expected: output showing `1` with no errors, confirming the database is up and accessible.

- [ ] **Step 6: Run all checks**

Run (from host with pnpm available, or inside a container):
```bash
pnpm build
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
```
Expected: all pass

- [ ] **Step 7: Verify `@game-finder/ui` renders in web**

Confirmed in Step 3 — the Button component from `@game-finder/ui` renders on the home page.

- [ ] **Step 8: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: resolve integration issues from end-to-end verification"
```

Only create this commit if fixes were needed. Skip if everything passed cleanly.

---

## Exit Criteria Checklist

Map from spec to verification:

| # | Criterion | Verified in |
|---|-----------|-------------|
| 1 | `docker compose up` starts Postgres, Redis, server, web | Task 8, Step 1 |
| 2 | Web app renders at `http://localhost:3000` | Task 8, Step 3 |
| 3 | Server responds to health check at `http://localhost:4000/health` | Task 8, Step 2 |
| 4 | Web app calls tRPC `health.check` and displays result | Task 8, Steps 3-4 |
| 5 | Web app imports and renders `@game-finder/ui` component | Task 8, Step 3 |
| 6 | DB connection works | Task 8, Step 5 |
| 7 | `pnpm build`, `pnpm lint`, `pnpm format`, `pnpm typecheck`, `pnpm test` pass | Task 8, Step 6 |
| 8 | Server health check has a passing test | Task 5, Steps 4-5, 11 |
