# Epic 2: Auth & User Accounts — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Email/password authentication so users can register, log in, see their auth state in the nav, and log out.

**Architecture:** Hand-rolled auth with bcrypt password hashing, server-side sessions stored in Redis (7-day TTL), httpOnly session cookie. tRPC auth router with register/login/logout/me endpoints. React Router 7 pages for signup and login with field-level error display.

**Tech Stack:** bcryptjs, ioredis, Zod, Kysely migrations, tRPC v11, Shadcn UI (Input, Card, Label), React Router 7 loaders for SSR cookie forwarding.

**Spec:** `docs/superpowers/specs/2026-03-23-epic-2-auth-user-accounts-design.md`

---

## File Map

### New Files

| File | Responsibility |
|------|---------------|
| `packages/contracts/src/auth.ts` | Zod schemas for auth inputs + user output type |
| `packages/db/src/redis.ts` | Redis client factory (ioredis) |
| `packages/db/src/migrations/001-create-users.ts` | Users table migration |
| `apps/server/src/db.ts` | DB singleton for the app |
| `apps/server/src/redis.ts` | Redis singleton for the app |
| `apps/server/src/auth/session.ts` | Session CRUD against Redis |
| `apps/server/src/auth/password.ts` | bcrypt hash/compare |
| `apps/server/src/auth/cookies.ts` | Cookie parse/serialize utilities |
| `apps/server/src/trpc/auth.ts` | tRPC auth router (register, login, logout, me) |
| `apps/server/vitest.config.ts` | Vitest config with setup file |
| `apps/server/tests/setup.ts` | Test env vars |
| `apps/server/tests/helpers.ts` | Test utilities (createTestCaller, createTestUser, cleanup) |
| `apps/server/tests/session.test.ts` | Session helper tests |
| `apps/server/tests/auth.test.ts` | Auth router integration tests |
| `packages/ui/src/components/input.tsx` | Shadcn Input component |
| `packages/ui/src/components/card.tsx` | Shadcn Card component |
| `packages/ui/src/components/label.tsx` | Shadcn Label component |
| `apps/web/app/components/nav.tsx` | Nav bar with auth state |
| `apps/web/app/routes/signup.tsx` | Sign Up page |
| `apps/web/app/routes/login.tsx` | Log In page |

### Modified Files

| File | Change |
|------|--------|
| `packages/contracts/src/index.ts` | Export auth schemas |
| `packages/contracts/package.json` | Add zod dependency |
| `packages/db/src/index.ts` | Export redis client |
| `packages/db/src/env.ts` | Add getRedisConfig |
| `packages/db/src/types.ts` | Add UsersTable + Database type |
| `packages/db/package.json` | Add ioredis dependency, redis export |
| `apps/server/package.json` | Add bcryptjs, @game-finder/contracts deps |
| `apps/server/src/trpc/context.ts` | Full rewrite: session resolution, db/redis in context |
| `apps/server/src/trpc/init.ts` | Add protectedProcedure |
| `apps/server/src/trpc/router.ts` | Add auth router |
| `apps/server/src/app.ts` | No changes needed (context handles everything) |
| `apps/web/app/server.ts` | Add getLoadContext for SSR cookies |
| `apps/web/app/trpc/provider.tsx` | Accept ssrCookie prop, forward in headers |
| `apps/web/app/routes.ts` | Register /signup and /login routes |
| `apps/web/app/root.tsx` | Add loader, nav bar, pass cookie to provider |
| `docker-compose.yml` | Add REDIS_HOST/REDIS_PORT to server, redis to depends_on |
| `.env.example` | Add REDIS_HOST, REDIS_PORT |

---

### Task 1: Install Dependencies

**Files:**
- Modify: `packages/contracts/package.json`
- Modify: `packages/db/package.json`
- Modify: `apps/server/package.json`

- [ ] **Step 1: Add zod to contracts**

```bash
cd packages/contracts && pnpm add zod
```

- [ ] **Step 2: Add ioredis to db**

```bash
cd packages/db && pnpm add ioredis && pnpm add -D @types/ioredis
```

Note: `@types/ioredis` may not be needed — ioredis ships its own types. If `pnpm add -D @types/ioredis` fails or shows a warning, skip it.

- [ ] **Step 3: Add bcryptjs and contracts to server**

```bash
cd apps/server && pnpm add bcryptjs @game-finder/contracts && pnpm add -D @types/bcryptjs
```

- [ ] **Step 4: Install all dependencies**

```bash
cd /Users/evanstern/projects/evanstern/game-finder && pnpm install
```

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/package.json packages/db/package.json apps/server/package.json pnpm-lock.yaml
git commit -m "chore: add auth dependencies (zod, ioredis, bcryptjs)"
```

---

### Task 2: Auth Validation Schemas

**Files:**
- Create: `packages/contracts/src/auth.ts`
- Modify: `packages/contracts/src/index.ts`

- [ ] **Step 1: Create auth schemas**

```typescript
// packages/contracts/src/auth.ts
import { z } from 'zod'

export const registerInputSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(8),
  displayName: z.string().min(1).max(100).trim(),
})

export const loginInputSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1),
})

