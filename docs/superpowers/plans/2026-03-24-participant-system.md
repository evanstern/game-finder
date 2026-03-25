# Participant System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add join/leave/waitlist participant tracking for gatherings, with public/private visibility and shareable invite codes.

**Architecture:** New `gathering_participant` table with join/leave/waitlist logic on the server, exposed via tRPC procedures. The gathering table gets `visibility` and `join_code` columns. UI changes on the detail page, dashboard, and gathering form. Row-level locking prevents race conditions on join/leave. `max_players` represents joinable slots excluding the host.

**Tech Stack:** TypeScript, Kysely (PostgreSQL), tRPC, Zod, React Router 7 (SSR via Hono), Tailwind, Shadcn UI

**Spec:** `docs/superpowers/specs/2026-03-24-participant-system-design.md`

---

## File Map

**Created:**
- `packages/db/src/migrations/006-create-gathering-participant.ts` — migration for new table + gathering columns
- `packages/contracts/src/participant.ts` — Zod schemas for participant-specific features (input/output schemas, `joinedGatheringSchema`)
- `apps/server/src/gathering/join-code.ts` — join code generation utility

**Modified:**
- `packages/db/src/types.ts` — add `GatheringParticipantTable`, update `GatheringTable`, update `Database`
- `packages/db/src/serializers.ts` — add `serializeParticipant` function
- `packages/db/src/index.ts` — export new types
- `packages/contracts/src/gathering.ts` — add `gatheringVisibilitySchema`, `participantStatusSchema` enums; add `visibility` to input/output schemas; create `gatheringDetailSchema` extending base with `participantCount`/`currentUserStatus`
- `packages/contracts/src/index.ts` — export participant contracts
- `packages/contracts/package.json` — add `"./participant"` exports entry
- `apps/server/src/trpc/gathering.ts` — add `join`, `leave`, `listParticipants`, `listJoined` procedures; modify `create`, `update`, `getById`, `search`
- `apps/web/app/routes/gatherings.$id.tsx` — participant list, join/leave buttons, invite link
- `apps/web/app/routes/dashboard.tsx` — "My Games" section
- `apps/web/app/components/gathering-form.tsx` — visibility toggle

---

## Task 1: Database Migration

**Files:**
- Create: `packages/db/src/migrations/006-create-gathering-participant.ts`

- [ ] **Step 1: Write the migration file**

```typescript
import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`CREATE TYPE gathering_visibility AS ENUM ('public', 'private')`.execute(db)
  await sql`CREATE TYPE participant_status AS ENUM ('joined', 'waitlisted')`.execute(db)

  await db.schema
    .createTable('gathering_participant')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn('gathering_id', 'uuid', (col) =>
      col.notNull().references('gathering.id').onDelete('cascade'),
    )
    .addColumn('user_id', 'uuid', (col) =>
      col.notNull().references('users.id'),
    )
    .addColumn('status', sql`participant_status`, (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute()

  await db.schema
    .createIndex('idx_gathering_participant_gathering_id')
    .on('gathering_participant')
    .column('gathering_id')
    .execute()

  await db.schema
    .createIndex('idx_gathering_participant_user_id')
    .on('gathering_participant')
    .column('user_id')
    .execute()

  await db.schema
    .createIndex('uq_gathering_participant')
    .on('gathering_participant')
    .columns(['gathering_id', 'user_id'])
    .unique()
    .execute()

  await db.schema
    .alterTable('gathering')
    .addColumn('visibility', sql`gathering_visibility`, (col) =>
      col.notNull().defaultTo('public'),
    )
    .execute()

  await db.schema
    .alterTable('gathering')
    .addColumn('join_code', 'varchar(8)')
    .execute()

  await db.schema
    .createIndex('uq_gathering_join_code')
    .on('gathering')
    .column('join_code')
    .unique()
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('gathering').dropColumn('join_code').execute()
  await db.schema.alterTable('gathering').dropColumn('visibility').execute()
  await db.schema.dropTable('gathering_participant').execute()
  await sql`DROP TYPE participant_status`.execute(db)
  await sql`DROP TYPE gathering_visibility`.execute(db)
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/db/src/migrations/006-create-gathering-participant.ts
git commit -m "feat(db): add gathering_participant table and visibility columns"
```

---

## Task 2: Database Types & Serializers

