# Epic 5: Contact Host Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users (anonymous or logged-in) to send a message to a gathering host from the details page, with rate limiting and a pluggable email service.

**Architecture:** New `contact` tRPC router with a single `send` mutation. An `EmailService` interface with a console-logging implementation. Redis sliding-window rate limiter. Contact form component added below the description on the existing gathering details page.

**Tech Stack:** TypeScript, tRPC, Hono, Zod, Redis (rate limiting), Vitest (testing), React Router 7, Tailwind, Shadcn (Textarea, Sonner toast)

**Spec:** `docs/superpowers/specs/2026-03-24-epic-5-contact-host-design.md`

**Note:** Epic 3 (gatherings) may not yet be merged when this plan is executed. Tasks reference tables and routers from Epic 3. If those don't exist yet on the working branch, rebase or merge Epic 3 first. The gathering details page (`apps/web/app/routes/gatherings.$id.tsx`) and gathering router (`apps/server/src/trpc/gathering.ts`) are prerequisites.

---

## File Structure

### New files

| File | Responsibility |
|------|---------------|
| `packages/contracts/src/contact.ts` | Zod schema for contact form input |
| `apps/server/src/services/email.ts` | `EmailService` interface + `ConsoleEmailService` |
| `apps/server/src/services/rate-limiter.ts` | `RateLimiter` interface + Redis implementation |
| `apps/server/src/trpc/contact.ts` | tRPC contact router with `send` mutation |
| `apps/server/tests/email.test.ts` | Smoke test for ConsoleEmailService |
| `apps/server/tests/contact.test.ts` | Integration tests for contact.send |
| `apps/server/tests/rate-limiter.test.ts` | Unit tests for rate limiter |
| `apps/web/app/components/contact-form.tsx` | Contact form component |
| `packages/ui/src/components/textarea.tsx` | Shadcn Textarea component |
| `packages/ui/src/components/sonner.tsx` | Shadcn Sonner toast component |

### Modified files

| File | Change |
|------|--------|
| `packages/contracts/src/index.ts` | Export contact schema and types |
| `apps/server/src/trpc/context.ts` | Add `emailService` and `rateLimiter` to context |
| `apps/server/src/trpc/router.ts` | Add `contact` router to appRouter |
| `apps/server/tests/helpers.ts` | Add cleanup for rate limit keys, update context for new services |
| `apps/web/app/routes/gatherings.$id.tsx` | Add ContactForm below description |
| `packages/ui/src/components/index.ts` | Export Textarea and Sonner (if this index file exists) |
| `apps/web/package.json` | Add `sonner` dependency |
| `packages/ui/package.json` | Add `sonner` dependency (if Sonner component lives here) |

---

## Task 1: Contact validation schema

**Files:**
- Create: `packages/contracts/src/contact.ts`
- Modify: `packages/contracts/src/index.ts`

- [ ] **Step 1: Create the contact schema**

```typescript
// packages/contracts/src/contact.ts
import { z } from 'zod'

export const sendContactMessageSchema = z.object({
  gatheringId: z.string().uuid(),
  senderName: z.string().min(1).max(100).trim(),
  senderEmail: z.string().trim().toLowerCase().email(),
  message: z.string().min(1).max(2000).trim(),
})

export type SendContactMessageInput = z.infer<typeof sendContactMessageSchema>
```

- [ ] **Step 2: Export from contracts index**

Add to `packages/contracts/src/index.ts`:

```typescript
export {
  sendContactMessageSchema,
  type SendContactMessageInput,
} from './contact.js'
```

- [ ] **Step 3: Verify it compiles**

Run: `pnpm --filter @game-finder/contracts build`
Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/contracts/src/contact.ts packages/contracts/src/index.ts
git commit -m "feat(contracts): add contact message validation schema"
```

---

## Task 2: Email service

**Files:**
- Create: `apps/server/src/services/email.ts`
- Create: `apps/server/tests/email.test.ts`

- [ ] **Step 1: Create the email service interface and console implementation**

```typescript
// apps/server/src/services/email.ts
export interface ContactMessageParams {
  toEmail: string
  toName: string
  fromName: string
  fromEmail: string
  gatheringTitle: string
  gatheringId: string
  message: string
}

