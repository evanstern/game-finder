# Friendship System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add mutual friendships gated by shared gathering participation, with friend request management, friend list, and a friend activity feed for social discovery of gatherings.

**Architecture:** New `friendship` table with a tRPC friendship router for CRUD operations. A `friendActivity` procedure on the gathering router provides social discovery. Web UI adds a `/friends` page, `/friends/activity` page, friend request badges in the nav, add-friend buttons on gathering detail pages, and a friend activity preview on the dashboard. The shared-gathering gate ensures users can only friend people they've actually gamed with.

**Tech Stack:** TypeScript, Kysely (PostgreSQL), tRPC, Zod, React Router 7 (SSR via Hono), Tailwind, Shadcn UI

**Spec:** `docs/superpowers/specs/2026-03-24-friendship-system-design.md`

**Depends on:** Participant System (must be merged/present on the working branch)

---

## File Map

**Created:**
- `packages/db/src/migrations/007-create-friendship.ts` — migration for friendship table
- `packages/contracts/src/friendship.ts` — Zod schemas for friendship features
- `apps/server/src/trpc/friendship.ts` — friendship tRPC router (sendRequest, accept, decline, remove, listFriends, listIncoming, listOutgoing)
- `apps/web/app/routes/friends.tsx` — /friends page (requests + friend list)
- `apps/web/app/routes/friends.activity.tsx` — /friends/activity page (friend activity feed)

**Modified:**
- `packages/db/src/types.ts` — add `FriendshipTable`, update `Database`
- `packages/db/src/serializers.ts` — add `serializeFriendship` function
- `packages/db/src/index.ts` — export new type
- `packages/contracts/src/index.ts` — export friendship contracts
- `packages/contracts/package.json` — add `"./friendship"` exports entry
- `apps/server/src/trpc/router.ts` — add friendship router
- `apps/server/src/trpc/gathering.ts` — add `friendActivity` procedure
- `apps/web/app/routes.ts` — add /friends and /friends/activity routes
- `apps/web/app/root.tsx` — fetch incoming request count in root loader
- `apps/web/app/components/nav.tsx` — add friend request badge and Friends link
- `apps/web/app/routes/gatherings.$id.tsx` — add "Add Friend" buttons to participant list
- `apps/web/app/routes/dashboard.tsx` — add friend activity preview section

---

## Task 1: Database Migration

**Files:**
- Create: `packages/db/src/migrations/007-create-friendship.ts`

- [ ] **Step 1: Write the migration file**

```typescript
import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`CREATE TYPE friendship_status AS ENUM ('pending', 'accepted', 'declined')`.execute(db)

  await db.schema
    .createTable('friendship')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn('requester_id', 'uuid', (col) =>
      col.notNull().references('users.id'),
    )
    .addColumn('addressee_id', 'uuid', (col) =>
      col.notNull().references('users.id'),
    )
    .addColumn('status', sql`friendship_status`, (col) =>
      col.notNull().defaultTo('pending'),
    )
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute()

  await db.schema
    .createIndex('uq_friendship_pair')
    .on('friendship')
    .columns(['requester_id', 'addressee_id'])
    .unique()
    .execute()

  await db.schema
    .createIndex('idx_friendship_addressee_id')
    .on('friendship')
    .column('addressee_id')
    .execute()

  await db.schema
    .createIndex('idx_friendship_requester_id')
    .on('friendship')
    .column('requester_id')
    .execute()

  await db.schema
    .createIndex('idx_friendship_status')
    .on('friendship')
    .column('status')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('friendship').execute()
  await sql`DROP TYPE friendship_status`.execute(db)
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/db/src/migrations/007-create-friendship.ts
git commit -m "feat(db): add friendship table migration"
```

---

## Task 2: Database Types & Serializers

**Files:**
- Modify: `packages/db/src/types.ts`
- Modify: `packages/db/src/serializers.ts`
- Modify: `packages/db/src/index.ts`

- [ ] **Step 1: Add `FriendshipTable` to types.ts**

Add the new interface after `GatheringParticipantTable`:

```typescript
export interface FriendshipTable {
  id: Generated<string>
  requester_id: string
  addressee_id: string
  status: Generated<'pending' | 'accepted' | 'declined'>
  created_at: Generated<Date>
  updated_at: Generated<Date>
}
```

Add to `Database` interface:
```typescript
  friendship: FriendshipTable
```

- [ ] **Step 2: Add serializer to serializers.ts**

Add import of `FriendshipTable` to the existing import line. Add function:

```typescript
export function serializeFriendship(row: Selectable<FriendshipTable>) {
  return {
    id: row.id,
    requesterId: row.requester_id,
    addresseeId: row.addressee_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
```

- [ ] **Step 3: Update index.ts exports**

Add `FriendshipTable` to the type exports.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/types.ts packages/db/src/serializers.ts packages/db/src/index.ts
git commit -m "feat(db): add friendship types and serializer"
```

---

## Task 3: Contracts

**Files:**
- Create: `packages/contracts/src/friendship.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `packages/contracts/package.json`