**Files:**
- Modify: `packages/db/src/types.ts`
- Modify: `packages/db/src/serializers.ts`
- Modify: `packages/db/src/index.ts`

- [ ] **Step 1: Add `GatheringParticipantTable` to types.ts**

Add the new interface and update `GatheringTable` and `Database`:

```typescript
// Add to GatheringTable interface:
  visibility: Generated<'public' | 'private'>
  join_code: string | null

// Add new interface:
export interface GatheringParticipantTable {
  id: Generated<string>
  gathering_id: string
  user_id: string
  status: 'joined' | 'waitlisted'
  created_at: Generated<Date>
}

// Add to Database interface:
  gathering_participant: GatheringParticipantTable
```

- [ ] **Step 2: Update serializers.ts**

Add `visibility` and `joinCode` to `serializeGathering`. Add a new `serializeParticipant` function:

```typescript
// In serializeGathering, add after the existing fields:
    visibility: row.visibility,
    joinCode: row.join_code,

// New function:
export function serializeParticipant(
  row: Selectable<GatheringParticipantTable> & { display_name: string },
) {
  return {
    id: row.id,
    gatheringId: row.gathering_id,
    userId: row.user_id,
    displayName: row.display_name,
    status: row.status,
    createdAt: row.created_at,
  }
}
```

Import `GatheringParticipantTable` in the serializers import.

- [ ] **Step 3: Update index.ts exports**

Add `GatheringParticipantTable` to the type exports.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/types.ts packages/db/src/serializers.ts packages/db/src/index.ts
git commit -m "feat(db): add participant types and serializer"
```

---

## Task 3: Contracts

**Files:**
- Create: `packages/contracts/src/participant.ts`
- Modify: `packages/contracts/src/gathering.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `packages/contracts/package.json`

**Note on dependency direction:** The enum schemas (`gatheringVisibilitySchema`, `participantStatusSchema`) live in `gathering.ts` to avoid a circular import. `participant.ts` imports from `gathering.ts` (one-way dependency).

- [ ] **Step 1: Update gathering contracts with new enums and schemas**

In `packages/contracts/src/gathering.ts`, add the new enum schemas and update the existing schemas:

```typescript
// Add after the existing enum schemas at the top of the file:
export const gatheringVisibilitySchema = z.enum(['public', 'private'])
export const participantStatusSchema = z.enum(['joined', 'waitlisted'])
```

Add `visibility` to `createGatheringSchema`:
```typescript
  visibility: gatheringVisibilitySchema.default('public'),
```

Add `visibility` to `updateGatheringSchema`:
```typescript
  visibility: gatheringVisibilitySchema.optional(),
```

Add `visibility` and `joinCode` to `gatheringSchema` (but NOT `participantCount`/`currentUserStatus` — those go in a detail-only schema):
```typescript
  visibility: gatheringVisibilitySchema,
  joinCode: z.string().nullable(),
```

Add a new `gatheringDetailSchema` that extends the base with fields only returned by `getById`:
```typescript
export const gatheringDetailSchema = gatheringSchema.extend({
  participantCount: z.number(),
  currentUserStatus: participantStatusSchema.nullable(),
})

export type GatheringDetailOutput = z.infer<typeof gatheringDetailSchema>
```

Add type exports:
```typescript
export type GatheringVisibility = z.infer<typeof gatheringVisibilitySchema>
export type ParticipantStatus = z.infer<typeof participantStatusSchema>
```

- [ ] **Step 2: Create participant contracts**

```typescript
import { z } from 'zod'
import { gatheringSchema, participantStatusSchema } from './gathering.js'

export const joinGatheringSchema = z.object({
  gatheringId: z.string().uuid(),
  joinCode: z.string().optional(),
})

export const leaveGatheringSchema = z.object({
  gatheringId: z.string().uuid(),
})

export const listParticipantsSchema = z.object({
  gatheringId: z.string().uuid(),
})

export const participantSchema = z.object({
  id: z.string().uuid(),
  gatheringId: z.string().uuid(),
  userId: z.string().uuid(),
  displayName: z.string(),
  status: participantStatusSchema,
  createdAt: z.coerce.date(),
})

export const joinedGatheringSchema = gatheringSchema.extend({
  participantStatus: participantStatusSchema,
})

export type JoinGatheringInput = z.infer<typeof joinGatheringSchema>
export type LeaveGatheringInput = z.infer<typeof leaveGatheringSchema>
export type ParticipantOutput = z.infer<typeof participantSchema>
export type JoinedGatheringOutput = z.infer<typeof joinedGatheringSchema>
```