export interface EmailService {
  sendContactMessage(params: ContactMessageParams): Promise<void>
}

export class ConsoleEmailService implements EmailService {
  async sendContactMessage(params: ContactMessageParams): Promise<void> {
    console.log(`\n${'═'.repeat(40)}`)
    console.log(`  Contact Message`)
    console.log(`${'─'.repeat(40)}`)
    console.log(`  To:   ${params.toName} <${params.toEmail}>`)
    console.log(`  From: ${params.fromName} <${params.fromEmail}>`)
    console.log(`  Re:   ${params.gatheringTitle}`)
    console.log(`${'─'.repeat(40)}`)
    console.log(`  ${params.message}`)
    console.log(`${'═'.repeat(40)}\n`)
  }
}
```

- [ ] **Step 2: Write a smoke test for ConsoleEmailService**

```typescript
// apps/server/tests/email.test.ts
import { describe, expect, it, vi } from 'vitest'
import { ConsoleEmailService } from '../src/services/email.js'

describe('ConsoleEmailService', () => {
  it('logs the contact message to console', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const service = new ConsoleEmailService()

    await service.sendContactMessage({
      toEmail: 'host@example.com',
      toName: 'Host User',
      fromName: 'Jane Doe',
      fromEmail: 'jane@example.com',
      gatheringTitle: 'Board Game Night',
      gatheringId: '123',
      message: 'I would love to join!',
    })

    const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n')
    expect(output).toContain('host@example.com')
    expect(output).toContain('Jane Doe')
    expect(output).toContain('Board Game Night')
    expect(output).toContain('I would love to join!')

    consoleSpy.mockRestore()
  })
})
```

- [ ] **Step 3: Run the test**

Run: `pnpm --filter @game-finder/server test -- tests/email.test.ts`
Expected: PASS.

- [ ] **Step 4: Verify it compiles**

Run: `pnpm --filter @game-finder/server build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/services/email.ts apps/server/tests/email.test.ts
git commit -m "feat(server): add email service interface with console implementation and test"
```

---

## Task 3: Rate limiter

**Files:**
- Create: `apps/server/src/services/rate-limiter.ts`
- Create: `apps/server/tests/rate-limiter.test.ts`

- [ ] **Step 1: Write failing tests for the rate limiter**

```typescript
// apps/server/tests/rate-limiter.test.ts
import { afterAll, afterEach, describe, expect, it } from 'vitest'
import { redis } from '../src/redis.js'
import { RedisRateLimiter } from '../src/services/rate-limiter.js'

const rateLimiter = new RedisRateLimiter(redis)
const TEST_KEY = 'rate:test:127.0.0.1'

afterEach(async () => {
  await redis.del(TEST_KEY)
})

afterAll(() => {
  redis.disconnect()
})