- [ ] **Step 1: Create friendship contracts**

```typescript
import { z } from 'zod'
import { gatheringSchema } from './gathering.js'

export const friendshipStatusSchema = z.enum(['pending', 'accepted', 'declined'])

export const sendFriendRequestSchema = z.object({
  userId: z.string().uuid(),
})

export const friendshipActionSchema = z.object({
  friendshipId: z.string().uuid(),
})

export const friendshipSchema = z.object({
  id: z.string().uuid(),
  requesterId: z.string().uuid(),
  addresseeId: z.string().uuid(),
  status: friendshipStatusSchema,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export const friendSchema = z.object({
  friendshipId: z.string().uuid(),
  friendId: z.string().uuid(),
  displayName: z.string(),
  createdAt: z.coerce.date(),
})

export const incomingRequestSchema = friendshipSchema.extend({
  requesterDisplayName: z.string(),
})

export const outgoingRequestSchema = friendshipSchema.extend({
  addresseeDisplayName: z.string(),
})

export const friendActivityInputSchema = z.object({
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(50).default(20),
})

export const friendActivityGatheringSchema = gatheringSchema.extend({
  friends: z.array(z.object({
    friendId: z.string().uuid(),
    displayName: z.string(),
    role: z.enum(['host', 'participant']),
  })),
})

export const friendActivityOutputSchema = z.object({
  gatherings: z.array(friendActivityGatheringSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
})

export type FriendshipStatus = z.infer<typeof friendshipStatusSchema>
export type SendFriendRequestInput = z.infer<typeof sendFriendRequestSchema>
export type FriendshipActionInput = z.infer<typeof friendshipActionSchema>
export type FriendshipOutput = z.infer<typeof friendshipSchema>
export type FriendOutput = z.infer<typeof friendSchema>
export type FriendActivityInput = z.infer<typeof friendActivityInputSchema>
export type FriendActivityOutput = z.infer<typeof friendActivityOutputSchema>
```

- [ ] **Step 2: Update contracts index**

Add to `packages/contracts/src/index.ts`:
```typescript
export * from './friendship.js'
```

- [ ] **Step 3: Add exports entry to package.json**

In `packages/contracts/package.json`, add to the `exports` object:
```json
    "./friendship": "./src/friendship.ts"
```

- [ ] **Step 4: Commit**

```bash
git add packages/contracts/src/friendship.ts packages/contracts/src/index.ts packages/contracts/package.json
git commit -m "feat(contracts): add friendship schemas"
```

---

## Task 4: Server — Friendship Router

**Files:**
- Create: `apps/server/src/trpc/friendship.ts`
- Modify: `apps/server/src/trpc/router.ts`

This is the largest task. The friendship router has 7 procedures.

- [ ] **Step 1: Create the friendship router file**