export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string(),
  displayName: z.string(),
  createdAt: z.coerce.date(),
})

export type RegisterInput = z.infer<typeof registerInputSchema>
export type LoginInput = z.infer<typeof loginInputSchema>
export type UserOutput = z.infer<typeof userSchema>
```

- [ ] **Step 2: Update contracts index**

```typescript
// packages/contracts/src/index.ts
export {
  registerInputSchema,
  loginInputSchema,
  userSchema,
  type RegisterInput,
  type LoginInput,
  type UserOutput,
} from './auth.js'
```

- [ ] **Step 3: Add contracts export path for auth**

In `packages/contracts/package.json`, update exports:

```json
{
  "exports": {
    ".": "./src/index.ts",
    "./auth": "./src/auth.ts"
  }
}
```

- [ ] **Step 4: Typecheck**

```bash
cd packages/contracts && pnpm typecheck
```

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/
git commit -m "feat(contracts): add Zod schemas for auth inputs and user output"
```

---

### Task 3: Redis Client

**Files:**
- Create: `packages/db/src/redis.ts`
- Modify: `packages/db/src/env.ts`
- Modify: `packages/db/src/index.ts`
- Modify: `packages/db/package.json`

- [ ] **Step 1: Add getRedisConfig to env.ts**

Add to the end of `packages/db/src/env.ts`:

```typescript
export function getRedisConfig() {
  return {
    host: requireEnv('REDIS_HOST'),
    port: Number.parseInt(requireEnv('REDIS_PORT'), 10),
  }
}
```

- [ ] **Step 2: Create redis.ts**

```typescript
// packages/db/src/redis.ts
import Redis from 'ioredis'
import { getRedisConfig } from './env.js'

export function createRedisClient(): Redis {
  const config = getRedisConfig()
  return new Redis({
    host: config.host,
    port: config.port,
  })
}
```

- [ ] **Step 3: Add redis export to package.json**

In `packages/db/package.json`, update exports:

```json
{
  "exports": {
    ".": "./src/index.ts",
    "./redis": "./src/redis.ts"
  }
}
```

- [ ] **Step 4: Update index.ts**

Add `getRedisConfig` export only. Do NOT export `UsersTable` yet — it doesn't exist until Task 4.

```typescript
// packages/db/src/index.ts
export type { Database } from './types.js'
export { createDb } from './client.js'
export { getDbConfig, getRedisConfig } from './env.js'
```

- [ ] **Step 5: Typecheck**

```bash
cd packages/db && pnpm typecheck
```

- [ ] **Step 6: Commit**

```bash
git add packages/db/
git commit -m "feat(db): add Redis client factory and config"
```

---

### Task 4: Users Table Migration & Types

**Files:**
- Create: `packages/db/src/migrations/001-create-users.ts`
- Modify: `packages/db/src/types.ts`

- [ ] **Step 1: Create migration file**

Remove `.gitkeep` if present, then create:

```typescript
// packages/db/src/migrations/001-create-users.ts
import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('users')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn('email', 'varchar(255)', (col) => col.notNull().unique())
    .addColumn('password_hash', 'varchar(255)', (col) => col.notNull())
    .addColumn('display_name', 'varchar(100)', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('users').execute()
}
```

- [ ] **Step 2: Update Database type**

```typescript
// packages/db/src/types.ts
import type { Generated } from 'kysely'

export interface UsersTable {
  id: Generated<string>
  email: string
  password_hash: string
  display_name: string
  created_at: Generated<Date>
  updated_at: Generated<Date>
}

export interface Database {
  users: UsersTable
}
```

- [ ] **Step 3: Update index.ts to export UsersTable**

```typescript
// packages/db/src/index.ts
export type { Database, UsersTable } from './types.js'
export { createDb } from './client.js'
export { getDbConfig, getRedisConfig } from './env.js'
```

- [ ] **Step 4: Run migration**

Ensure Docker Postgres is running, then:

```bash
cd packages/db && pnpm migrate
```

Expected: `Migration "001-create-users" executed successfully`

- [ ] **Step 5: Typecheck**

```bash
cd packages/db && pnpm typecheck
```

- [ ] **Step 6: Commit**

```bash
git add packages/db/
git commit -m "feat(db): add users table migration and types"
```

---

### Task 5: Server Test Infrastructure

**Files:**
- Create: `apps/server/vitest.config.ts`
- Create: `apps/server/tests/setup.ts`
- Create: `apps/server/tests/helpers.ts`

- [ ] **Step 1: Create vitest.config.ts**

```typescript
// apps/server/vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    setupFiles: ['./tests/setup.ts'],
  },
})
```

- [ ] **Step 2: Create test setup**

```typescript
// apps/server/tests/setup.ts
process.env.DB_HOST = 'localhost'
process.env.DB_PORT = '5432'
process.env.DB_NAME = 'game_finder'
process.env.DB_USER = 'postgres'
process.env.DB_PASSWORD = 'postgres'
process.env.REDIS_HOST = 'localhost'
process.env.REDIS_PORT = '6379'
process.env.PORT = '4000'
```

- [ ] **Step 3: Create test helpers**