describe('RedisRateLimiter', () => {
  it('allows requests under the limit', async () => {
    const result = await rateLimiter.check(TEST_KEY, 5, 3600)
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(4)
  })

  it('tracks multiple requests', async () => {
    await rateLimiter.check(TEST_KEY, 5, 3600)
    await rateLimiter.check(TEST_KEY, 5, 3600)
    const result = await rateLimiter.check(TEST_KEY, 5, 3600)
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(2)
  })

  it('blocks requests over the limit', async () => {
    for (let i = 0; i < 5; i++) {
      await rateLimiter.check(TEST_KEY, 5, 3600)
    }
    const result = await rateLimiter.check(TEST_KEY, 5, 3600)
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('resets after window expires', async () => {
    for (let i = 0; i < 5; i++) {
      await rateLimiter.check(TEST_KEY, 5, 1)
    }

    // Wait for window to expire
    await new Promise((resolve) => setTimeout(resolve, 1100))

    const result = await rateLimiter.check(TEST_KEY, 5, 1)
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(4)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @game-finder/server test -- tests/rate-limiter.test.ts`
Expected: FAIL — `RedisRateLimiter` not found.

- [ ] **Step 3: Implement the rate limiter**

```typescript
// apps/server/src/services/rate-limiter.ts
import type Redis from 'ioredis'

export interface RateLimitResult {
  allowed: boolean
  remaining: number
}

export interface RateLimiter {
  check(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult>
}

export class RedisRateLimiter implements RateLimiter {
  constructor(private redis: Redis) {}

  async check(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const count = await this.redis.incr(key)
    if (count === 1) {
      await this.redis.expire(key, windowSeconds)
    }

    const allowed = count <= limit
    const remaining = Math.max(0, limit - count)
    return { allowed, remaining }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @game-finder/server test -- tests/rate-limiter.test.ts`
Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/services/rate-limiter.ts apps/server/tests/rate-limiter.test.ts
git commit -m "feat(server): add Redis-based rate limiter with tests"
```

---

## Task 4: Wire services into tRPC context

**Files:**
- Modify: `apps/server/src/trpc/context.ts`

- [ ] **Step 1: Add emailService, rateLimiter, and clientIp to context**

Read `apps/server/src/trpc/context.ts` first. Then modify it to import and instantiate the services, and extract the client IP for rate limiting:

```typescript
// apps/server/src/trpc/context.ts
import { getSessionIdFromRequest } from '../auth/cookies.js'
import { getSession } from '../auth/session.js'
import { db } from '../db.js'
import { redis } from '../redis.js'
import { ConsoleEmailService, type EmailService } from '../services/email.js'
import { RedisRateLimiter, type RateLimiter } from '../services/rate-limiter.js'

const emailService: EmailService = new ConsoleEmailService()
const rateLimiter: RateLimiter = new RedisRateLimiter(redis)

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

  // Extract client IP for rate limiting (first IP from x-forwarded-for, or fallback)
  const forwarded = req.headers.get('x-forwarded-for')
  const clientIp = forwarded ? forwarded.split(',')[0].trim() : 'unknown'

  return { db, redis, userId, sessionId, resHeaders, emailService, rateLimiter, clientIp }
}

export type Context = Awaited<ReturnType<typeof createContext>>
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm --filter @game-finder/server build`
Expected: Build succeeds.

- [ ] **Step 3: Verify existing tests still pass**

Run: `pnpm --filter @game-finder/server test`
Expected: All existing tests pass (services are in context but unused by existing routers).

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/trpc/context.ts
git commit -m "feat(server): add emailService and rateLimiter to tRPC context"
```

---

## Task 5: Contact router

**Files:**
- Create: `apps/server/src/trpc/contact.ts`
- Modify: `apps/server/src/trpc/router.ts`

- [ ] **Step 1: Create the contact router**

```typescript
// apps/server/src/trpc/contact.ts
import { TRPCError } from '@trpc/server'
import { sendContactMessageSchema } from '@game-finder/contracts'
import { createRouter, publicProcedure } from './init.js'

export const contactRouter = createRouter({
  send: publicProcedure
    .input(sendContactMessageSchema)
    .mutation(async ({ input, ctx }) => {
      // Rate limit by client IP
      const rateKey = `rate:contact:${ctx.clientIp}`
      const rateResult = await ctx.rateLimiter.check(rateKey, 5, 3600)
      if (!rateResult.allowed) {
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: 'Too many messages. Please try again later.',
        })
      }

      // Look up gathering — must exist and be active
      const gathering = await ctx.db
        .selectFrom('gathering')
        .where('id', '=', input.gatheringId)
        .where('status', '=', 'active')
        .select(['id', 'title', 'host_id'])
        .executeTakeFirst()

      if (!gathering) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Gathering not found',
        })
      }

      // Look up host
      const host = await ctx.db
        .selectFrom('users')
        .where('id', '=', gathering.host_id)
        .select(['email', 'display_name'])
        .executeTakeFirstOrThrow()

      // Send email
      await ctx.emailService.sendContactMessage({
        toEmail: host.email,
        toName: host.display_name,
        fromName: input.senderName,
        fromEmail: input.senderEmail,
        gatheringTitle: gathering.title,
        gatheringId: gathering.id,
        message: input.message,
      })

      return { success: true as const }
    }),
})
```

- [ ] **Step 2: Add contact router to appRouter**

Read `apps/server/src/trpc/router.ts` first. Add the contact import and router. The file should look like (adapting to whatever routers exist after Epic 3 merge):

```typescript
// apps/server/src/trpc/router.ts
import { authRouter } from './auth.js'
import { contactRouter } from './contact.js'
// ... other imports from Epic 3 (gameRouter, gatheringRouter)
import { createRouter, publicProcedure } from './init.js'

export const appRouter = createRouter({
  health: createRouter({
    check: publicProcedure.query(() => {
      return { status: 'ok' as const }
    }),
  }),
  auth: authRouter,
  // game: gameRouter,        // from Epic 3
  // gathering: gatheringRouter, // from Epic 3
  contact: contactRouter,
})

export type AppRouter = typeof appRouter
```

- [ ] **Step 3: Verify it compiles**

Run: `pnpm --filter @game-finder/server build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/trpc/contact.ts apps/server/src/trpc/router.ts
git commit -m "feat(server): add contact router with send mutation"
```

---

## Task 6: Contact integration tests

**Files:**
- Create: `apps/server/tests/contact.test.ts`
- Modify: `apps/server/tests/helpers.ts`

- [ ] **Step 1: Update test helpers**

Read `apps/server/tests/helpers.ts` first. Add gathering creation helper and rate limit key cleanup.

Add to helpers:

```typescript
// Add to imports
import { sql } from 'kysely'

// Add gathering creation helper
export async function createTestGathering(
  hostId: string,
  overrides?: {
    title?: string
    status?: 'active' | 'closed'
  },
) {
  const title = overrides?.title ?? 'Test Gathering'
  const status = overrides?.status ?? 'active'

  return db
    .insertInto('gathering')
    .values({
      host_id: hostId,
      title,
      description: 'A test gathering',
      zip_code: '62704',
      schedule_type: 'weekly',
      starts_at: new Date('2026-04-01T18:00:00Z'),
      status,
      next_occurrence_at: status === 'active' ? new Date('2026-04-01T18:00:00Z') : null,
    })
    .returningAll()
    .executeTakeFirstOrThrow()
}

// Update cleanup to also clear gathering-related tables and rate limit keys
export async function cleanup() {
  // Delete in order respecting foreign keys
  await db.deleteFrom('gathering_game').execute().catch(() => {}) // may not exist yet
  await db.deleteFrom('gathering').execute().catch(() => {})      // may not exist yet
  await db.deleteFrom('users').execute()
  const sessionKeys = await redis.keys('session:*')
  if (sessionKeys.length > 0) await redis.del(...sessionKeys)
  const rateKeys = await redis.keys('rate:*')
  if (rateKeys.length > 0) await redis.del(...rateKeys)
}
```

**Note:** The `gathering` and `gathering_game` tables come from Epic 3. If they don't exist yet on the working branch, these tests will need Epic 3 merged first. Before implementing, verify the actual column names by reading the Epic 3 migration files in `packages/db/src/migrations/` — the columns in `createTestGathering` above are based on the Epic 3 spec and may need adjusting to match the actual schema.

- [ ] **Step 2: Write the contact integration tests**

```typescript
// apps/server/tests/contact.test.ts
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  createAuthenticatedCaller,
  createTestCaller,
  createTestUser,
  createTestGathering,
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

describe('contact.send', () => {
  it('sends a message to the host and returns success', async () => {
    const host = await createTestUser({ email: 'host@example.com', displayName: 'Host User' })
    const gathering = await createTestGathering(host.id, { title: 'Board Game Night' })
    const { caller } = await createTestCaller()

    const result = await caller.contact.send({
      gatheringId: gathering.id,
      senderName: 'Jane Doe',
      senderEmail: 'jane@example.com',
      message: 'I would love to join your game night!',
    })

    expect(result.success).toBe(true)
  })

  it('rejects when gathering does not exist', async () => {
    const { caller } = await createTestCaller()

    await expect(
      caller.contact.send({
        gatheringId: '00000000-0000-0000-0000-000000000000',
        senderName: 'Jane Doe',
        senderEmail: 'jane@example.com',
        message: 'Hello!',
      }),
    ).rejects.toThrow(
      expect.objectContaining({ code: 'NOT_FOUND' }),
    )
  })

  it('rejects when gathering is closed', async () => {
    const host = await createTestUser()
    const gathering = await createTestGathering(host.id, { status: 'closed' })
    const { caller } = await createTestCaller()

    await expect(
      caller.contact.send({
        gatheringId: gathering.id,
        senderName: 'Jane Doe',
        senderEmail: 'jane@example.com',
        message: 'Hello!',
      }),
    ).rejects.toThrow(
      expect.objectContaining({ code: 'NOT_FOUND' }),
    )
  })

  it('rejects invalid input', async () => {
    const { caller } = await createTestCaller()

    await expect(
      caller.contact.send({
        gatheringId: 'not-a-uuid',
        senderName: '',
        senderEmail: 'not-an-email',
        message: '',
      }),
    ).rejects.toThrow()
  })

  it('enforces rate limit after 5 messages', async () => {
    const host = await createTestUser()
    const gathering = await createTestGathering(host.id)
    const { caller } = await createTestCaller()

    const input = {
      gatheringId: gathering.id,
      senderName: 'Spammer',
      senderEmail: 'spam@example.com',
      message: 'Hello!',
    }

    // Send 5 messages (should all succeed)
    for (let i = 0; i < 5; i++) {
      await caller.contact.send(input)
    }

    // 6th should be rate limited
    await expect(caller.contact.send(input)).rejects.toThrow(
      expect.objectContaining({ code: 'TOO_MANY_REQUESTS' }),
    )
  })

  it('works for logged-in users', async () => {
    const host = await createTestUser({ email: 'host@example.com', displayName: 'Host' })
    const sender = await createTestUser({ email: 'sender@example.com', displayName: 'Sender' })
    const gathering = await createTestGathering(host.id)

    const { caller } = await createAuthenticatedCaller(sender.id)

    const result = await caller.contact.send({
      gatheringId: gathering.id,
      senderName: 'Sender Name',
      senderEmail: 'sender@example.com',
      message: 'Interested in joining!',
    })

    expect(result.success).toBe(true)
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm --filter @game-finder/server test -- tests/contact.test.ts`
Expected: Tests should fail if gathering table doesn't exist, or pass if Epic 3 is merged and the router is wired up. The key thing is that test structure is correct.

- [ ] **Step 4: Run all tests to make sure nothing is broken**

Run: `pnpm --filter @game-finder/server test`
Expected: All tests pass (contact tests + existing auth/health/session tests).

- [ ] **Step 5: Commit**

```bash
git add apps/server/tests/contact.test.ts apps/server/tests/helpers.ts
git commit -m "test(server): add contact.send integration tests"
```

---

## Task 7: Shadcn Textarea component

**Files:**
- Create: `packages/ui/src/components/textarea.tsx`

- [ ] **Step 1: Add the Textarea component**

Follow the same pattern as the existing `Input` component in `packages/ui/src/components/input.tsx`. Read that file first, then create the Textarea variant:

```typescript
// packages/ui/src/components/textarea.tsx
import * as React from 'react'
import { cn } from '../lib/utils.js'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex min-h-[80px] w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm --filter @game-finder/ui build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/components/textarea.tsx
git commit -m "feat(ui): add Textarea component"
```

---

## Task 8: Sonner toast setup

**Files:**
- Create: `packages/ui/src/components/sonner.tsx`
- Modify: `apps/web/app/root.tsx`

- [ ] **Step 1: Install sonner dependency**

Run: `pnpm --filter @game-finder/ui add sonner`

Also add it to the web app if needed for direct imports:
Run: `pnpm --filter @game-finder/web add sonner`

- [ ] **Step 2: Create the Sonner component wrapper**

Read `packages/ui/src/components/button.tsx` for the styling pattern, then create the Sonner wrapper:

```typescript
// packages/ui/src/components/sonner.tsx
import { Toaster as Sonner, type ToasterProps } from 'sonner'

function Toaster(props: ToasterProps) {
  return (
    <Sonner
      className="toaster group"
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          '--success-bg': 'var(--popover)',
          '--success-text': 'var(--popover-foreground)',
          '--success-border': 'var(--border)',
          '--error-bg': 'var(--popover)',
          '--error-text': 'var(--destructive)',
          '--error-border': 'var(--border)',
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
```

- [ ] **Step 3: Add Toaster to the app root**

Read `apps/web/app/root.tsx` first. Add the `Toaster` component inside the layout, after the `Outlet`:

```typescript
import { Toaster } from '@game-finder/ui/components/sonner'

// Inside the Layout component, after <Outlet />:
<Toaster />
```

- [ ] **Step 4: Verify it compiles and renders**

Run: `pnpm --filter @game-finder/web build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/sonner.tsx packages/ui/package.json apps/web/app/root.tsx apps/web/package.json pnpm-lock.yaml
git commit -m "feat(ui): add Sonner toast component and wire into app root"
```

---

## Task 9: Contact form component

**Files:**
- Create: `apps/web/app/components/contact-form.tsx`

- [ ] **Step 1: Create the contact form component**

Read the existing form pattern in `apps/web/app/routes/login.tsx` for conventions (state management, mutation, error handling). Then create:

```typescript
// apps/web/app/components/contact-form.tsx
import { Button } from '@game-finder/ui/components/button'
import { Input } from '@game-finder/ui/components/input'
import { Label } from '@game-finder/ui/components/label'
import { Textarea } from '@game-finder/ui/components/textarea'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { useTRPC } from '../trpc/provider.js'

interface ContactFormProps {
  gatheringId: string
  gatheringTitle: string
  user?: {
    displayName: string
    email: string
  } | null
}

export function ContactForm({ gatheringId, gatheringTitle, user }: ContactFormProps) {
  const trpc = useTRPC()
  const [name, setName] = useState(user?.displayName ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const sendMutation = useMutation(
    trpc.contact.send.mutationOptions({
      onSuccess: () => {
        toast.success('Message sent! The host will receive your email shortly.')
        setMessage('')
        if (!user) {
          setName('')
          setEmail('')
        }
        setErrors({})
      },
      onError: (error) => {
        if (error.data?.code === 'TOO_MANY_REQUESTS') {
          toast.error('Too many messages. Please try again later.')
        } else if (error.data?.code === 'NOT_FOUND') {
          toast.error('This gathering is no longer available.')
        } else {
          toast.error('Something went wrong. Please try again.')
        }
      },
    }),
  )

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})

    // Client-side validation
    const newErrors: Record<string, string> = {}
    if (!name.trim()) newErrors.name = 'Name is required'
    if (!email.trim()) newErrors.email = 'Email is required'
    if (!message.trim()) newErrors.message = 'Message is required'
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    sendMutation.mutate({
      gatheringId,
      senderName: name.trim(),
      senderEmail: email.trim(),
      message: message.trim(),
    })
  }

  return (
    <div className="mt-10 rounded-lg border border-border bg-card/60 p-6">
      <h2 className="font-display mb-1 text-lg font-semibold tracking-tight text-foreground">
        Interested? Send the host a message.
      </h2>
      <p className="mb-6 text-sm text-muted-foreground">
        Your message will be emailed to the host of {gatheringTitle}.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="contact-name">Name</Label>
            <Input
              id="contact-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className={errors.name ? 'border-destructive/30 bg-destructive/10' : ''}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-email">Email</Label>
            <Input
              id="contact-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className={errors.email ? 'border-destructive/30 bg-destructive/10' : ''}
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email}</p>
            )}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact-message">Message</Label>
          <Textarea
            id="contact-message"
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Tell the host about yourself and why you'd like to join..."
            className={errors.message ? 'border-destructive/30 bg-destructive/10' : ''}
          />
          {errors.message && (
            <p className="text-xs text-destructive">{errors.message}</p>
          )}
        </div>
        <Button type="submit" disabled={sendMutation.isPending}>
          {sendMutation.isPending ? 'Sending...' : 'Send Message'}
        </Button>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm --filter @game-finder/web build`
Expected: Build succeeds (component is created but not yet used in a route).

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/components/contact-form.tsx
git commit -m "feat(web): add contact form component"
```

---

## Task 10: Add contact form to gathering details page

**Files:**
- Modify: `apps/web/app/routes/gatherings.$id.tsx`

- [ ] **Step 1: Read the current gathering details page**

Read `apps/web/app/routes/gatherings.$id.tsx` to understand the current structure and where to add the contact form.

- [ ] **Step 2: Add the ContactForm below the description**

Import the component and add it after the Markdown body section. Only show it when the current user is NOT the host:

```typescript
import { ContactForm } from '../components/contact-form.js'

// Inside the component, after the Markdown body section and before the closing div:
// Only render if the current user is not the host
{(!user || user.id !== gathering.host.id) && (
  <ContactForm
    gatheringId={gathering.id}
    gatheringTitle={gathering.title}
    user={user}
  />
)}
```

The `user` variable should come from the existing `trpc.auth.me` query that's likely already in the page (used to show edit/close buttons for the owner). If not, add it:

```typescript
const { data: user } = useQuery(trpc.auth.me.queryOptions())
```

- [ ] **Step 3: Verify it compiles**

Run: `pnpm --filter @game-finder/web build`
Expected: Build succeeds.

- [ ] **Step 4: Manual smoke test**

Start the app with `docker compose up` (or the dev setup). Navigate to a gathering details page.

Verify:
- Contact form appears below the description
- Form fields are visible (name, email, message)
- If logged in, name and email are pre-filled
- If you are the host, the form is NOT shown
- Submitting with valid data shows a toast and resets the form
- Console shows the formatted email log on the server

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/routes/gatherings.$id.tsx
git commit -m "feat(web): add contact form to gathering details page"
```

---

## Task 11: Final verification

- [ ] **Step 1: Run all server tests**

Run: `pnpm --filter @game-finder/server test`
Expected: All tests pass (auth, health, session, contact, rate-limiter).

- [ ] **Step 2: Run full build**

Run: `pnpm build`
Expected: All packages and apps build successfully.

- [ ] **Step 3: Run type checks**

Run: `pnpm --filter @game-finder/server tsc --noEmit && pnpm --filter @game-finder/web tsc --noEmit`
Expected: No type errors.

- [ ] **Step 4: End-to-end smoke test**

Start the full stack via `docker compose up`. Walk through the exit criteria:

1. Navigate to a gathering details page
2. See the contact form below the description
3. Fill in name, email, message and submit
4. See toast: "Message sent! The host will receive your email shortly."
5. Check server console for the formatted email log
6. Form resets after success
7. Submit 6 messages rapidly — 6th should show rate limit toast
8. As the host, the contact form should not be visible
9. As an anonymous user, the form shows with empty fields
10. As a logged-in user, name and email are pre-filled

- [ ] **Step 5: Commit any final adjustments**

If any tweaks were needed during verification, commit them:

```bash
git add -A
git commit -m "fix(server): final adjustments from smoke testing"
```