```typescript
import { TRPCError } from '@trpc/server'
import { sql } from '@game-finder/db'
import {
  sendFriendRequestSchema,
  friendshipActionSchema,
} from '@game-finder/contracts/friendship'
import { serializeFriendship } from '@game-finder/db/serializers'
import { createRouter, protectedProcedure } from './init.js'

export const friendshipRouter = createRouter({
  sendRequest: protectedProcedure
    .input(sendFriendRequestSchema)
    .mutation(async ({ input, ctx }) => {
      if (input.userId === ctx.userId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot send a friend request to yourself' })
      }

      // Check for existing row in either direction (any status)
      const existing = await ctx.db
        .selectFrom('friendship')
        .select(['id', 'status', 'requester_id'])
        .where((eb) =>
          eb.or([
            eb.and([
              eb('requester_id', '=', ctx.userId),
              eb('addressee_id', '=', input.userId),
            ]),
            eb.and([
              eb('requester_id', '=', input.userId),
              eb('addressee_id', '=', ctx.userId),
            ]),
          ]),
        )
        .executeTakeFirst()

      if (existing) {
        if (existing.status === 'pending' || existing.status === 'accepted') {
          throw new TRPCError({ code: 'CONFLICT', message: 'A friendship already exists between these users' })
        }
        // Declined row exists — clean it up so a fresh request can be created
        await ctx.db.deleteFrom('friendship').where('id', '=', existing.id).execute()
      }

      // Validate target user exists
      const targetUser = await ctx.db
        .selectFrom('users')
        .select('id')
        .where('id', '=', input.userId)
        .executeTakeFirst()

      if (!targetUser) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' })
      }

      // Validate shared gathering (either as host or participant)
      const sharedGathering = await ctx.db
        .selectFrom('gathering')
        .select('gathering.id')
        .where((eb) =>
          eb.or([
            // Both are hosts of the same gathering (not possible, but handles edge)
            eb.and([
              eb('gathering.host_id', '=', ctx.userId),
              eb.exists(
                eb.selectFrom('gathering')
                  .select(sql.lit(1).as('one'))
                  .where('host_id', '=', input.userId)
                  .whereRef('id', '=', 'gathering.id'),
              ),
            ]),
            // Current user is host, target is participant
            eb.and([
              eb('gathering.host_id', '=', ctx.userId),
              eb.exists(
                eb.selectFrom('gathering_participant')
                  .select(sql.lit(1).as('one'))
                  .where('user_id', '=', input.userId)
                  .whereRef('gathering_id', '=', 'gathering.id'),
              ),
            ]),
            // Current user is participant, target is host
            eb.and([
              eb('gathering.host_id', '=', input.userId),
              eb.exists(
                eb.selectFrom('gathering_participant')
                  .select(sql.lit(1).as('one'))
                  .where('user_id', '=', ctx.userId)
                  .whereRef('gathering_id', '=', 'gathering.id'),
              ),
            ]),
            // Both are participants
            eb.and([
              eb.exists(
                eb.selectFrom('gathering_participant')
                  .select(sql.lit(1).as('one'))
                  .where('user_id', '=', ctx.userId)
                  .whereRef('gathering_id', '=', 'gathering.id'),
              ),
              eb.exists(
                eb.selectFrom('gathering_participant')
                  .select(sql.lit(1).as('one'))
                  .where('user_id', '=', input.userId)
                  .whereRef('gathering_id', '=', 'gathering.id'),
              ),
            ]),
          ]),
        )
        .limit(1)
        .executeTakeFirst()

      if (!sharedGathering) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You can only send friend requests to people you share a gathering with' })
      }

      const friendship = await ctx.db
        .insertInto('friendship')
        .values({
          requester_id: ctx.userId,
          addressee_id: input.userId,
        })
        .returningAll()
        .executeTakeFirstOrThrow()

      return serializeFriendship(friendship)
    }),

  acceptRequest: protectedProcedure
    .input(friendshipActionSchema)
    .mutation(async ({ input, ctx }) => {
      const friendship = await ctx.db
        .selectFrom('friendship')
        .selectAll()
        .where('id', '=', input.friendshipId)
        .executeTakeFirst()

      if (!friendship || friendship.status !== 'pending') {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Pending friend request not found' })
      }

      if (friendship.addressee_id !== ctx.userId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only the addressee can accept a friend request' })
      }

      const updated = await ctx.db
        .updateTable('friendship')
        .set({ status: 'accepted', updated_at: new Date() })
        .where('id', '=', input.friendshipId)
        .returningAll()
        .executeTakeFirstOrThrow()

      return serializeFriendship(updated)
    }),

  declineRequest: protectedProcedure
    .input(friendshipActionSchema)
    .mutation(async ({ input, ctx }) => {
      const friendship = await ctx.db
        .selectFrom('friendship')
        .selectAll()
        .where('id', '=', input.friendshipId)
        .executeTakeFirst()

      if (!friendship || friendship.status !== 'pending') {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Pending friend request not found' })
      }

      if (friendship.addressee_id !== ctx.userId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only the addressee can decline a friend request' })
      }

      const updated = await ctx.db
        .updateTable('friendship')
        .set({ status: 'declined', updated_at: new Date() })
        .where('id', '=', input.friendshipId)
        .returningAll()
        .executeTakeFirstOrThrow()

      return serializeFriendship(updated)
    }),

  remove: protectedProcedure
    .input(friendshipActionSchema)
    .mutation(async ({ input, ctx }) => {
      const friendship = await ctx.db
        .selectFrom('friendship')
        .select(['id', 'requester_id', 'addressee_id'])
        .where('id', '=', input.friendshipId)
        .executeTakeFirst()

      if (!friendship) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Friendship not found' })
      }

      if (friendship.requester_id !== ctx.userId && friendship.addressee_id !== ctx.userId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You are not part of this friendship' })
      }

      await ctx.db
        .deleteFrom('friendship')
        .where('id', '=', input.friendshipId)
        .execute()

      return { success: true }
    }),

  listFriends: protectedProcedure
    .query(async ({ ctx }) => {
      const rows = await ctx.db
        .selectFrom('friendship')
        .innerJoin('users as requester', 'requester.id', 'friendship.requester_id')
        .innerJoin('users as addressee', 'addressee.id', 'friendship.addressee_id')
        .select([
          'friendship.id as friendship_id',
          'friendship.requester_id',
          'friendship.addressee_id',
          'friendship.created_at',
          'requester.display_name as requester_display_name',
          'addressee.display_name as addressee_display_name',
        ])
        .where('friendship.status', '=', 'accepted')
        .where((eb) =>
          eb.or([
            eb('friendship.requester_id', '=', ctx.userId),
            eb('friendship.addressee_id', '=', ctx.userId),
          ]),
        )
        .execute()

      return rows.map((row) => {
        const iAmRequester = row.requester_id === ctx.userId
        return {
          friendshipId: row.friendship_id,
          friendId: iAmRequester ? row.addressee_id : row.requester_id,
          displayName: iAmRequester ? row.addressee_display_name : row.requester_display_name,
          createdAt: row.created_at,
        }
      })
    }),

  listIncomingRequests: protectedProcedure
    .query(async ({ ctx }) => {
      const rows = await ctx.db
        .selectFrom('friendship')
        .innerJoin('users', 'users.id', 'friendship.requester_id')
        .selectAll('friendship')
        .select('users.display_name as requester_display_name')
        .where('friendship.addressee_id', '=', ctx.userId)
        .where('friendship.status', '=', 'pending')
        .orderBy('friendship.created_at', 'desc')
        .execute()

      return rows.map((row) => ({
        ...serializeFriendship(row),
        requesterDisplayName: row.requester_display_name,
      }))
    }),

  listOutgoingRequests: protectedProcedure
    .query(async ({ ctx }) => {
      const rows = await ctx.db
        .selectFrom('friendship')
        .innerJoin('users', 'users.id', 'friendship.addressee_id')
        .selectAll('friendship')
        .select('users.display_name as addressee_display_name')
        .where('friendship.requester_id', '=', ctx.userId)
        .where('friendship.status', '=', 'pending')
        .orderBy('friendship.created_at', 'desc')
        .execute()

      return rows.map((row) => ({
        ...serializeFriendship(row),
        addresseeDisplayName: row.addressee_display_name,
      }))
    }),
})
```