This file depends on modules created in Tasks 6-7, so create it as a stub now and fill in after those tasks. For now:

```typescript
// apps/server/tests/helpers.ts
export {}
```

- [ ] **Step 4: Verify existing health test still passes**

```bash
cd apps/server && pnpm test
```

Expected: health check test passes.

- [ ] **Step 5: Commit**

```bash
git add apps/server/vitest.config.ts apps/server/tests/setup.ts apps/server/tests/helpers.ts
git commit -m "test(server): add vitest config and test infrastructure"
```

---

### Task 6: Session & Password Helpers (TDD)

**Files:**
- Create: `apps/server/src/auth/session.ts`
- Create: `apps/server/src/auth/password.ts`
- Create: `apps/server/src/auth/cookies.ts`
- Create: `apps/server/tests/session.test.ts`

- [ ] **Step 1: Write session & password tests**

```typescript
// apps/server/tests/session.test.ts
import Redis from 'ioredis'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import {
  createSession,
  deleteSession,
  getSession,
} from '../src/auth/session.js'
import { hashPassword, verifyPassword } from '../src/auth/password.js'

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT),
})

beforeEach(async () => {
  const keys = await redis.keys('session:*')
  if (keys.length > 0) await redis.del(...keys)
})

afterAll(() => {
  redis.disconnect()
})

describe('Session helpers', () => {
  it('createSession stores session and returns ID', async () => {
    const sessionId = await createSession(redis, 'user-123')
    expect(sessionId).toBeTruthy()

    const data = await redis.get(`session:${sessionId}`)
    expect(data).toBeTruthy()

    const parsed = JSON.parse(data!) as { userId: string }
    expect(parsed.userId).toBe('user-123')
  })

  it('getSession returns session data for valid ID', async () => {
    const sessionId = await createSession(redis, 'user-456')
    const session = await getSession(redis, sessionId)
    expect(session).toEqual({ userId: 'user-456' })
  })

  it('getSession returns null for invalid ID', async () => {
    const session = await getSession(redis, 'nonexistent')
    expect(session).toBeNull()
  })

  it('deleteSession removes the session', async () => {
    const sessionId = await createSession(redis, 'user-789')
    await deleteSession(redis, sessionId)
    const session = await getSession(redis, sessionId)
    expect(session).toBeNull()
  })
})

describe('Password helpers', () => {
  it('hashPassword returns a bcrypt hash', async () => {
    const hash = await hashPassword('mysecretpassword')
    expect(hash).toBeTruthy()
    expect(hash).not.toBe('mysecretpassword')
    expect(hash.startsWith('$2')).toBe(true)
  })

  it('verifyPassword returns true for correct password', async () => {
    const hash = await hashPassword('correctpassword')
    const result = await verifyPassword('correctpassword', hash)
    expect(result).toBe(true)
  })

  it('verifyPassword returns false for wrong password', async () => {
    const hash = await hashPassword('correctpassword')
    const result = await verifyPassword('wrongpassword', hash)
    expect(result).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/server && pnpm test -- tests/session.test.ts
```

Expected: FAIL — modules don't exist yet.

- [ ] **Step 3: Implement session helpers**

```typescript
// apps/server/src/auth/session.ts
import type Redis from 'ioredis'

const SESSION_PREFIX = 'session:'
const SESSION_TTL = 60 * 60 * 24 * 7

export async function createSession(
  redis: Redis,
  userId: string,
): Promise<string> {
  const sessionId = crypto.randomUUID()
  await redis.set(
    `${SESSION_PREFIX}${sessionId}`,
    JSON.stringify({ userId, createdAt: Date.now() }),
    'EX',
    SESSION_TTL,
  )
  return sessionId
}

export async function getSession(
  redis: Redis,
  sessionId: string,
): Promise<{ userId: string } | null> {
  const data = await redis.get(`${SESSION_PREFIX}${sessionId}`)
  if (!data) return null
  return JSON.parse(data) as { userId: string }
}

export async function deleteSession(
  redis: Redis,
  sessionId: string,
): Promise<void> {
  await redis.del(`${SESSION_PREFIX}${sessionId}`)
}
```

- [ ] **Step 4: Implement password helpers**

```typescript
// apps/server/src/auth/password.ts
import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 10

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash)
}
```

- [ ] **Step 5: Implement cookie utilities**

```typescript
// apps/server/src/auth/cookies.ts
const COOKIE_NAME = 'session_id'
const MAX_AGE = 60 * 60 * 24 * 7

export function parseCookies(header: string): Record<string, string> {
  if (!header) return {}
  return Object.fromEntries(
    header.split(';').map((c) => {
      const [key, ...val] = c.trim().split('=')
      return [key, val.join('=')]
    }),
  )
}

export function getSessionIdFromRequest(req: Request): string | undefined {
  const cookies = parseCookies(req.headers.get('cookie') ?? '')
  return cookies[COOKIE_NAME]
}

export function serializeSessionCookie(sessionId: string): string {
  const secure = process.env.NODE_ENV === 'production'
  return `${COOKIE_NAME}=${sessionId}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${MAX_AGE}${secure ? '; Secure' : ''}`
}

export function serializeClearSessionCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd apps/server && pnpm test -- tests/session.test.ts
```