- [ ] **Step 3: Update contracts index**

Add to `packages/contracts/src/index.ts`:
```typescript
export * from './participant.js'
```

- [ ] **Step 4: Add exports entry to package.json**

In `packages/contracts/package.json`, add to the `exports` object:
```json
    "./participant": "./src/participant.ts"
```

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/src/participant.ts packages/contracts/src/gathering.ts packages/contracts/src/index.ts packages/contracts/package.json
git commit -m "feat(contracts): add participant schemas and update gathering schemas"
```

---

## Task 4: Join Code Utility

**Files:**
- Create: `apps/server/src/gathering/join-code.ts`

- [ ] **Step 1: Write the join code generator**

```typescript
import { randomBytes } from 'node:crypto'

export function generateJoinCode(): string {
  return randomBytes(4).toString('hex').toUpperCase()
}
```

This produces 8 hex characters (e.g., `A3F1B2C9`). Unique index on DB handles collisions.

- [ ] **Step 2: Commit**

```bash
git add apps/server/src/gathering/join-code.ts
git commit -m "feat(server): add join code generation utility"
```

---

## Task 5: Server — Join Procedure

**Files:**
- Modify: `apps/server/src/trpc/gathering.ts`

- [ ] **Step 1: Add the `join` procedure**

Add imports at top of `gathering.ts`:
```typescript
import {
  joinGatheringSchema,
  leaveGatheringSchema,
  listParticipantsSchema,
} from '@game-finder/contracts/participant'
import { serializeParticipant } from '@game-finder/db/serializers'
```

Note: All three input schemas are imported here from `@game-finder/contracts/participant` (subpath export added in Task 3 Step 4). The enum schemas (`gatheringVisibilitySchema`, `participantStatusSchema`) live in `@game-finder/contracts/gathering` if needed for type references.

Add to the `gatheringRouter` object:

```typescript
  join: protectedProcedure
    .input(joinGatheringSchema)
    .mutation(async ({ input, ctx }) => {
      const gathering = await ctx.db
        .selectFrom('gathering')
        .selectAll()
        .where('id', '=', input.gatheringId)
        .forUpdate()
        .executeTakeFirst()

      if (!gathering) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Gathering not found' })
      }

      if (gathering.status !== 'active') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Gathering is not active' })
      }

      if (gathering.host_id === ctx.userId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Host cannot join their own gathering' })
      }

      if (gathering.visibility === 'private') {
        if (!input.joinCode || input.joinCode !== gathering.join_code) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Invalid join code' })
        }
      }

      const existing = await ctx.db
        .selectFrom('gathering_participant')
        .select('id')
        .where('gathering_id', '=', input.gatheringId)
        .where('user_id', '=', ctx.userId)
        .executeTakeFirst()

      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Already a participant' })
      }

      let status: 'joined' | 'waitlisted' = 'joined'
      if (gathering.max_players !== null) {
        const countResult = await ctx.db
          .selectFrom('gathering_participant')
          .select(sql<number>`count(*)`.as('count'))
          .where('gathering_id', '=', input.gatheringId)
          .where('status', '=', 'joined')
          .executeTakeFirstOrThrow()

        if (Number(countResult.count) >= gathering.max_players) {
          status = 'waitlisted'
        }
      }

      const participant = await ctx.db
        .insertInto('gathering_participant')
        .values({
          gathering_id: input.gatheringId,
          user_id: ctx.userId,
          status,
        })
        .returningAll()
        .executeTakeFirstOrThrow()

      const user = await ctx.db
        .selectFrom('users')
        .select('display_name')
        .where('id', '=', ctx.userId)
        .executeTakeFirstOrThrow()

      return serializeParticipant({ ...participant, display_name: user.display_name })
    }),