- [ ] **Step 2: Register the friendship router**

In `apps/server/src/trpc/router.ts`, add the import and register it:

```typescript
import { friendshipRouter } from './friendship.js'
```

Add to the `appRouter` object:
```typescript
  friendship: friendshipRouter,
```

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/trpc/friendship.ts apps/server/src/trpc/router.ts
git commit -m "feat(server): add friendship router with all CRUD procedures"
```

---

## Task 5: Server — friendActivity Procedure

**Files:**
- Modify: `apps/server/src/trpc/gathering.ts`

- [ ] **Step 1: Add the `friendActivity` procedure**

Add import at top:
```typescript
import { friendActivityInputSchema } from '@game-finder/contracts/friendship'
```

Add to `gatheringRouter`:

```typescript
  friendActivity: protectedProcedure
    .input(friendActivityInputSchema)
    .query(async ({ input, ctx }) => {
      const { page, pageSize } = input

      // Get accepted friend IDs
      const friendRows = await ctx.db
        .selectFrom('friendship')
        .select(['requester_id', 'addressee_id'])
        .where('status', '=', 'accepted')
        .where((eb) =>
          eb.or([
            eb('requester_id', '=', ctx.userId),
            eb('addressee_id', '=', ctx.userId),
          ]),
        )
        .execute()

      const friendIds = friendRows.map((r) =>
        r.requester_id === ctx.userId ? r.addressee_id : r.requester_id,
      )

      if (friendIds.length === 0) {
        return { gatherings: [], total: 0, page, pageSize }
      }

      // Base query: public, active gatherings with next_occurrence_at
      // where a friend is host OR a joined participant
      // excluding gatherings the current user is involved in
      let baseQuery = ctx.db
        .selectFrom('gathering')
        .where('gathering.visibility', '=', 'public')
        .where('gathering.status', '=', 'active')
        .where('gathering.next_occurrence_at', 'is not', null)
        .where('gathering.host_id', '!=', ctx.userId)
        .where((eb) =>
          eb.not(
            eb.exists(
              eb.selectFrom('gathering_participant')
                .select(sql.lit(1).as('one'))
                .where('user_id', '=', ctx.userId)
                .whereRef('gathering_id', '=', 'gathering.id'),
            ),
          ),
        )
        .where((eb) =>
          eb.or([
            eb('gathering.host_id', 'in', friendIds),
            eb.exists(
              eb.selectFrom('gathering_participant')
                .select(sql.lit(1).as('one'))
                .where('user_id', 'in', friendIds)
                .where('status', '=', 'joined')
                .whereRef('gathering_id', '=', 'gathering.id'),
            ),
          ]),
        )

      // Count total
      const countResult = await baseQuery
        .select(sql<number>`count(distinct gathering.id)`.as('count'))
        .executeTakeFirstOrThrow()
      const total = Number(countResult.count)

      // Fetch paginated results
      const rows = await baseQuery
        .selectAll('gathering')
        .orderBy('gathering.next_occurrence_at', 'asc')
        .limit(pageSize)
        .offset((page - 1) * pageSize)
        .execute()

      // For each gathering, determine which friends are involved and their role
      const gatheringIds = rows.map((r) => r.id)
      const friendsMap = new Map<string, Array<{ friendId: string; displayName: string; role: 'host' | 'participant' }>>()

      if (gatheringIds.length > 0) {
        // Friends who are hosts
        for (const row of rows) {
          if (friendIds.includes(row.host_id)) {
            const user = await ctx.db
              .selectFrom('users')
              .select('display_name')
              .where('id', '=', row.host_id)
              .executeTakeFirst()
            if (user) {
              const existing = friendsMap.get(row.id) ?? []
              existing.push({ friendId: row.host_id, displayName: user.display_name, role: 'host' })
              friendsMap.set(row.id, existing)
            }
          }
        }

        // Friends who are participants
        const participantRows = await ctx.db
          .selectFrom('gathering_participant')
          .innerJoin('users', 'users.id', 'gathering_participant.user_id')
          .select([
            'gathering_participant.gathering_id',
            'gathering_participant.user_id',
            'users.display_name',
          ])
          .where('gathering_participant.gathering_id', 'in', gatheringIds)
          .where('gathering_participant.user_id', 'in', friendIds)
          .where('gathering_participant.status', '=', 'joined')
          .execute()

        for (const row of participantRows) {
          const existing = friendsMap.get(row.gathering_id) ?? []
          existing.push({ friendId: row.user_id, displayName: row.display_name, role: 'participant' })
          friendsMap.set(row.gathering_id, existing)
        }
      }

      const gatherings = rows.map((row) => ({
        ...serializeGathering(row),
        friends: friendsMap.get(row.id) ?? [],
      }))

      return { gatherings, total, page, pageSize }
    }),