Expected: All 7 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/server/src/auth/ apps/server/tests/session.test.ts
git commit -m "feat(server): add session, password, and cookie helpers with tests"
```

---

### Task 7: tRPC Auth Middleware & Context

**Files:**
- Create: `apps/server/src/db.ts`
- Create: `apps/server/src/redis.ts`
- Modify: `apps/server/src/trpc/context.ts`
- Modify: `apps/server/src/trpc/init.ts`

- [ ] **Step 1: Create DB singleton**

```typescript
// apps/server/src/db.ts
import { createDb } from '@game-finder/db'

export const db = createDb()
```

- [ ] **Step 2: Create Redis singleton**

```typescript
// apps/server/src/redis.ts
import { createRedisClient } from '@game-finder/db/redis'

export const redis = createRedisClient()
```

- [ ] **Step 3: Rewrite tRPC context**

```typescript
// apps/server/src/trpc/context.ts
import { getSessionIdFromRequest } from '../auth/cookies.js'
import { getSession } from '../auth/session.js'
import { db } from '../db.js'
import { redis } from '../redis.js'

export async function createContext({
  req,
  resHeaders,
}: {
  req: Request
  resHeaders: Headers
}) {
  let userId: string | null = null
  let sessionId: string | null = null

  const cookieSessionId = getSessionIdFromRequest(req)
  if (cookieSessionId) {
    const session = await getSession(redis, cookieSessionId)
    if (session) {
      userId = session.userId
      sessionId = cookieSessionId
    }
  }

  return { db, redis, userId, sessionId, resHeaders }
}

export type Context = Awaited<ReturnType<typeof createContext>>
```

- [ ] **Step 4: Add protectedProcedure to init.ts**

```typescript
// apps/server/src/trpc/init.ts
import { TRPCError, initTRPC } from '@trpc/server'
import type { Context } from './context.js'

const t = initTRPC.context<Context>().create()

const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.userId || !ctx.sessionId) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' })
  }
  return next({ ctx: { ...ctx, userId: ctx.userId, sessionId: ctx.sessionId } })
})

export const createRouter = t.router
export const publicProcedure = t.procedure
export const protectedProcedure = t.procedure.use(isAuthed)
```

- [ ] **Step 5: Verify existing health test still passes**

```bash
cd apps/server && pnpm test
```

Expected: health check test still passes (context signature change is backward compatible with the fetch adapter).

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/db.ts apps/server/src/redis.ts apps/server/src/trpc/context.ts apps/server/src/trpc/init.ts
git commit -m "feat(server): add auth middleware with session resolution and protectedProcedure"
```

---

### Task 8: Auth Router — Register & Login (TDD)

**Files:**
- Create: `apps/server/src/trpc/auth.ts`
- Modify: `apps/server/src/trpc/router.ts`
- Modify: `apps/server/tests/helpers.ts`
- Create: `apps/server/tests/auth.test.ts`

- [ ] **Step 1: Fill in test helpers**

```typescript
// apps/server/tests/helpers.ts
import { appRouter } from '../src/trpc/router.js'
import { createContext } from '../src/trpc/context.js'
import { db } from '../src/db.js'
import { redis } from '../src/redis.js'
import { hashPassword } from '../src/auth/password.js'
import { createSession } from '../src/auth/session.js'

export { db, redis }

export async function createTestCaller(cookie?: string) {
  const req = new Request('http://test.com', {
    headers: cookie ? { cookie } : {},
  })
  const resHeaders = new Headers()
  const ctx = await createContext({ req, resHeaders })
  const caller = appRouter.createCaller(ctx)
  return { caller, resHeaders }
}

export async function createTestUser(
  overrides?: {
    email?: string
    password?: string
    displayName?: string
  },
) {
  const email = overrides?.email ?? 'test@example.com'
  const password = overrides?.password ?? 'password123'
  const displayName = overrides?.displayName ?? 'Test User'
  const passwordHash = await hashPassword(password)

  return db
    .insertInto('users')
    .values({
      email,
      password_hash: passwordHash,
      display_name: displayName,
    })
    .returningAll()
    .executeTakeFirstOrThrow()
}

export async function createAuthenticatedCaller(userId: string) {
  const sessionId = await createSession(redis, userId)
  return createTestCaller(`session_id=${sessionId}`)
}

export async function cleanup() {
  await db.deleteFrom('users').execute()
  const keys = await redis.keys('session:*')
  if (keys.length > 0) await redis.del(...keys)
}
```

- [ ] **Step 2: Write register & login tests**