```

- [ ] **Step 2: Commit**

```bash
git add apps/server/src/trpc/gathering.ts
git commit -m "feat(server): add join gathering procedure with waitlist logic"
```

---

## Task 6: Server — Leave Procedure with Auto-Promote

**Files:**
- Modify: `apps/server/src/trpc/gathering.ts`

- [ ] **Step 1: Add the `leave` procedure**

(Imports already added in Task 5.) Add to `gatheringRouter`:

```typescript
  leave: protectedProcedure
    .input(leaveGatheringSchema)
    .mutation(async ({ input, ctx }) => {
      const gathering = await ctx.db
        .selectFrom('gathering')
        .select(['id', 'host_id', 'max_players'])
        .where('id', '=', input.gatheringId)
        .forUpdate()
        .executeTakeFirst()

      if (!gathering) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Gathering not found' })
      }

      if (gathering.host_id === ctx.userId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Host cannot leave — close the gathering instead' })
      }

      const participant = await ctx.db
        .selectFrom('gathering_participant')
        .select(['id', 'status'])
        .where('gathering_id', '=', input.gatheringId)
        .where('user_id', '=', ctx.userId)
        .executeTakeFirst()

      if (!participant) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Not a participant' })
      }

      await ctx.db
        .deleteFrom('gathering_participant')
        .where('id', '=', participant.id)
        .execute()

      if (participant.status === 'joined' && gathering.max_players !== null) {
        const nextWaitlisted = await ctx.db
          .selectFrom('gathering_participant')
          .select('id')
          .where('gathering_id', '=', input.gatheringId)
          .where('status', '=', 'waitlisted')
          .orderBy('created_at', 'asc')
          .limit(1)
          .executeTakeFirst()

        if (nextWaitlisted) {
          await ctx.db
            .updateTable('gathering_participant')
            .set({ status: 'joined' })
            .where('id', '=', nextWaitlisted.id)
            .execute()
        }
      }

      return { success: true }
    }),
```

- [ ] **Step 2: Commit**

```bash
git add apps/server/src/trpc/gathering.ts
git commit -m "feat(server): add leave gathering procedure with auto-promote"
```

---

## Task 7: Server — listParticipants and listJoined Procedures

**Files:**
- Modify: `apps/server/src/trpc/gathering.ts`

- [ ] **Step 1: Add `listParticipants` procedure**

(Imports already added in Task 5.) Add to `gatheringRouter`:

```typescript
  listParticipants: publicProcedure
    .input(listParticipantsSchema)
    .query(async ({ input, ctx }) => {
      const rows = await ctx.db
        .selectFrom('gathering_participant')
        .innerJoin('users', 'users.id', 'gathering_participant.user_id')
        .selectAll('gathering_participant')
        .select('users.display_name')
        .where('gathering_participant.gathering_id', '=', input.gatheringId)
        .orderBy('gathering_participant.created_at', 'asc')
        .execute()

      return rows.map(serializeParticipant)
    }),
```

- [ ] **Step 2: Add `listJoined` procedure**

Add to `gatheringRouter`:

```typescript
  listJoined: protectedProcedure
    .query(async ({ ctx }) => {
      const rows = await ctx.db
        .selectFrom('gathering_participant')
        .innerJoin('gathering', 'gathering.id', 'gathering_participant.gathering_id')
        .selectAll('gathering')
        .select('gathering_participant.status as participant_status')
        .where('gathering_participant.user_id', '=', ctx.userId)
        .where('gathering.status', '=', 'active')
        .orderBy('gathering.next_occurrence_at', 'asc')
        .execute()

      return rows.map((row) => ({
        ...serializeGathering(row),
        participantStatus: row.participant_status,
      }))
    }),
```

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/trpc/gathering.ts
git commit -m "feat(server): add listParticipants and listJoined procedures"
```

---

## Task 8: Server — Modify Existing Procedures

**Files:**
- Modify: `apps/server/src/trpc/gathering.ts`

- [ ] **Step 1: Update `create` procedure**

Add import:
```typescript
import { generateJoinCode } from '../gathering/join-code.js'
```

In the `create` mutation, after building the `values` object, add visibility and join_code:

```typescript
      // In the insertInto('gathering').values({...}) call, add:
          visibility: input.visibility ?? 'public',
          join_code: (input.visibility ?? 'public') === 'private' ? generateJoinCode() : null,
```

- [ ] **Step 2: Update `update` procedure**

In the `update` mutation, add handling for visibility changes after the existing field updates:

```typescript
      if (fields.visibility !== undefined) {
        query = query.set({ visibility: fields.visibility })
        if (fields.visibility === 'private' && !existing.join_code) {
          query = query.set({ join_code: generateJoinCode() })
        } else if (fields.visibility === 'public') {
          query = query.set({ join_code: null })
        }
      }
```