```

- [ ] **Step 2: Commit**

```bash
git add apps/server/src/trpc/gathering.ts
git commit -m "feat(server): add friendActivity procedure to gathering router"
```

---

## Task 6: Web — Routes Setup & Nav Badge

**Files:**
- Modify: `apps/web/app/routes.ts` — add new routes
- Modify: `apps/web/app/root.tsx` — fetch incoming request count
- Modify: `apps/web/app/components/nav.tsx` — add Friends link with badge

- [ ] **Step 1: Add routes**

In `apps/web/app/routes.ts`, add before the `] satisfies RouteConfig` line:

```typescript
  route('friends', 'routes/friends.tsx'),
  route('friends/activity', 'routes/friends.activity.tsx'),
```

- [ ] **Step 2: Update root loader to fetch friend request count**

In `apps/web/app/root.tsx`, update the loader to also fetch incoming requests when authenticated:

```typescript
export async function loader({ context }: Route.LoaderArgs) {
  const ctx = context as { cookie?: string }
  const trpc = createServerTRPC(ctx.cookie ?? '')
  const user = await trpc.auth.me.query().catch(() => null)

  let friendRequestCount = 0
  if (user) {
    const requests = await trpc.friendship.listIncomingRequests.query().catch(() => [])
    friendRequestCount = requests.length
  }

  return { user, friendRequestCount }
}
```

Update the Root component to pass the count to Nav:

```typescript
export default function Root({ loaderData }: Route.ComponentProps) {
  return (
    <>
      <Nav user={loaderData.user} friendRequestCount={loaderData.friendRequestCount} />
      <Outlet />
    </>
  )
}
```

- [ ] **Step 3: Update Nav to show Friends link with badge**

Update the `Nav` props interface:

```typescript
export function Nav({ user, friendRequestCount = 0 }: { user: NavUser | null; friendRequestCount?: number }) {
```

Add a Friends link with badge in the desktop nav (after "Dashboard" link, before the logout form):

```tsx
              <Link
                to="/friends"
                className="relative text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Friends
                {friendRequestCount > 0 && (
                  <span className="absolute -top-1.5 -right-3 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    {friendRequestCount}
                  </span>
                )}
              </Link>
```

Add the same link in the mobile menu (after the existing Dashboard link, or after the display name).

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/routes.ts apps/web/app/root.tsx apps/web/app/components/nav.tsx
git commit -m "feat(web): add friend routes, nav badge, and root loader friend count"
```

---

## Task 7: Web — Friends Page

**Files:**
- Create: `apps/web/app/routes/friends.tsx`

- [ ] **Step 1: Create the friends page**

```tsx
import { Badge } from '@game-finder/ui/components/badge'
import { Button } from '@game-finder/ui/components/button'
import { Form, Link, redirect } from 'react-router'
import { MapBackground } from '../components/map-background.js'
import { createServerTRPC } from '../trpc/server.js'
import type { Route } from './+types/friends.js'

export async function loader({ context }: Route.LoaderArgs) {
  const ctx = context as { cookie?: string }
  const trpc = createServerTRPC(ctx.cookie ?? '')

  const user = await trpc.auth.me.query().catch(() => null)
  if (!user) throw redirect('/login?returnTo=/friends')

  const [friends, incomingRequests] = await Promise.all([
    trpc.friendship.listFriends.query(),
    trpc.friendship.listIncomingRequests.query(),
  ])

  return { friends, incomingRequests }
}

export async function action({ request, context }: Route.ActionArgs) {
  const ctx = context as { cookie?: string }
  const trpc = createServerTRPC(ctx.cookie ?? '')

  const formData = await request.formData()
  const intent = String(formData.get('intent'))
  const friendshipId = String(formData.get('friendshipId'))

  if (intent === 'accept') {
    await trpc.friendship.acceptRequest.mutate({ friendshipId })
  } else if (intent === 'decline') {
    await trpc.friendship.declineRequest.mutate({ friendshipId })
  } else if (intent === 'remove') {
    await trpc.friendship.remove.mutate({ friendshipId })
  }

  return redirect('/friends')
}

export default function Friends({ loaderData }: Route.ComponentProps) {
  const { friends, incomingRequests } = loaderData

  return (
    <div className="relative min-h-[calc(100vh-65px)]">
      <MapBackground />

    <div className="relative z-10 mx-auto max-w-4xl px-6 py-10 space-y-10">
      {/* Friend Requests */}
      <div className="animate-fade-in-up space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold tracking-[0.2em] text-primary uppercase">
              Incoming
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Friend Requests
            </h1>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/friends/activity">Friend Activity</Link>
          </Button>
        </div>

        {incomingRequests.length === 0 ? (
          <div className="rounded-lg border border-border bg-card/60 p-8 text-center backdrop-blur-sm">
            <p className="text-sm text-muted-foreground">No pending requests.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {incomingRequests.map((req) => (
              <div
                key={req.id}
                className="rounded-lg border border-border bg-card/60 p-4 backdrop-blur-sm flex items-center justify-between gap-4"
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">{req.requesterDisplayName}</p>
                  <p className="text-xs text-muted-foreground">wants to be your friend</p>
                </div>
                <div className="flex items-center gap-2">
                  <Form method="post">
                    <input type="hidden" name="intent" value="accept" />
                    <input type="hidden" name="friendshipId" value={req.id} />
                    <Button type="submit" size="sm">Accept</Button>
                  </Form>
                  <Form method="post">
                    <input type="hidden" name="intent" value="decline" />
                    <input type="hidden" name="friendshipId" value={req.id} />
                    <Button type="submit" variant="outline" size="sm">Decline</Button>
                  </Form>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Friends List */}
      <div className="animate-fade-in-up animation-delay-100 space-y-4">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold tracking-[0.2em] text-primary uppercase">
            Your party
          </p>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            My Friends
          </h2>
        </div>

        {friends.length === 0 ? (
          <div className="rounded-lg border border-border bg-card/60 p-8 text-center backdrop-blur-sm">
            <p className="text-sm text-muted-foreground">No friends yet. Join a gathering to meet people!</p>
            <Button className="mt-4" asChild>
              <Link to="/search">Find games</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {friends.map((friend) => (
              <div
                key={friend.friendshipId}
                className="rounded-lg border border-border bg-card/60 p-4 backdrop-blur-sm flex items-center justify-between gap-4"
              >
                <p className="text-sm font-semibold text-foreground">{friend.displayName}</p>
                <Form
                  method="post"
                  onSubmit={(e) => {
                    if (!confirm(`Remove ${friend.displayName} as a friend?`)) {
                      e.preventDefault()
                    }
                  }}
                >
                  <input type="hidden" name="intent" value="remove" />
                  <input type="hidden" name="friendshipId" value={friend.friendshipId} />
                  <Button type="submit" variant="ghost" size="sm" className="text-muted-foreground">
                    Remove
                  </Button>
                </Form>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/routes/friends.tsx
git commit -m "feat(web): add /friends page with requests and friend list"
```

---

## Task 8: Web — Friend Activity Page

**Files:**
- Create: `apps/web/app/routes/friends.activity.tsx`

- [ ] **Step 1: Create the friend activity page**

```tsx
import { Badge } from '@game-finder/ui/components/badge'
import { Button } from '@game-finder/ui/components/button'
import { Link, redirect, useSearchParams } from 'react-router'
import { MapBackground } from '../components/map-background.js'
import { createServerTRPC } from '../trpc/server.js'
import type { Route } from './+types/friends.activity.js'

export async function loader({ request, context }: Route.LoaderArgs) {
  const ctx = context as { cookie?: string }
  const trpc = createServerTRPC(ctx.cookie ?? '')

  const user = await trpc.auth.me.query().catch(() => null)
  if (!user) throw redirect('/login?returnTo=/friends/activity')

  const url = new URL(request.url)
  const page = Number(url.searchParams.get('page')) || 1

  const result = await trpc.gathering.friendActivity.query({ page, pageSize: 20 })
  return { result }
}

export default function FriendActivity({ loaderData }: Route.ComponentProps) {
  const { result } = loaderData
  const [searchParams] = useSearchParams()
  const currentPage = Number(searchParams.get('page')) || 1

  return (
    <div className="relative min-h-[calc(100vh-65px)]">
      <MapBackground />

    <div className="relative z-10 mx-auto max-w-4xl px-6 py-10 space-y-8">
      <div className="animate-fade-in-up flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold tracking-[0.2em] text-primary uppercase">
            Social
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Friend Activity
          </h1>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/friends">Back to Friends</Link>
        </Button>
      </div>

      {result.gatherings.length === 0 ? (
        <div className="animate-fade-in-up animation-delay-100 rounded-lg border border-border bg-card/60 p-10 text-center backdrop-blur-sm">
          <p className="text-sm text-muted-foreground">
            Your friends aren&apos;t in any upcoming gatherings.
          </p>
          <Button className="mt-4" asChild>
            <Link to="/search">Find games to join</Link>
          </Button>
        </div>
      ) : (
        <div className="animate-fade-in-up animation-delay-100 space-y-3">
          {result.gatherings.map((gathering) => (
            <Link
              key={gathering.id}
              to={`/gatherings/${gathering.id}`}
              className="block rounded-lg border border-border bg-card/60 p-5 backdrop-blur-sm transition-all duration-200 hover:border-primary/20"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-base font-semibold tracking-tight text-foreground">
                    {gathering.title}
                  </h3>
                  {gathering.nextOccurrenceAt && (
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(gathering.nextOccurrenceAt).toLocaleDateString([], { dateStyle: 'medium' })}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {gathering.friends.map((f) => (
                    <Badge
                      key={f.friendId}
                      variant="outline"
                      className="border-primary/30 text-primary text-[11px]"
                    >
                      {f.displayName} — {f.role === 'host' ? 'hosting' : 'playing'}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{gathering.zipCode}</p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {result.total > result.pageSize && (
        <div className="flex justify-center gap-2 pt-4">
          {currentPage > 1 && (
            <Button variant="outline" size="sm" asChild>
              <Link to={`/friends/activity?page=${currentPage - 1}`}>Previous</Link>
            </Button>
          )}
          {currentPage * result.pageSize < result.total && (
            <Button variant="outline" size="sm" asChild>
              <Link to={`/friends/activity?page=${currentPage + 1}`}>Next</Link>
            </Button>
          )}
        </div>
      )}
    </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/routes/friends.activity.tsx
git commit -m "feat(web): add /friends/activity page with friend gathering feed"
```

---

## Task 9: Web — Add Friend Buttons on Gathering Detail

**Files:**
- Modify: `apps/web/app/routes/gatherings.$id.tsx`

- [ ] **Step 1: Update loader to fetch friendship data**

Add `outgoingRequests`, `incomingRequests`, and `friends` to the loader. After the existing `Promise.all`, add:

```typescript
  let outgoingRequests: Array<{ addresseeId: string }> = []
  let incomingRequests: Array<{ requesterId: string }> = []
  let friends: Array<{ friendId: string }> = []
  if (user) {
    const [outgoing, incoming, friendList] = await Promise.all([
      trpc.friendship.listOutgoingRequests.query().catch(() => []),
      trpc.friendship.listIncomingRequests.query().catch(() => []),
      trpc.friendship.listFriends.query().catch(() => []),
    ])
    outgoingRequests = outgoing
    incomingRequests = incoming
    friends = friendList
  }

  return { gathering, user, participants, joinCode, outgoingRequests, incomingRequests, friends }
```

- [ ] **Step 2: Add `sendFriendRequest` intent to the action**

In the action, add a new intent handler:

```typescript
  } else if (intent === 'sendFriendRequest') {
    const targetUserId = String(formData.get('targetUserId'))
    await trpc.friendship.sendRequest.mutate({ userId: targetUserId })
  }
```

- [ ] **Step 3: Update the participant list to include Add Friend buttons**

In the component, destructure the new data:
```typescript
  const { gathering, user, participants, joinCode, outgoingRequests, incomingRequests, friends } = loaderData
```

Replace the participant badges block (the `{participants.length > 0 && (` section) with a version that includes friend buttons. Each participant badge should have an "Add Friend" button next to it, unless:
- It's the current user
- They're already friends
- A request is already pending

```tsx
        {participants.length > 0 && (
          <div className="space-y-2">
            {participants.map((p) => {
              const isSelf = user?.id === p.userId
              const isFriend = friends.some((f) => f.friendId === p.userId)
              const isPending = outgoingRequests.some((r) => r.addresseeId === p.userId) || incomingRequests.some((r) => r.requesterId === p.userId)

              return (
                <div key={p.id} className="flex items-center gap-2">
                  <Badge
                    variant={p.status === 'joined' ? 'outline' : 'secondary'}
                    className={p.status === 'joined' ? 'border-primary/30 text-primary' : ''}
                  >
                    {p.displayName}
                    {p.status === 'waitlisted' && ' (waitlisted)'}
                  </Badge>
                  {user && !isSelf && !isFriend && !isPending && (
                    <Form method="post" className="inline">
                      <input type="hidden" name="intent" value="sendFriendRequest" />
                      <input type="hidden" name="targetUserId" value={p.userId} />
                      <Button type="submit" variant="ghost" size="sm" className="h-6 px-2 text-[11px] text-muted-foreground">
                        + Add Friend
                      </Button>
                    </Form>
                  )}
                  {isPending && (
                    <span className="text-[11px] text-muted-foreground">Pending</span>
                  )}
                  {isFriend && (
                    <span className="text-[11px] text-primary">Friend</span>
                  )}
                </div>
              )
            })}
          </div>
        )}
```

Also add a friend button for the host (in the "Hosted by" section). After the host display name, if the user is not the host and not already friends:

```tsx
          <p className="text-sm text-muted-foreground">
            Hosted by <span className="font-medium text-primary">{gathering.host.displayName}</span>
            {user && !isOwner && !friends.some((f) => f.friendId === gathering.hostId) && !outgoingRequests.some((r) => r.addresseeId === gathering.hostId) && !incomingRequests.some((r) => r.requesterId === gathering.hostId) && (
              <Form method="post" className="inline ml-2">
                <input type="hidden" name="intent" value="sendFriendRequest" />
                <input type="hidden" name="targetUserId" value={gathering.hostId} />
                <Button type="submit" variant="ghost" size="sm" className="h-5 px-1.5 text-[10px] text-muted-foreground">
                  + Add Friend
                </Button>
              </Form>
            )}
            {user && !isOwner && (outgoingRequests.some((r) => r.addresseeId === gathering.hostId) || incomingRequests.some((r) => r.requesterId === gathering.hostId)) && (
              <span className="ml-2 text-[10px] text-muted-foreground">Request Pending</span>
            )}
            {user && !isOwner && friends.some((f) => f.friendId === gathering.hostId) && (
              <span className="ml-2 text-[10px] text-primary">Friend</span>
            )}
          </p>
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/routes/gatherings.$id.tsx
git commit -m "feat(web): add friend buttons to gathering detail participant list"
```

---

## Task 10: Web — Dashboard Friend Activity Preview

**Files:**
- Modify: `apps/web/app/routes/dashboard.tsx`

- [ ] **Step 1: Update loader to fetch friend activity count**

After the existing `Promise.all`, add:

```typescript
  const friendActivity = await trpc.gathering.friendActivity.query({ page: 1, pageSize: 1 }).catch(() => ({ total: 0 }))
```

Add `friendActivityCount: friendActivity.total` to the return object.

- [ ] **Step 2: Add friend activity preview to the component**

Destructure `friendActivityCount` from loaderData. After the "My Games" section, add:

```tsx
      {/* Friend Activity Preview */}
      <div className="animate-fade-in-up animation-delay-300 rounded-lg border border-border bg-card/60 p-5 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.2em] text-primary uppercase">Social</p>
            <p className="text-sm text-foreground mt-1">
              {friendActivityCount > 0
                ? `${friendActivityCount} gathering${friendActivityCount !== 1 ? 's' : ''} your friends are in`
                : 'No friend activity yet'}
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/friends/activity">View Activity</Link>
          </Button>
        </div>
      </div>
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/routes/dashboard.tsx
git commit -m "feat(web): add friend activity preview to dashboard"
```

---

## Task 11: Run Migration, Build & Verify

- [ ] **Step 1: Run the database migration**

```bash
set -a && source .env && set +a && pnpm --filter @game-finder/db migrate
```

- [ ] **Step 2: Run type checking**

```bash
pnpm typecheck
```

Fix any type errors introduced by the friendship system changes. Pre-existing errors in login/signup are expected.

- [ ] **Step 3: Rebuild Docker containers**

```bash
docker compose up -d --build
```

Wait for services to be healthy.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: address type errors and issues found during build"
```

(Only if fixes were needed.)

---

## Task 12: Smoke Tests

**Files:**
- Create: `docs/smoke-tests/friendship-system.md`

- [ ] **Step 1: Write smoke test instructions**

Create reusable, flow-based smoke test instructions (same style as `docs/smoke-tests/participant-system.md`). Tests should cover:

1. **Send friend request** — from gathering detail page, participant sends request to another participant
2. **Cannot friend yourself** — verify no "Add Friend" button next to your own name
3. **Cannot friend without shared gathering** — verify the gate works (create a fresh user, try to friend someone)
4. **View incoming requests** — navigate to /friends, see the request
5. **Accept friend request** — accept and verify friend appears in list
6. **Decline friend request** — decline and verify it disappears
7. **Remove friend** — unfriend and verify they're gone
8. **Friend activity feed** — navigate to /friends/activity, see gatherings friends are in
9. **Nav badge** — verify the badge shows request count and disappears after accepting
10. **Dashboard preview** — verify friend activity count on dashboard
11. **Pending badge on gathering page** — after sending a request, verify "Pending" appears

- [ ] **Step 2: Run the smoke tests via Playwright agent**

Dispatch a Haiku agent to execute the smoke tests.

- [ ] **Step 3: Commit smoke test instructions**

```bash
git add docs/smoke-tests/friendship-system.md
git commit -m "docs: add reusable smoke test instructions for friendship system"
```