```typescript
// apps/server/tests/auth.test.ts
import { TRPCError } from '@trpc/server'
import { afterAll, afterEach, describe, expect, it } from 'vitest'
import {
  cleanup,
  createAuthenticatedCaller,
  createTestCaller,
  createTestUser,
  db,
  redis,
} from './helpers.js'

afterEach(async () => {
  await cleanup()
})

afterAll(async () => {
  await db.destroy()
  redis.disconnect()
})

describe('auth.register', () => {
  it('creates a user and sets session cookie', async () => {
    const { caller, resHeaders } = await createTestCaller()
    const result = await caller.auth.register({
      email: 'new@example.com',
      password: 'password123',
      displayName: 'New User',
    })

    expect(result.user.email).toBe('new@example.com')
    expect(result.user.displayName).toBe('New User')
    expect(result.user.id).toBeTruthy()
    expect(resHeaders.get('set-cookie')).toContain('session_id=')
  })

  it('lowercases and trims email', async () => {
    const { caller } = await createTestCaller()
    const result = await caller.auth.register({
      email: '  Test@Example.COM  ',
      password: 'password123',
      displayName: 'Test',
    })

    expect(result.user.email).toBe('test@example.com')
  })

  it('rejects duplicate email', async () => {
    await createTestUser({ email: 'taken@example.com' })
    const { caller } = await createTestCaller()

    await expect(
      caller.auth.register({
        email: 'taken@example.com',
        password: 'password123',
        displayName: 'Another User',
      }),
    ).rejects.toThrow(
      expect.objectContaining({
        code: 'CONFLICT',
      }),
    )
  })

  it('rejects password shorter than 8 characters', async () => {
    const { caller } = await createTestCaller()

    await expect(
      caller.auth.register({
        email: 'test@example.com',
        password: 'short',
        displayName: 'Test',
      }),
    ).rejects.toThrow()
  })
})

describe('auth.login', () => {
  it('logs in with correct credentials and sets session cookie', async () => {
    await createTestUser({
      email: 'user@example.com',
      password: 'password123',
    })
    const { caller, resHeaders } = await createTestCaller()

    const result = await caller.auth.login({
      email: 'user@example.com',
      password: 'password123',
    })

    expect(result.user.email).toBe('user@example.com')
    expect(resHeaders.get('set-cookie')).toContain('session_id=')
  })

  it('rejects wrong password', async () => {
    await createTestUser({
      email: 'user@example.com',
      password: 'password123',
    })
    const { caller } = await createTestCaller()

    await expect(
      caller.auth.login({
        email: 'user@example.com',
        password: 'wrongpassword',
      }),
    ).rejects.toThrow(
      expect.objectContaining({
        code: 'UNAUTHORIZED',
      }),
    )
  })

  it('rejects nonexistent email', async () => {
    const { caller } = await createTestCaller()

    await expect(
      caller.auth.login({
        email: 'nobody@example.com',
        password: 'password123',
      }),
    ).rejects.toThrow(
      expect.objectContaining({
        code: 'UNAUTHORIZED',
      }),
    )
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd apps/server && pnpm test -- tests/auth.test.ts
```

Expected: FAIL — auth router doesn't exist yet.

- [ ] **Step 4: Implement auth router**

```typescript
// apps/server/src/trpc/auth.ts
import { TRPCError } from '@trpc/server'
import {
  loginInputSchema,
  registerInputSchema,
} from '@game-finder/contracts/auth'
import {
  serializeClearSessionCookie,
  serializeSessionCookie,
} from '../auth/cookies.js'
import { hashPassword, verifyPassword } from '../auth/password.js'
import { createSession, deleteSession } from '../auth/session.js'
import { createRouter, protectedProcedure, publicProcedure } from './init.js'

export const authRouter = createRouter({
  register: publicProcedure
    .input(registerInputSchema)
    .mutation(async ({ input, ctx }) => {
      const existing = await ctx.db
        .selectFrom('users')
        .select('id')
        .where('email', '=', input.email)
        .executeTakeFirst()

      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Email already in use',
        })
      }

      const passwordHash = await hashPassword(input.password)

      const user = await ctx.db
        .insertInto('users')
        .values({
          email: input.email,
          password_hash: passwordHash,
          display_name: input.displayName,
        })
        .returningAll()
        .executeTakeFirstOrThrow()

      const sessionId = await createSession(ctx.redis, user.id)
      ctx.resHeaders.append('set-cookie', serializeSessionCookie(sessionId))

      return {
        user: {
          id: user.id,
          email: user.email,
          displayName: user.display_name,
          createdAt: user.created_at,
        },
      }
    }),

  login: publicProcedure
    .input(loginInputSchema)
    .mutation(async ({ input, ctx }) => {
      const user = await ctx.db
        .selectFrom('users')
        .selectAll()
        .where('email', '=', input.email)
        .executeTakeFirst()

      if (!user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid email or password',
        })
      }

      const valid = await verifyPassword(input.password, user.password_hash)
      if (!valid) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid email or password',
        })
      }

      const sessionId = await createSession(ctx.redis, user.id)
      ctx.resHeaders.append('set-cookie', serializeSessionCookie(sessionId))

      return {
        user: {
          id: user.id,
          email: user.email,
          displayName: user.display_name,
          createdAt: user.created_at,
        },
      }
    }),

  logout: protectedProcedure.mutation(async ({ ctx }) => {
    await deleteSession(ctx.redis, ctx.sessionId)
    ctx.resHeaders.append('set-cookie', serializeClearSessionCookie())
    return { success: true }
  }),

  me: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.userId) return null

    const user = await ctx.db
      .selectFrom('users')
      .selectAll()
      .where('id', '=', ctx.userId)
      .executeTakeFirst()

    if (!user) return null

    return {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      createdAt: user.created_at,
    }
  }),
})
```