Note: This requires `existing` to have `join_code` — the existing `selectAll()` already fetches it since we added the column.

- [ ] **Step 3: Update `getById` procedure**

After the existing query and before the return, add participant count and current user status:

```typescript
      const countResult = await ctx.db
        .selectFrom('gathering_participant')
        .select(sql<number>`count(*)`.as('count'))
        .where('gathering_id', '=', row.id)
        .where('status', '=', 'joined')
        .executeTakeFirstOrThrow()

      let currentUserStatus: 'joined' | 'waitlisted' | null = null
      if (ctx.userId) {
        const participant = await ctx.db
          .selectFrom('gathering_participant')
          .select('status')
          .where('gathering_id', '=', row.id)
          .where('user_id', '=', ctx.userId)
          .executeTakeFirst()
        currentUserStatus = participant?.status ?? null
      }

      return {
        ...serializeGathering(row),
        host: { displayName: row.host_display_name },
        games,
        participantCount: Number(countResult.count),
        currentUserStatus,
        joinCode: ctx.userId === row.host_id ? row.join_code : null,
      }
```

Note: `serializeGathering` now includes `visibility` and `joinCode` from the row, but we override `joinCode` here to control visibility based on whether the user is the host.

- [ ] **Step 4: Update `search` procedure**

Add a visibility filter to the base query:

```typescript
      // After the existing .where('gathering.status', '=', 'active') line, add:
        .where('gathering.visibility', '=', 'public')
```

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/trpc/gathering.ts
git commit -m "feat(server): update create/update/getById/search for participant system"
```

---

## Task 9: Web — Gathering Detail Page (Join/Leave + Participants)

**Files:**
- Modify: `apps/web/app/routes/gatherings.$id.tsx`

- [ ] **Step 1: Update loader to fetch participants**

Update the `Promise.all` in the loader to also fetch participants:

```typescript
  const [user, gathering, participants] = await Promise.all([
    trpc.auth.me.query().catch(() => null),
    trpc.gathering.getById.query({ id: params.id }).catch(() => null),
    trpc.gathering.listParticipants.query({ gatheringId: params.id }).catch(() => []),
  ])
```

Return `participants` in the loader data. Also extract `code` from the URL search params:

```typescript
  const url = new URL(request.url)
  const joinCode = url.searchParams.get('code') ?? undefined

  // ... (existing logic)

  return { gathering, user, participants, joinCode }
```

Add `request` to the loader destructuring: `{ request, params, context }`.

- [ ] **Step 2: Update action to handle join/leave intents**

Add `join` and `leave` intents to the action:

```typescript
  if (intent === 'close') {
    await trpc.gathering.close.mutate({ id: params.id })
  } else if (intent === 'join') {
    const joinCode = String(formData.get('joinCode') ?? '')
    await trpc.gathering.join.mutate({
      gatheringId: params.id,
      joinCode: joinCode || undefined,
    })
  } else if (intent === 'leave') {
    await trpc.gathering.leave.mutate({ gatheringId: params.id })
  }