- [ ] **Step 5: Wire auth router into root router**

```typescript
// apps/server/src/trpc/router.ts
import { authRouter } from './auth.js'
import { createRouter, publicProcedure } from './init.js'

export const appRouter = createRouter({
  health: createRouter({
    check: publicProcedure.query(() => {
      return { status: 'ok' as const }
    }),
  }),
  auth: authRouter,
})

export type AppRouter = typeof appRouter
```

- [ ] **Step 6: Run register & login tests**

```bash
cd apps/server && pnpm test -- tests/auth.test.ts
```

Expected: All register and login tests PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/server/src/trpc/auth.ts apps/server/src/trpc/router.ts apps/server/tests/helpers.ts apps/server/tests/auth.test.ts
git commit -m "feat(server): add auth router with register and login endpoints"
```

---

### Task 9: Auth Router — Logout & Me (TDD)

**Files:**
- Modify: `apps/server/tests/auth.test.ts`

- [ ] **Step 1: Add logout & me tests to auth.test.ts**

Append to the existing test file:

```typescript
describe('auth.logout', () => {
  it('clears session and cookie', async () => {
    const user = await createTestUser()
    const { caller, resHeaders } = await createAuthenticatedCaller(user.id)

    const result = await caller.auth.logout()

    expect(result.success).toBe(true)
    expect(resHeaders.get('set-cookie')).toContain('Max-Age=0')
  })

  it('rejects unauthenticated request', async () => {
    const { caller } = await createTestCaller()

    await expect(caller.auth.logout()).rejects.toThrow(
      expect.objectContaining({
        code: 'UNAUTHORIZED',
      }),
    )
  })
})

describe('auth.me', () => {
  it('returns user when authenticated', async () => {
    const user = await createTestUser({
      email: 'me@example.com',
      displayName: 'Me User',
    })
    const { caller } = await createAuthenticatedCaller(user.id)

    const result = await caller.auth.me()

    expect(result).not.toBeNull()
    expect(result!.email).toBe('me@example.com')
    expect(result!.displayName).toBe('Me User')
  })

  it('returns null when not authenticated', async () => {
    const { caller } = await createTestCaller()

    const result = await caller.auth.me()

    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests**

```bash
cd apps/server && pnpm test -- tests/auth.test.ts
```

Expected: All tests PASS (logout and me are already implemented in the auth router from Task 8).

- [ ] **Step 3: Run all server tests**

```bash
cd apps/server && pnpm test
```

Expected: All tests pass (health + session + auth).

- [ ] **Step 4: Commit**

```bash
git add apps/server/tests/auth.test.ts
git commit -m "test(server): add logout and me endpoint tests"
```

---

### Task 10: Docker Compose & Env Updates

**Files:**
- Modify: `docker-compose.yml`
- Modify: `.env.example`

- [ ] **Step 1: Update docker-compose.yml**

In the `server` service, add Redis env vars and depends_on:

```yaml
  server:
    # ... existing config ...
    environment:
      DB_HOST: postgres
      PORT: "4000"
      REDIS_HOST: redis
      REDIS_PORT: "6379"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
```

- [ ] **Step 2: Update .env.example**

Add Redis vars:

```
# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
```

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml .env.example
git commit -m "chore: add Redis env vars to Docker Compose and .env.example"
```

---

### Task 11: Shadcn UI Components

**Files:**
- Create: `packages/ui/src/components/input.tsx`
- Create: `packages/ui/src/components/card.tsx`
- Create: `packages/ui/src/components/label.tsx`

- [ ] **Step 1: Add components via Shadcn CLI**

```bash
cd packages/ui && pnpm dlx shadcn@latest add input card label
```

If the CLI prompts, accept defaults. Verify the three component files are created in `src/components/`.

- [ ] **Step 2: Verify components exist and typecheck**

```bash
ls packages/ui/src/components/{input,card,label}.tsx
cd packages/ui && pnpm typecheck
```

- [ ] **Step 3: Commit**

```bash
git add packages/ui/
git commit -m "feat(ui): add Input, Card, and Label Shadcn components"
```

---

### Task 12: SSR Cookie Forwarding

**Files:**
- Modify: `apps/web/app/server.ts`
- Modify: `apps/web/app/trpc/provider.tsx`
- Modify: `apps/web/app/root.tsx`

- [ ] **Step 1: Add getLoadContext to server.ts**

Update `apps/web/app/server.ts` to pass cookies to React Router context:

```typescript
// apps/web/app/server.ts
import { createHonoServer } from 'react-router-hono-server/node'

export default await createHonoServer({
  configure(app) {
    const serverUrl = process.env.SERVER_URL ?? 'http://localhost:4000'

    app.all('/trpc/*', async (c) => {
      const target = new URL(serverUrl)
      const url = new URL(c.req.url)
      url.hostname = target.hostname
      url.port = target.port
      url.protocol = target.protocol

      const res = await fetch(
        new Request(url.toString(), {
          method: c.req.method,
          headers: c.req.raw.headers,
          body: c.req.raw.body,
        }),
      )

      return new Response(res.body, {
        status: res.status,
        statusText: res.statusText,
        headers: new Headers(res.headers),
      })
    })
  },
  getLoadContext(c) {
    return {
      cookie: c.req.header('cookie') ?? '',
    }
  },
})
```

- [ ] **Step 2: Update tRPC provider to accept SSR cookies**

```typescript
// apps/web/app/trpc/provider.tsx
import type { AppRouter } from '@game-finder/server/trpc/router'
import type { QueryClient } from '@tanstack/react-query'
import { QueryClientProvider } from '@tanstack/react-query'
import { createTRPCClient, httpBatchLink } from '@trpc/client'
import { createTRPCContext } from '@trpc/tanstack-react-query'
import { useState } from 'react'
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

export function TRPCReactProvider({
  children,
  ssrCookie,
}: {
  children: React.ReactNode
  ssrCookie?: string
}) {
  const queryClient = getQueryClient()
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [
        httpBatchLink({
          url:
            typeof window !== 'undefined'
              ? '/trpc'
              : (() => {
                  const serverUrl = process.env.SERVER_URL
                  if (!serverUrl) {
                    throw new Error(
                      'SERVER_URL environment variable is required',
                    )
                  }
                  return `${serverUrl}/trpc`
                })(),
          headers: () => {
            if (typeof window !== 'undefined') return {}
            return ssrCookie ? { cookie: ssrCookie } : {}
          },
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

- [ ] **Step 3: Update root.tsx with loader**

```typescript
// apps/web/app/root.tsx
import '@game-finder/ui/styles/globals.css'
import { Suspense } from 'react'
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from 'react-router'
import type { Route } from './+types/root.js'
import { TRPCReactProvider } from './trpc/provider.js'

export function loader({ context }: Route.LoaderArgs) {
  const ctx = context as { cookie?: string }
  return { cookie: ctx?.cookie ?? '' }
}

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

export default function Root({ loaderData }: Route.ComponentProps) {
  return (
    <TRPCReactProvider ssrCookie={loaderData.cookie}>
      <Suspense fallback={<div>Loading...</div>}>
        <Outlet />
      </Suspense>
    </TRPCReactProvider>
  )
}
```

- [ ] **Step 4: Typecheck web app**

```bash
cd apps/web && pnpm typecheck
```

If `Route.LoaderArgs` or `Route.ComponentProps` types are not generated, run:

```bash
cd apps/web && npx react-router typegen
```

Then retry typecheck.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/server.ts apps/web/app/trpc/provider.tsx apps/web/app/root.tsx
git commit -m "feat(web): add SSR cookie forwarding for auth state"
```

---

### Task 13: Nav Bar Component

**Files:**
- Create: `apps/web/app/components/nav.tsx`
- Modify: `apps/web/app/root.tsx`

- [ ] **Step 1: Create nav component**

```typescript
// apps/web/app/components/nav.tsx
import { Button } from '@game-finder/ui/components/button'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router'
import { useTRPC } from '../trpc/provider.js'

export function Nav() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const { data: user, isLoading } = useQuery(trpc.auth.me.queryOptions())

  const logoutMutation = useMutation(
    trpc.auth.logout.mutationOptions({
      onSuccess: () => {
        queryClient.setQueryData(trpc.auth.me.queryOptions().queryKey, null)
        navigate('/')
      },
    }),
  )

  return (
    <nav className="flex items-center justify-between border-b px-6 py-3">
      <Link to="/" className="text-lg font-bold">
        Game Finder
      </Link>
      <div className="flex items-center gap-4">
        {isLoading ? null : user ? (
          <>
            <span className="text-sm text-muted-foreground">
              {user.displayName}
            </span>
            <button
              type="button"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Log Out
            </button>
          </>
        ) : (
          <>
            <Link
              to="/login"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Log In
            </Link>
            <Button size="sm" asChild>
              <Link to="/signup">Sign Up</Link>
            </Button>
          </>
        )}
      </div>
    </nav>
  )
}
```

- [ ] **Step 2: Add Nav to root layout**

Update the `Root` component in `apps/web/app/root.tsx`:

```typescript
import { Nav } from './components/nav.js'

// ... keep loader and Layout unchanged ...

export default function Root({ loaderData }: Route.ComponentProps) {
  return (
    <TRPCReactProvider ssrCookie={loaderData.cookie}>
      <Nav />
      <Suspense fallback={<div>Loading...</div>}>
        <Outlet />
      </Suspense>
    </TRPCReactProvider>
  )
}
```

- [ ] **Step 3: Typecheck**

```bash
cd apps/web && pnpm typecheck
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/components/nav.tsx apps/web/app/root.tsx
git commit -m "feat(web): add nav bar with auth state display"
```

---

### Task 14: Sign Up Page

**Files:**
- Create: `apps/web/app/routes/signup.tsx`

- [ ] **Step 1: Create signup route**

```typescript
// apps/web/app/routes/signup.tsx
import { Button } from '@game-finder/ui/components/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@game-finder/ui/components/card'
import { Input } from '@game-finder/ui/components/input'
import { Label } from '@game-finder/ui/components/label'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useTRPC } from '../trpc/provider.js'

export default function SignUp() {
  const navigate = useNavigate()
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const { data: currentUser } = useQuery(trpc.auth.me.queryOptions())

  useEffect(() => {
    if (currentUser) navigate('/')
  }, [currentUser, navigate])

  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const registerMutation = useMutation(
    trpc.auth.register.mutationOptions({
      onSuccess: (data) => {
        queryClient.setQueryData(
          trpc.auth.me.queryOptions().queryKey,
          data.user,
        )
        navigate('/')
      },
      onError: (error) => {
        if (error.message === 'Email already in use') {
          setErrors({ email: 'Email already in use' })
        } else {
          setErrors({ form: error.message })
        }
      },
    }),
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    registerMutation.mutate({ displayName, email, password })
  }

  return (
    <div className="flex min-h-[calc(100vh-57px)] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create an account</CardTitle>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {errors.form && (
              <p className="text-sm text-destructive">{errors.form}</p>
            )}
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />
              {errors.displayName && (
                <p className="text-sm text-destructive">
                  {errors.displayName}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password}</p>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button
              type="submit"
              className="w-full"
              disabled={registerMutation.isPending}
            >
              {registerMutation.isPending ? 'Creating account...' : 'Sign Up'}
            </Button>
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link to="/login" className="text-primary hover:underline">
                Log in
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Register signup and login routes**

React Router 7 requires explicit route registration. Update `apps/web/app/routes.ts`:

```typescript
// apps/web/app/routes.ts
import { type RouteConfig, index, route } from '@react-router/dev/routes'

export default [
  index('routes/home.tsx'),
  route('signup', 'routes/signup.tsx'),
  route('login', 'routes/login.tsx'),
] satisfies RouteConfig
```

Note: We register both `/signup` and `/login` now so the login route is ready for Task 15.

- [ ] **Step 3: Typecheck**

```bash
cd apps/web && pnpm typecheck
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/routes/signup.tsx apps/web/app/routes.ts
git commit -m "feat(web): add Sign Up page with form and field-level errors"
```

---

### Task 15: Log In Page

**Files:**
- Create: `apps/web/app/routes/login.tsx`

- [ ] **Step 1: Create login route**

```typescript
// apps/web/app/routes/login.tsx
import { Button } from '@game-finder/ui/components/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@game-finder/ui/components/card'
import { Input } from '@game-finder/ui/components/input'
import { Label } from '@game-finder/ui/components/label'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useTRPC } from '../trpc/provider.js'

export default function LogIn() {
  const navigate = useNavigate()
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const { data: currentUser } = useQuery(trpc.auth.me.queryOptions())

  useEffect(() => {
    if (currentUser) navigate('/')
  }, [currentUser, navigate])

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const loginMutation = useMutation(
    trpc.auth.login.mutationOptions({
      onSuccess: (data) => {
        queryClient.setQueryData(
          trpc.auth.me.queryOptions().queryKey,
          data.user,
        )
        navigate('/')
      },
      onError: (error) => {
        setErrors({ form: error.message })
      },
    }),
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    loginMutation.mutate({ email, password })
  }

  return (
    <div className="flex min-h-[calc(100vh-57px)] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Welcome back</CardTitle>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {errors.form && (
              <p className="text-sm text-destructive">{errors.form}</p>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button
              type="submit"
              className="w-full"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? 'Logging in...' : 'Log In'}
            </Button>
            <p className="text-sm text-muted-foreground">
              Don't have an account?{' '}
              <Link to="/signup" className="text-primary hover:underline">
                Sign up
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/web && pnpm typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/routes/login.tsx
git commit -m "feat(web): add Log In page with form and field-level errors"
```

---

### Task 16: Integration Verification

- [ ] **Step 1: Run all server tests**

```bash
cd apps/server && pnpm test
```

Expected: All tests pass (health, session, auth).

- [ ] **Step 2: Run typecheck across the monorepo**

```bash
pnpm typecheck
```

Expected: No type errors.

- [ ] **Step 3: Run lint**

```bash
pnpm lint
```

Expected: No lint errors. Fix any that arise.

- [ ] **Step 4: Start full stack via Docker Compose**

```bash
docker compose up --build
```

- [ ] **Step 5: Manual verification checklist**

Open http://localhost:3000 and verify:

1. Nav bar shows "Game Finder" left, "Log In" + "Sign Up" right
2. Click "Sign Up" → navigate to `/signup`
3. Fill in Display Name, Email, Password → submit
4. Redirect to `/` → nav shows display name + "Log Out"
5. Click "Log Out" → nav shows "Log In" + "Sign Up" again
6. Click "Log In" → navigate to `/login`
7. Log in with the registered credentials
8. Redirect to `/` → nav shows display name + "Log Out"
9. Navigate to `/signup` while logged in → redirects to `/`
10. Navigate to `/login` while logged in → redirects to `/`

- [ ] **Step 6: Fix any issues found**

Address any integration issues (especially cookie passthrough through the proxy).

- [ ] **Step 7: Final commit if fixes were needed**

```bash
git add -A
git commit -m "fix: address integration issues found during verification"
```