```

- [ ] **Step 3: Add participant list and join/leave UI to the component**

After the games section and before the description section, add:

```tsx
      {/* Participants Section */}
      <div className="animate-fade-in-up animation-delay-200 space-y-3">
        <div className="flex items-center gap-3">
          <p className="font-semibold text-[11px] tracking-[0.15em] text-primary uppercase">Players</p>
          <span className="text-sm text-muted-foreground">
            {gathering.participantCount}{gathering.maxPlayers ? `/${gathering.maxPlayers}` : ''} joined
          </span>
        </div>

        {participants.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {participants.map((p) => (
              <Badge
                key={p.id}
                variant={p.status === 'joined' ? 'outline' : 'secondary'}
                className={p.status === 'joined' ? 'border-primary/30 text-primary' : ''}
              >
                {p.displayName}
                {p.status === 'waitlisted' && ' (waitlisted)'}
              </Badge>
            ))}
          </div>
        )}

        {/* Join/Leave Button */}
        {user && !isOwner && gathering.status === 'active' && (
          <div>
            {gathering.currentUserStatus === null ? (
              <JoinForm
                gatheringId={gathering.id}
                visibility={gathering.visibility}
                joinCode={joinCode}
              />
            ) : (
              <div className="flex items-center gap-3">
                {gathering.currentUserStatus === 'waitlisted' && (
                  <span className="text-sm text-muted-foreground">
                    You&apos;re #{participants.filter((p) => p.status === 'waitlisted').findIndex((p) => p.userId === user.id) + 1} on the waitlist
                  </span>
                )}
                <Form method="post">
                  <input type="hidden" name="intent" value="leave" />
                  <Button type="submit" variant="outline" size="sm">
                    {gathering.currentUserStatus === 'waitlisted' ? 'Leave Waitlist' : 'Leave Game'}
                  </Button>
                </Form>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Invite Link (host only, private gatherings) */}
      {isOwner && gathering.visibility === 'private' && gathering.joinCode && (
        <div className="animate-fade-in-up animation-delay-200 rounded-lg border border-border bg-card/60 p-4 backdrop-blur-sm space-y-2">
          <p className="font-semibold text-[11px] tracking-[0.15em] text-primary uppercase">Invite Link</p>
          <div className="flex items-center gap-2">
            <Input
              readOnly
              value={`${typeof window !== 'undefined' ? window.location.origin : ''}/gatherings/${gathering.id}?code=${gathering.joinCode}`}
              className="text-xs"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(
                  `${window.location.origin}/gatherings/${gathering.id}?code=${gathering.joinCode}`,
                )
              }}
            >
              Copy
            </Button>
          </div>
        </div>
      )}
```

Add a `JoinForm` helper component inside the file (before the default export). This handles both public (one-click join) and private (needs code input) gatherings:

```tsx
function JoinForm({
  gatheringId,
  visibility,
  joinCode,
}: {
  gatheringId: string
  visibility: string
  joinCode?: string
}) {
  const [code, setCode] = useState(joinCode ?? '')
  const needsCode = visibility === 'private' && !joinCode

  return (
    <Form method="post" className="flex items-center gap-2">
      <input type="hidden" name="intent" value="join" />
      {visibility === 'private' && (
        needsCode ? (
          <Input
            name="joinCode"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter join code"
            className="w-40 text-sm"
            required
          />
        ) : (
          <input type="hidden" name="joinCode" value={joinCode} />
        )
      )}
      <Button type="submit" size="sm">Join Game</Button>
    </Form>
  )
}
```

Add necessary imports at the top:
```typescript
import { Input } from '@game-finder/ui/components/input'
import { useState } from 'react'
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/routes/gatherings.$id.tsx
git commit -m "feat(web): add participant list, join/leave buttons, and invite link to detail page"
```

---

## Task 10: Web — Dashboard "My Games" Section

**Files:**
- Modify: `apps/web/app/routes/dashboard.tsx`

- [ ] **Step 1: Update loader to fetch joined gatherings**

```typescript
  const [user, gatherings, joinedGatherings] = await Promise.all([
    trpc.auth.me.query().catch(() => null),
    trpc.gathering.listByHost.query(),
    trpc.gathering.listJoined.query(),
  ])

  // ... (existing auth check)

  return { user, gatherings, joinedGatherings }
```

Wrap in a check: if `user` is null, redirect before calling listByHost/listJoined. Restructure as:

```typescript
export async function loader({ context }: Route.LoaderArgs) {
  const ctx = context as { cookie?: string }
  const trpc = createServerTRPC(ctx.cookie ?? '')

  const user = await trpc.auth.me.query().catch(() => null)
  if (!user) throw redirect('/login?returnTo=/dashboard')

  const [gatherings, joinedGatherings] = await Promise.all([
    trpc.gathering.listByHost.query(),
    trpc.gathering.listJoined.query(),
  ])

  return { user, gatherings, joinedGatherings }
}
```

- [ ] **Step 2: Add "My Games" section to the component**

After the existing gatherings list, before the closing `</div>`, add:

```tsx
      {/* My Games Section */}
      <div className="animate-fade-in-up animation-delay-200 space-y-4 mt-10">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold tracking-[0.2em] text-primary uppercase">
            Adventure log
          </p>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Games You&apos;ve Joined
          </h2>
        </div>

        {joinedGatherings.length === 0 ? (
          <div className="rounded-lg border border-border bg-card/60 p-10 text-center backdrop-blur-sm">
            <p className="text-sm text-muted-foreground">You haven&apos;t joined any gatherings yet.</p>
            <Button className="mt-4" asChild>
              <Link to="/search">Find games to join</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {joinedGatherings.map((gathering) => (
              <div
                key={gathering.id}
                className="rounded-lg border border-border bg-card/60 p-5 backdrop-blur-sm transition-all duration-200 hover:border-primary/20"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/gatherings/${gathering.id}`}
                      className="text-base font-semibold tracking-tight text-foreground transition-colors hover:text-primary"
                    >
                      {gathering.title}
                    </Link>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <span>
                        {gathering.nextOccurrenceAt
                          ? new Date(gathering.nextOccurrenceAt).toLocaleDateString([], { dateStyle: 'medium' })
                          : 'No upcoming session'}
                      </span>
                      <Badge
                        variant={gathering.participantStatus === 'joined' ? 'default' : 'secondary'}
                        className="text-[10px]"
                      >
                        {gathering.participantStatus === 'joined' ? 'Joined' : 'Waitlisted'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/routes/dashboard.tsx
git commit -m "feat(web): add 'My Games' section to dashboard"
```

---

## Task 11: Web — Gathering Form Visibility Toggle

**Files:**
- Modify: `apps/web/app/components/gathering-form.tsx`
- Modify: `apps/web/app/routes/gatherings.new.tsx`
- Modify: `apps/web/app/routes/gatherings.$id.edit.tsx`

- [ ] **Step 1: Add visibility to GatheringFormData and form UI**

In `gathering-form.tsx`, add `visibility` to `GatheringFormData`:
```typescript
  visibility: 'public' | 'private'
```

Add state:
```typescript
  const [visibility, setVisibility] = useState(initialData?.visibility ?? 'public')
```

Add import for RadioGroup:
```typescript
import {
  RadioGroup,
  RadioGroupItem,
} from '@game-finder/ui/components/radio-group'
```

Add the visibility toggle to the form, in the row with zip code and schedule (the `grid grid-cols-3` div). Replace the grid with a `grid-cols-4` and add:

```tsx
            <div className="space-y-1.5">
              <Label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Visibility</Label>
              <input type="hidden" name="visibility" value={visibility} />
              <RadioGroup value={visibility} onValueChange={(v) => setVisibility(v as 'public' | 'private')} className="flex gap-3 pt-1">
                <div className="flex items-center space-x-1.5">
                  <RadioGroupItem value="public" id="visibility-public" />
                  <Label htmlFor="visibility-public" className="text-sm font-normal cursor-pointer">Public</Label>
                </div>
                <div className="flex items-center space-x-1.5">
                  <RadioGroupItem value="private" id="visibility-private" />
                  <Label htmlFor="visibility-private" className="text-sm font-normal cursor-pointer">Private</Label>
                </div>
              </RadioGroup>
            </div>
```

- [ ] **Step 2: Update new gathering action to pass visibility**

In `gatherings.new.tsx` action, add to the mutate call:
```typescript
      visibility: String(formData.get('visibility') ?? 'public'),
```

- [ ] **Step 3: Update edit gathering route**

In `gatherings.$id.edit.tsx`:
- Add `visibility` to the `initialData` passed to `GatheringForm`
- Add `visibility` to the update mutate call in the action

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/components/gathering-form.tsx apps/web/app/routes/gatherings.new.tsx apps/web/app/routes/gatherings.$id.edit.tsx
git commit -m "feat(web): add visibility toggle to gathering form"
```

---

## Task 12: Run Migration & Manual Smoke Test

- [ ] **Step 1: Run the database migration**

```bash
cd packages/db && pnpm kysely migrate:latest
```

Verify the migration applies cleanly.

- [ ] **Step 2: Build all packages**

```bash
pnpm build
```

Verify no TypeScript errors.

- [ ] **Step 3: Start the dev servers and manually verify**

```bash
pnpm dev
```

Test:
1. Create a public gathering — verify `visibility: 'public'` in response
2. Create a private gathering — verify `join_code` is generated
3. Join a public gathering as a different user
4. Verify participant list shows on detail page
5. Leave the gathering
6. Visit the dashboard — verify "My Games" section
7. Search — verify private gatherings are hidden

- [ ] **Step 4: Commit any fixes discovered during smoke testing**

```bash
git add -A
git commit -m "fix(server): address issues found during smoke testing"
```

(Only if fixes were needed.)
