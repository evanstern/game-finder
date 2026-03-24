# Epic 3: Create & Manage Gatherings — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let hosts create, edit, close, and delete game gatherings linked to a curated game catalog, with a host dashboard and public details page.

**Architecture:** Two new DB tables (`game`, `gathering`) plus a join table (`gathering_game`). Two new tRPC routers (`game` for read-only catalog, `gathering` for full CRUD). Four new web pages (create, edit, dashboard, details). CodeMirror 6 Markdown editor with vim mode.

**Tech Stack:** Kysely (migrations + queries), tRPC (routers + procedures), Zod (validation), React Router 7 (pages), CodeMirror 6 (editor), react-markdown (rendering), Shadcn UI (components), Vitest (tests)

**Spec:** `docs/superpowers/specs/2026-03-24-epic-3-create-manage-gatherings-design.md`

---

## File Structure

### packages/db
- Create: `src/migrations/002-create-game.ts` — game_type enum + game table
- Create: `src/migrations/003-create-gathering.ts` — schedule_type + gathering_status enums + gathering table
- Create: `src/migrations/004-create-gathering-game.ts` — join table
- Create: `src/seed.ts` — seed script for game catalog
- Modify: `src/types.ts` — add GameTable, GatheringTable, GatheringGameTable to Database
- Modify: `src/index.ts` — re-export new types
- Modify: `package.json` — add seed script

### packages/contracts
- Create: `src/game.ts` — game type enum, game schema, game output type
- Create: `src/gathering.ts` — create/update input schemas, gathering output schema, schedule type enum
- Modify: `src/index.ts` — re-export new modules

### packages/ui
- Create: `src/components/select.tsx` — Shadcn Select component
- Create: `src/components/badge.tsx` — Shadcn Badge component
- Create: `src/components/textarea.tsx` — Shadcn Textarea component
- Create: `src/components/table.tsx` — Shadcn Table component

### apps/server
- Create: `src/trpc/game.ts` — game tRPC router (list, getById)
- Create: `src/trpc/gathering.ts` — gathering tRPC router (CRUD)
- Create: `src/gathering/next-occurrence.ts` — next_occurrence_at computation utility
- Modify: `src/trpc/router.ts` — register game + gathering routers

### apps/server/tests
- Create: `tests/game.test.ts` — game router tests
- Create: `tests/gathering.test.ts` — gathering router tests
- Create: `tests/next-occurrence.test.ts` — unit tests for schedule computation
- Modify: `tests/helpers.ts` — add seedGames(), createTestGathering(), updated cleanup()

### apps/web
- Create: `app/components/markdown-editor.tsx` — CodeMirror 6 + preview component
- Create: `app/components/gathering-form.tsx` — shared form for create/edit
- Create: `app/routes/gatherings.new.tsx` — create gathering page
- Create: `app/routes/gatherings.$id.tsx` — gathering details page
- Create: `app/routes/gatherings.$id.edit.tsx` — edit gathering page
- Create: `app/routes/dashboard.tsx` — host dashboard page
- Modify: `app/routes.ts` — add new routes
- Modify: `app/components/nav.tsx` — add Dashboard link when logged in

---

## Task 1: Database Migrations — Game Table

**Files:**
- Create: `packages/db/src/migrations/002-create-game.ts`

- [ ] **Step 1: Write migration file**

```typescript
// packages/db/src/migrations/002-create-game.ts
import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`CREATE TYPE game_type AS ENUM ('board_game', 'ttrpg', 'card_game')`.execute(db)

  await db.schema
    .createTable('game')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn('name', 'varchar(255)', (col) => col.notNull())
    .addColumn('type', sql`game_type`, (col) => col.notNull())
    .addColumn('description', 'text', (col) => col.notNull())
    .addColumn('min_players', 'smallint', (col) => col.notNull())
    .addColumn('max_players', 'smallint', (col) => col.notNull())
    .addColumn('image_url', 'varchar(500)')
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute()

  await db.schema.createIndex('idx_game_type').on('game').column('type').execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('game').execute()
  await sql`DROP TYPE game_type`.execute(db)
}
```

- [ ] **Step 2: Run migration**

Run: `pnpm --filter db migrate`
Expected: Migration 002-create-game applied successfully.

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/migrations/002-create-game.ts
git commit -m "feat(db): add game table with game_type enum"
```

---

## Task 2: Database Migrations — Gathering Table

**Files:**
- Create: `packages/db/src/migrations/003-create-gathering.ts`

- [ ] **Step 1: Write migration file**

```typescript
// packages/db/src/migrations/003-create-gathering.ts
import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`CREATE TYPE schedule_type AS ENUM ('once', 'weekly', 'biweekly', 'monthly')`.execute(db)
  await sql`CREATE TYPE gathering_status AS ENUM ('active', 'closed')`.execute(db)

  await db.schema
    .createTable('gathering')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn('host_id', 'uuid', (col) =>
      col.notNull().references('users.id'),
    )
    .addColumn('title', 'varchar(255)', (col) => col.notNull())
    .addColumn('description', 'text', (col) => col.notNull())
    .addColumn('zip_code', 'varchar(10)', (col) => col.notNull())
    .addColumn('schedule_type', sql`schedule_type`, (col) => col.notNull())
    .addColumn('starts_at', 'timestamptz', (col) => col.notNull())
    .addColumn('end_date', 'date')
    .addColumn('duration_minutes', 'smallint')
    .addColumn('max_players', 'smallint')
    .addColumn('status', sql`gathering_status`, (col) =>
      col.notNull().defaultTo('active'),
    )
    .addColumn('next_occurrence_at', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute()

  await db.schema.createIndex('idx_gathering_host_id').on('gathering').column('host_id').execute()
  await db.schema.createIndex('idx_gathering_zip_code').on('gathering').column('zip_code').execute()
  await db.schema.createIndex('idx_gathering_next_occurrence_at').on('gathering').column('next_occurrence_at').execute()
  await db.schema.createIndex('idx_gathering_status').on('gathering').column('status').execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('gathering').execute()
  await sql`DROP TYPE gathering_status`.execute(db)
  await sql`DROP TYPE schedule_type`.execute(db)
}
```

- [ ] **Step 2: Run migration**

Run: `pnpm --filter db migrate`
Expected: Migration 003-create-gathering applied successfully.

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/migrations/003-create-gathering.ts
git commit -m "feat(db): add gathering table with schedule and status enums"
```

---

## Task 3: Database Migrations — Join Table

**Files:**
- Create: `packages/db/src/migrations/004-create-gathering-game.ts`

- [ ] **Step 1: Write migration file**

```typescript
// packages/db/src/migrations/004-create-gathering-game.ts
import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('gathering_game')
    .addColumn('gathering_id', 'uuid', (col) =>
      col.notNull().references('gathering.id').onDelete('cascade'),
    )
    .addColumn('game_id', 'uuid', (col) =>
      col.notNull().references('game.id'),
    )
    .addPrimaryKeyConstraint('pk_gathering_game', ['gathering_id', 'game_id'])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('gathering_game').execute()
}
```

- [ ] **Step 2: Run migration**

Run: `pnpm --filter db migrate`
Expected: Migration 004-create-gathering-game applied successfully.

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/migrations/004-create-gathering-game.ts
git commit -m "feat(db): add gathering_game join table"
```

---

## Task 4: Database Types

**Files:**
- Modify: `packages/db/src/types.ts`
- Modify: `packages/db/src/index.ts`

- [ ] **Step 1: Update types.ts with new table interfaces**

Add to `packages/db/src/types.ts` (keeping existing `UsersTable` and `Database`):

```typescript
import type { Generated } from 'kysely'

export interface UsersTable {
  id: Generated<string>
  email: string
  password_hash: string
  display_name: string
  created_at: Generated<Date>
  updated_at: Generated<Date>
}

export interface GameTable {
  id: Generated<string>
  name: string
  type: 'board_game' | 'ttrpg' | 'card_game'
  description: string
  min_players: number
  max_players: number
  image_url: string | null
  created_at: Generated<Date>
  updated_at: Generated<Date>
}

export interface GatheringTable {
  id: Generated<string>
  host_id: string
  title: string
  description: string
  zip_code: string
  schedule_type: 'once' | 'weekly' | 'biweekly' | 'monthly'
  starts_at: Date
  end_date: Date | null
  duration_minutes: number | null
  max_players: number | null
  status: Generated<'active' | 'closed'>
  next_occurrence_at: Date | null
  created_at: Generated<Date>
  updated_at: Generated<Date>
}

export interface GatheringGameTable {
  gathering_id: string
  game_id: string
}

export interface Database {
  users: UsersTable
  game: GameTable
  gathering: GatheringTable
  gathering_game: GatheringGameTable
}
```

- [ ] **Step 2: Update index.ts exports**

Ensure `packages/db/src/index.ts` exports the new types. It should already export `Database` — verify and add any missing exports:

```typescript
export type { Database, GameTable, GatheringTable, GatheringGameTable } from './types.js'
export { createDb } from './client.js'
export { getDbConfig } from './env.js'
```

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/types.ts packages/db/src/index.ts
git commit -m "feat(db): add Game, Gathering, GatheringGame type interfaces"
```

---

## Task 5: Game Catalog Seed Script

**Files:**
- Create: `packages/db/src/seed.ts`
- Modify: `packages/db/package.json`

- [ ] **Step 1: Write seed script**

```typescript
// packages/db/src/seed.ts
import { createDb } from './client.js'
import { getDbConfig } from './env.js'

const GAMES = [
  // Board games
  { name: 'Catan', type: 'board_game' as const, description: 'Trade, build, and settle the island of Catan in this classic strategy game.', min_players: 3, max_players: 4 },
  { name: 'Ticket to Ride', type: 'board_game' as const, description: 'Collect cards and claim railway routes across the map.', min_players: 2, max_players: 5 },
  { name: 'Pandemic', type: 'board_game' as const, description: 'Work together to stop global disease outbreaks before time runs out.', min_players: 2, max_players: 4 },
  { name: 'Civilization', type: 'board_game' as const, description: 'Guide your civilization from ancient times to the modern age.', min_players: 2, max_players: 4 },
  { name: 'Azul', type: 'board_game' as const, description: 'Draft colorful tiles and arrange them on your board for points.', min_players: 2, max_players: 4 },
  { name: 'Wingspan', type: 'board_game' as const, description: 'Attract birds to your wildlife preserves in this engine-building game.', min_players: 1, max_players: 5 },
  { name: 'Terraforming Mars', type: 'board_game' as const, description: 'Compete to transform Mars into a habitable planet.', min_players: 1, max_players: 5 },
  { name: 'Spirit Island', type: 'board_game' as const, description: 'Play as spirits of the land defending your island from colonizers.', min_players: 1, max_players: 4 },
  { name: 'Gloomhaven', type: 'board_game' as const, description: 'A tactical combat game in a persistent world of shifting motives.', min_players: 1, max_players: 4 },
  { name: 'Codenames', type: 'board_game' as const, description: 'Give one-word clues to help your team guess the right words.', min_players: 4, max_players: 8 },
  // TTRPGs
  { name: 'Dungeons & Dragons 5e', type: 'ttrpg' as const, description: 'The world\'s most popular tabletop roleplaying game.', min_players: 3, max_players: 6 },
  { name: 'Pathfinder 2e', type: 'ttrpg' as const, description: 'A rich, deep tabletop RPG with highly customizable characters.', min_players: 3, max_players: 6 },
  { name: 'Call of Cthulhu', type: 'ttrpg' as const, description: 'Investigate cosmic horrors in this Lovecraftian RPG.', min_players: 2, max_players: 6 },
  { name: 'Blades in the Dark', type: 'ttrpg' as const, description: 'Play as scoundrels in a haunted industrial-fantasy city.', min_players: 3, max_players: 5 },
  { name: 'Fate Core', type: 'ttrpg' as const, description: 'A flexible narrative RPG system for any genre.', min_players: 2, max_players: 6 },
  // Card games
  { name: 'Magic: The Gathering', type: 'card_game' as const, description: 'The original collectible card game of strategy and spellcasting.', min_players: 2, max_players: 4 },
  { name: 'Pokemon TCG', type: 'card_game' as const, description: 'Battle with your favorite Pokemon in this trading card game.', min_players: 2, max_players: 2 },
  { name: 'Arkham Horror LCG', type: 'card_game' as const, description: 'A cooperative living card game of Lovecraftian mystery.', min_players: 1, max_players: 4 },
  { name: 'Dominion', type: 'card_game' as const, description: 'The original deck-building game — expand your kingdom card by card.', min_players: 2, max_players: 4 },
  { name: 'Exploding Kittens', type: 'card_game' as const, description: 'A fast-paced card game of strategy, luck, and exploding cats.', min_players: 2, max_players: 5 },
]

async function seed() {
  const config = getDbConfig()
  const db = createDb(config)

  const existing = await db.selectFrom('game').select('id').executeTakeFirst()
  if (existing) {
    console.log('Games already seeded, skipping.')
    await db.destroy()
    return
  }

  await db.insertInto('game').values(GAMES).execute()
  console.log(`Seeded ${GAMES.length} games.`)
  await db.destroy()
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
```

- [ ] **Step 2: Add seed script to package.json**

Add to `packages/db/package.json` scripts:

```json
"seed": "tsx src/seed.ts"
```

- [ ] **Step 3: Run seed**

Run: `pnpm --filter db seed`
Expected: "Seeded 20 games."

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/seed.ts packages/db/package.json
git commit -m "feat(db): add game catalog seed script with 20 tabletop games"
```

---

## Task 6: Contract Schemas — Game

**Files:**
- Create: `packages/contracts/src/game.ts`
- Modify: `packages/contracts/src/index.ts`

- [ ] **Step 1: Write game schemas**

```typescript
// packages/contracts/src/game.ts
import { z } from 'zod'

export const gameTypeSchema = z.enum(['board_game', 'ttrpg', 'card_game'])

export const gameSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: gameTypeSchema,
  description: z.string(),
  minPlayers: z.number(),
  maxPlayers: z.number(),
  imageUrl: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type GameType = z.infer<typeof gameTypeSchema>
export type GameOutput = z.infer<typeof gameSchema>
```

- [ ] **Step 2: Update index.ts**

Add to `packages/contracts/src/index.ts`:

```typescript
export * from './game.js'
```

(Keep existing auth exports if present.)

- [ ] **Step 3: Commit**

```bash
git add packages/contracts/src/game.ts packages/contracts/src/index.ts
git commit -m "feat(contracts): add game type enum and schema"
```

---

## Task 7: Contract Schemas — Gathering

**Files:**
- Create: `packages/contracts/src/gathering.ts`
- Modify: `packages/contracts/src/index.ts`

- [ ] **Step 1: Write gathering schemas**

```typescript
// packages/contracts/src/gathering.ts
import { z } from 'zod'

export const scheduleTypeSchema = z.enum(['once', 'weekly', 'biweekly', 'monthly'])

export const gatheringStatusSchema = z.enum(['active', 'closed'])

export const createGatheringSchema = z.object({
  title: z.string().min(1).max(255).trim(),
  gameIds: z.array(z.string().uuid()).min(1),
  zipCode: z.string().min(5).max(10),
  scheduleType: scheduleTypeSchema,
  startsAt: z.coerce.date(),
  endDate: z.coerce.date().nullable().optional(),
  durationMinutes: z.number().int().positive().nullable().optional(),
  maxPlayers: z.number().int().positive().nullable().optional(),
  description: z.string().min(1),
})

export const updateGatheringSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(255).trim().optional(),
  gameIds: z.array(z.string().uuid()).min(1).optional(),
  zipCode: z.string().min(5).max(10).optional(),
  scheduleType: scheduleTypeSchema.optional(),
  startsAt: z.coerce.date().optional(),
  endDate: z.coerce.date().nullable().optional(),
  durationMinutes: z.number().int().positive().nullable().optional(),
  maxPlayers: z.number().int().positive().nullable().optional(),
  description: z.string().min(1).optional(),
})

export const gatheringSchema = z.object({
  id: z.string().uuid(),
  hostId: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  zipCode: z.string(),
  scheduleType: scheduleTypeSchema,
  startsAt: z.coerce.date(),
  endDate: z.coerce.date().nullable(),
  durationMinutes: z.number().nullable(),
  maxPlayers: z.number().nullable(),
  status: gatheringStatusSchema,
  nextOccurrenceAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type ScheduleType = z.infer<typeof scheduleTypeSchema>
export type GatheringStatus = z.infer<typeof gatheringStatusSchema>
export type CreateGatheringInput = z.infer<typeof createGatheringSchema>
export type UpdateGatheringInput = z.infer<typeof updateGatheringSchema>
export type GatheringOutput = z.infer<typeof gatheringSchema>
```

- [ ] **Step 2: Update index.ts**

Add to `packages/contracts/src/index.ts`:

```typescript
export * from './gathering.js'
```

- [ ] **Step 3: Commit**

```bash
git add packages/contracts/src/gathering.ts packages/contracts/src/index.ts
git commit -m "feat(contracts): add gathering schemas and types"
```

---

## Task 8: Next Occurrence Computation Utility

**Files:**
- Create: `apps/server/src/gathering/next-occurrence.ts`

- [ ] **Step 1: Write the next-occurrence utility tests first**

Create test file `apps/server/tests/next-occurrence.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { computeNextOccurrence } from '../src/gathering/next-occurrence.js'

describe('computeNextOccurrence', () => {
  it('returns starts_at for one-off events', () => {
    const startsAt = new Date('2026-04-15T19:00:00Z')
    const result = computeNextOccurrence('once', startsAt, null)
    expect(result).toEqual(startsAt)
  })

  it('returns starts_at when it is in the future for weekly', () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const result = computeNextOccurrence('weekly', future, null)
    expect(result).toEqual(future)
  })

  it('returns next matching weekday for weekly when starts_at is past', () => {
    const past = new Date('2025-01-06T19:00:00Z') // a Monday
    const result = computeNextOccurrence('weekly', past, null)
    expect(result).not.toBeNull()
    expect(result!.getDay()).toBe(1) // Monday
    expect(result!.getTime()).toBeGreaterThan(Date.now())
  })

  it('returns correct biweekly occurrence', () => {
    const past = new Date('2025-01-06T19:00:00Z') // a Monday
    const result = computeNextOccurrence('biweekly', past, null)
    expect(result).not.toBeNull()
    expect(result!.getDay()).toBe(1) // Monday
    expect(result!.getTime()).toBeGreaterThan(Date.now())
  })

  it('returns next matching day-of-month for monthly', () => {
    const past = new Date('2025-01-15T19:00:00Z') // 15th
    const result = computeNextOccurrence('monthly', past, null)
    expect(result).not.toBeNull()
    expect(result!.getDate()).toBe(15)
    expect(result!.getTime()).toBeGreaterThan(Date.now())
  })

  it('returns null when recurring series is past end_date', () => {
    const past = new Date('2025-01-06T19:00:00Z')
    const endDate = new Date('2025-02-01')
    const result = computeNextOccurrence('weekly', past, endDate)
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/server && pnpm test -- --run tests/next-occurrence.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```typescript
// apps/server/src/gathering/next-occurrence.ts
import type { ScheduleType } from '@game-finder/contracts/gathering'

export function computeNextOccurrence(
  scheduleType: ScheduleType,
  startsAt: Date,
  endDate: Date | null,
): Date | null {
  const now = new Date()

  if (scheduleType === 'once') {
    return startsAt
  }

  if (startsAt.getTime() > now.getTime()) {
    return checkEndDate(startsAt, endDate)
  }

  const intervalMs = getIntervalMs(scheduleType, startsAt)

  if (scheduleType === 'monthly') {
    return computeNextMonthly(startsAt, endDate)
  }

  const elapsed = now.getTime() - startsAt.getTime()
  const periods = Math.ceil(elapsed / intervalMs)
  const next = new Date(startsAt.getTime() + periods * intervalMs)

  return checkEndDate(next, endDate)
}

function getIntervalMs(scheduleType: ScheduleType, _startsAt: Date): number {
  const week = 7 * 24 * 60 * 60 * 1000
  switch (scheduleType) {
    case 'weekly':
      return week
    case 'biweekly':
      return 2 * week
    default:
      return week
  }
}

function computeNextMonthly(startsAt: Date, endDate: Date | null): Date | null {
  const now = new Date()
  const dayOfMonth = startsAt.getDate()
  const hours = startsAt.getHours()
  const minutes = startsAt.getMinutes()

  let candidate = new Date(now.getFullYear(), now.getMonth(), dayOfMonth, hours, minutes, 0, 0)

  if (candidate.getTime() <= now.getTime()) {
    candidate = new Date(now.getFullYear(), now.getMonth() + 1, dayOfMonth, hours, minutes, 0, 0)
  }

  return checkEndDate(candidate, endDate)
}

function checkEndDate(date: Date, endDate: Date | null): Date | null {
  if (!endDate) return date
  if (date.getTime() > endDate.getTime()) return null
  return date
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/server && pnpm test -- --run tests/next-occurrence.test.ts`
Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/gathering/next-occurrence.ts apps/server/tests/next-occurrence.test.ts
git commit -m "feat(server): add next occurrence computation for gathering schedules"
```

---

## Task 9: Game tRPC Router

**Files:**
- Create: `apps/server/src/trpc/game.ts`
- Modify: `apps/server/src/trpc/router.ts`

- [ ] **Step 1: Write game router tests**

Create `apps/server/tests/game.test.ts`:

```typescript
import { afterAll, afterEach, describe, expect, it } from 'vitest'
import { cleanup, createTestCaller, db, seedGames } from './helpers.js'

afterEach(async () => {
  await cleanup()
})

afterAll(async () => {
  await db.destroy()
})

describe('game.list', () => {
  it('returns all seeded games', async () => {
    await seedGames()
    const { caller } = await createTestCaller()

    const games = await caller.game.list({})
    expect(games.length).toBeGreaterThan(0)
  })

  it('filters by game type', async () => {
    await seedGames()
    const { caller } = await createTestCaller()

    const ttrpgs = await caller.game.list({ type: 'ttrpg' })
    expect(ttrpgs.length).toBeGreaterThan(0)
    expect(ttrpgs.every((g) => g.type === 'ttrpg')).toBe(true)
  })
})

describe('game.getById', () => {
  it('returns a game by id', async () => {
    await seedGames()
    const { caller } = await createTestCaller()

    const games = await caller.game.list({})
    const game = await caller.game.getById({ id: games[0].id })

    expect(game.name).toBe(games[0].name)
  })

  it('throws NOT_FOUND for invalid id', async () => {
    const { caller } = await createTestCaller()

    await expect(
      caller.game.getById({ id: '00000000-0000-0000-0000-000000000000' }),
    ).rejects.toThrow(
      expect.objectContaining({ code: 'NOT_FOUND' }),
    )
  })
})
```

- [ ] **Step 2: Update test helpers**

Add to `apps/server/tests/helpers.ts`:

```typescript
export async function seedGames() {
  const games = [
    { name: 'Catan', type: 'board_game' as const, description: 'Trade and build.', min_players: 3, max_players: 4 },
    { name: 'D&D 5e', type: 'ttrpg' as const, description: 'Classic TTRPG.', min_players: 3, max_players: 6 },
    { name: 'Magic: The Gathering', type: 'card_game' as const, description: 'Card battler.', min_players: 2, max_players: 4 },
  ]
  return db.insertInto('game').values(games).returningAll().execute()
}
```

Update the `cleanup()` function to also clean game-related tables:

```typescript
export async function cleanup() {
  await db.deleteFrom('gathering_game').execute()
  await db.deleteFrom('gathering').execute()
  await db.deleteFrom('game').execute()
  await db.deleteFrom('users').execute()
  const keys = await redis.keys('session:*')
  if (keys.length > 0) await redis.del(...keys)
}
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd apps/server && pnpm test -- --run tests/game.test.ts`
Expected: FAIL — router not found.

- [ ] **Step 4: Write game router**

```typescript
// apps/server/src/trpc/game.ts
import { TRPCError } from '@trpc/server'
import { gameTypeSchema } from '@game-finder/contracts/game'
import { z } from 'zod'
import { createRouter, publicProcedure } from './init.js'

export const gameRouter = createRouter({
  list: publicProcedure
    .input(z.object({ type: gameTypeSchema.optional() }))
    .query(async ({ input, ctx }) => {
      let query = ctx.db.selectFrom('game').selectAll().orderBy('name', 'asc')

      if (input.type) {
        query = query.where('type', '=', input.type)
      }

      const games = await query.execute()

      return games.map((g) => ({
        id: g.id,
        name: g.name,
        type: g.type,
        description: g.description,
        minPlayers: g.min_players,
        maxPlayers: g.max_players,
        imageUrl: g.image_url,
        createdAt: g.created_at,
        updatedAt: g.updated_at,
      }))
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const game = await ctx.db
        .selectFrom('game')
        .selectAll()
        .where('id', '=', input.id)
        .executeTakeFirst()

      if (!game) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Game not found' })
      }

      return {
        id: game.id,
        name: game.name,
        type: game.type,
        description: game.description,
        minPlayers: game.min_players,
        maxPlayers: game.max_players,
        imageUrl: game.image_url,
        createdAt: game.created_at,
        updatedAt: game.updated_at,
      }
    }),
})
```

- [ ] **Step 5: Register game router**

Update `apps/server/src/trpc/router.ts`:

```typescript
import { authRouter } from './auth.js'
import { gameRouter } from './game.js'
import { createRouter, publicProcedure } from './init.js'

export const appRouter = createRouter({
  health: createRouter({
    check: publicProcedure.query(() => {
      return { status: 'ok' as const }
    }),
  }),
  auth: authRouter,
  game: gameRouter,
})

export type AppRouter = typeof appRouter
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd apps/server && pnpm test -- --run tests/game.test.ts`
Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/server/src/trpc/game.ts apps/server/src/trpc/router.ts apps/server/tests/game.test.ts apps/server/tests/helpers.ts
git commit -m "feat(server): add game tRPC router with list and getById"
```

---

## Task 10: Gathering tRPC Router

**Files:**
- Create: `apps/server/src/trpc/gathering.ts`
- Modify: `apps/server/src/trpc/router.ts`

- [ ] **Step 1: Write gathering router tests**

Create `apps/server/tests/gathering.test.ts`:

```typescript
import { afterAll, afterEach, describe, expect, it } from 'vitest'
import {
  cleanup,
  createAuthenticatedCaller,
  createTestCaller,
  createTestUser,
  db,
  redis,
  seedGames,
} from './helpers.js'

afterEach(async () => {
  await cleanup()
})

afterAll(async () => {
  await db.destroy()
  redis.disconnect()
})

const VALID_GATHERING_INPUT = {
  title: 'Friday Game Night',
  zipCode: '90210',
  scheduleType: 'weekly' as const,
  startsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  description: '## Come play games!\n\nBring snacks.',
}

describe('gathering.create', () => {
  it('creates a gathering with games', async () => {
    const user = await createTestUser()
    const games = await seedGames()
    const { caller } = await createAuthenticatedCaller(user.id)

    const result = await caller.gathering.create({
      ...VALID_GATHERING_INPUT,
      gameIds: [games[0].id, games[1].id],
    })

    expect(result.title).toBe('Friday Game Night')
    expect(result.games).toHaveLength(2)
    expect(result.nextOccurrenceAt).not.toBeNull()
  })

  it('rejects unauthenticated request', async () => {
    const games = await seedGames()
    const { caller } = await createTestCaller()

    await expect(
      caller.gathering.create({
        ...VALID_GATHERING_INPUT,
        gameIds: [games[0].id],
      }),
    ).rejects.toThrow(
      expect.objectContaining({ code: 'UNAUTHORIZED' }),
    )
  })

  it('rejects invalid game IDs', async () => {
    const user = await createTestUser()
    const { caller } = await createAuthenticatedCaller(user.id)

    await expect(
      caller.gathering.create({
        ...VALID_GATHERING_INPUT,
        gameIds: ['00000000-0000-0000-0000-000000000000'],
      }),
    ).rejects.toThrow(
      expect.objectContaining({ code: 'BAD_REQUEST' }),
    )
  })
})

describe('gathering.update', () => {
  it('updates gathering fields and games', async () => {
    const user = await createTestUser()
    const games = await seedGames()
    const { caller } = await createAuthenticatedCaller(user.id)

    const created = await caller.gathering.create({
      ...VALID_GATHERING_INPUT,
      gameIds: [games[0].id],
    })

    const updated = await caller.gathering.update({
      id: created.id,
      title: 'Saturday Game Night',
      gameIds: [games[1].id, games[2].id],
    })

    expect(updated.title).toBe('Saturday Game Night')
    expect(updated.games).toHaveLength(2)
  })

  it('rejects non-owner', async () => {
    const owner = await createTestUser({ email: 'owner@test.com' })
    const other = await createTestUser({ email: 'other@test.com' })
    const games = await seedGames()
    const { caller: ownerCaller } = await createAuthenticatedCaller(owner.id)

    const created = await ownerCaller.gathering.create({
      ...VALID_GATHERING_INPUT,
      gameIds: [games[0].id],
    })

    const { caller: otherCaller } = await createAuthenticatedCaller(other.id)
    await expect(
      otherCaller.gathering.update({ id: created.id, title: 'Hijacked' }),
    ).rejects.toThrow(
      expect.objectContaining({ code: 'FORBIDDEN' }),
    )
  })
})

describe('gathering.delete', () => {
  it('deletes gathering and join rows', async () => {
    const user = await createTestUser()
    const games = await seedGames()
    const { caller } = await createAuthenticatedCaller(user.id)

    const created = await caller.gathering.create({
      ...VALID_GATHERING_INPUT,
      gameIds: [games[0].id],
    })

    const result = await caller.gathering.delete({ id: created.id })
    expect(result.success).toBe(true)

    await expect(
      caller.gathering.getById({ id: created.id }),
    ).rejects.toThrow(
      expect.objectContaining({ code: 'NOT_FOUND' }),
    )
  })

  it('rejects non-owner', async () => {
    const owner = await createTestUser({ email: 'owner@test.com' })
    const other = await createTestUser({ email: 'other@test.com' })
    const games = await seedGames()
    const { caller: ownerCaller } = await createAuthenticatedCaller(owner.id)

    const created = await ownerCaller.gathering.create({
      ...VALID_GATHERING_INPUT,
      gameIds: [games[0].id],
    })

    const { caller: otherCaller } = await createAuthenticatedCaller(other.id)
    await expect(
      otherCaller.gathering.delete({ id: created.id }),
    ).rejects.toThrow(
      expect.objectContaining({ code: 'FORBIDDEN' }),
    )
  })
})

describe('gathering.close', () => {
  it('sets status to closed', async () => {
    const user = await createTestUser()
    const games = await seedGames()
    const { caller } = await createAuthenticatedCaller(user.id)

    const created = await caller.gathering.create({
      ...VALID_GATHERING_INPUT,
      gameIds: [games[0].id],
    })

    const closed = await caller.gathering.close({ id: created.id })
    expect(closed.status).toBe('closed')
  })
})

describe('gathering.getById', () => {
  it('returns gathering with games and host info', async () => {
    const user = await createTestUser({ displayName: 'GameHost' })
    const games = await seedGames()
    const { caller } = await createAuthenticatedCaller(user.id)

    const created = await caller.gathering.create({
      ...VALID_GATHERING_INPUT,
      gameIds: [games[0].id, games[1].id],
    })

    const { caller: publicCaller } = await createTestCaller()
    const detail = await publicCaller.gathering.getById({ id: created.id })

    expect(detail.title).toBe('Friday Game Night')
    expect(detail.host.displayName).toBe('GameHost')
    expect(detail.games).toHaveLength(2)
  })

  it('throws NOT_FOUND for missing gathering', async () => {
    const { caller } = await createTestCaller()
    await expect(
      caller.gathering.getById({ id: '00000000-0000-0000-0000-000000000000' }),
    ).rejects.toThrow(
      expect.objectContaining({ code: 'NOT_FOUND' }),
    )
  })
})

describe('gathering.listByHost', () => {
  it('returns only the current user gatherings', async () => {
    const user1 = await createTestUser({ email: 'host1@test.com' })
    const user2 = await createTestUser({ email: 'host2@test.com' })
    const games = await seedGames()

    const { caller: caller1 } = await createAuthenticatedCaller(user1.id)
    await caller1.gathering.create({ ...VALID_GATHERING_INPUT, gameIds: [games[0].id] })
    await caller1.gathering.create({ ...VALID_GATHERING_INPUT, title: 'Second', gameIds: [games[1].id] })

    const { caller: caller2 } = await createAuthenticatedCaller(user2.id)
    await caller2.gathering.create({ ...VALID_GATHERING_INPUT, title: 'Other Host', gameIds: [games[0].id] })

    const list = await caller1.gathering.listByHost()
    expect(list).toHaveLength(2)
    expect(list.every((g) => g.hostId === user1.id)).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/server && pnpm test -- --run tests/gathering.test.ts`
Expected: FAIL — router not found.

- [ ] **Step 3: Write gathering router**

```typescript
// apps/server/src/trpc/gathering.ts
import { TRPCError } from '@trpc/server'
import {
  createGatheringSchema,
  updateGatheringSchema,
} from '@game-finder/contracts/gathering'
import { z } from 'zod'
import { computeNextOccurrence } from '../gathering/next-occurrence.js'
import { createRouter, protectedProcedure, publicProcedure } from './init.js'

function serializeGathering(g: Record<string, unknown>) {
  return {
    id: g.id as string,
    hostId: g.host_id as string,
    title: g.title as string,
    description: g.description as string,
    zipCode: g.zip_code as string,
    scheduleType: g.schedule_type as string,
    startsAt: g.starts_at as Date,
    endDate: (g.end_date as Date) ?? null,
    durationMinutes: (g.duration_minutes as number) ?? null,
    maxPlayers: (g.max_players as number) ?? null,
    status: g.status as string,
    nextOccurrenceAt: (g.next_occurrence_at as Date) ?? null,
    createdAt: g.created_at as Date,
    updatedAt: g.updated_at as Date,
  }
}

export const gatheringRouter = createRouter({
  create: protectedProcedure
    .input(createGatheringSchema)
    .mutation(async ({ input, ctx }) => {
      const validGames = await ctx.db
        .selectFrom('game')
        .select('id')
        .where('id', 'in', input.gameIds)
        .execute()

      if (validGames.length !== input.gameIds.length) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'One or more games not found',
        })
      }

      const nextOccurrenceAt = computeNextOccurrence(
        input.scheduleType,
        new Date(input.startsAt),
        input.endDate ? new Date(input.endDate) : null,
      )

      const gathering = await ctx.db
        .insertInto('gathering')
        .values({
          host_id: ctx.userId,
          title: input.title,
          description: input.description,
          zip_code: input.zipCode,
          schedule_type: input.scheduleType,
          starts_at: new Date(input.startsAt),
          end_date: input.endDate ? new Date(input.endDate) : null,
          duration_minutes: input.durationMinutes ?? null,
          max_players: input.maxPlayers ?? null,
          next_occurrence_at: nextOccurrenceAt,
        })
        .returningAll()
        .executeTakeFirstOrThrow()

      if (input.gameIds.length > 0) {
        await ctx.db
          .insertInto('gathering_game')
          .values(input.gameIds.map((gameId) => ({
            gathering_id: gathering.id,
            game_id: gameId,
          })))
          .execute()
      }

      const games = await ctx.db
        .selectFrom('game')
        .selectAll()
        .where('id', 'in', input.gameIds)
        .execute()

      return {
        ...serializeGathering(gathering),
        games: games.map((g) => ({
          id: g.id,
          name: g.name,
          type: g.type,
        })),
      }
    }),

  update: protectedProcedure
    .input(updateGatheringSchema)
    .mutation(async ({ input, ctx }) => {
      const existing = await ctx.db
        .selectFrom('gathering')
        .selectAll()
        .where('id', '=', input.id)
        .executeTakeFirst()

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Gathering not found' })
      }

      if (existing.host_id !== ctx.userId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Not authorized' })
      }

      const updates: Record<string, unknown> = { updated_at: new Date() }
      if (input.title !== undefined) updates.title = input.title
      if (input.description !== undefined) updates.description = input.description
      if (input.zipCode !== undefined) updates.zip_code = input.zipCode
      if (input.scheduleType !== undefined) updates.schedule_type = input.scheduleType
      if (input.startsAt !== undefined) updates.starts_at = new Date(input.startsAt)
      if (input.endDate !== undefined) updates.end_date = input.endDate ? new Date(input.endDate) : null
      if (input.durationMinutes !== undefined) updates.duration_minutes = input.durationMinutes
      if (input.maxPlayers !== undefined) updates.max_players = input.maxPlayers

      const scheduleType = input.scheduleType ?? existing.schedule_type
      const startsAt = input.startsAt ? new Date(input.startsAt) : existing.starts_at
      const endDate = input.endDate !== undefined
        ? (input.endDate ? new Date(input.endDate) : null)
        : existing.end_date
      updates.next_occurrence_at = computeNextOccurrence(scheduleType, startsAt, endDate)

      const updated = await ctx.db
        .updateTable('gathering')
        .set(updates)
        .where('id', '=', input.id)
        .returningAll()
        .executeTakeFirstOrThrow()

      if (input.gameIds) {
        await ctx.db.deleteFrom('gathering_game').where('gathering_id', '=', input.id).execute()
        if (input.gameIds.length > 0) {
          const validGames = await ctx.db
            .selectFrom('game')
            .select('id')
            .where('id', 'in', input.gameIds)
            .execute()
          if (validGames.length !== input.gameIds.length) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'One or more games not found' })
          }
          await ctx.db
            .insertInto('gathering_game')
            .values(input.gameIds.map((gameId) => ({
              gathering_id: input.id,
              game_id: gameId,
            })))
            .execute()
        }
      }

      const gameRows = await ctx.db
        .selectFrom('gathering_game')
        .innerJoin('game', 'game.id', 'gathering_game.game_id')
        .select(['game.id', 'game.name', 'game.type'])
        .where('gathering_game.gathering_id', '=', input.id)
        .execute()

      return {
        ...serializeGathering(updated),
        games: gameRows.map((g) => ({ id: g.id, name: g.name, type: g.type })),
      }
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const existing = await ctx.db
        .selectFrom('gathering')
        .select(['id', 'host_id'])
        .where('id', '=', input.id)
        .executeTakeFirst()

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Gathering not found' })
      }
      if (existing.host_id !== ctx.userId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Not authorized' })
      }

      await ctx.db.deleteFrom('gathering').where('id', '=', input.id).execute()
      return { success: true }
    }),

  close: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const existing = await ctx.db
        .selectFrom('gathering')
        .selectAll()
        .where('id', '=', input.id)
        .executeTakeFirst()

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Gathering not found' })
      }
      if (existing.host_id !== ctx.userId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Not authorized' })
      }

      const updated = await ctx.db
        .updateTable('gathering')
        .set({ status: 'closed', updated_at: new Date() })
        .where('id', '=', input.id)
        .returningAll()
        .executeTakeFirstOrThrow()

      return serializeGathering(updated)
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const gathering = await ctx.db
        .selectFrom('gathering')
        .innerJoin('users', 'users.id', 'gathering.host_id')
        .select([
          'gathering.id',
          'gathering.host_id',
          'gathering.title',
          'gathering.description',
          'gathering.zip_code',
          'gathering.schedule_type',
          'gathering.starts_at',
          'gathering.end_date',
          'gathering.duration_minutes',
          'gathering.max_players',
          'gathering.status',
          'gathering.next_occurrence_at',
          'gathering.created_at',
          'gathering.updated_at',
          'users.display_name as host_display_name',
        ])
        .where('gathering.id', '=', input.id)
        .executeTakeFirst()

      if (!gathering) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Gathering not found' })
      }

      const games = await ctx.db
        .selectFrom('gathering_game')
        .innerJoin('game', 'game.id', 'gathering_game.game_id')
        .selectAll('game')
        .where('gathering_game.gathering_id', '=', input.id)
        .execute()

      return {
        ...serializeGathering(gathering),
        host: {
          id: gathering.host_id,
          displayName: gathering.host_display_name,
        },
        games: games.map((g) => ({
          id: g.id,
          name: g.name,
          type: g.type,
          description: g.description,
          minPlayers: g.min_players,
          maxPlayers: g.max_players,
          imageUrl: g.image_url,
        })),
      }
    }),

  listByHost: protectedProcedure.query(async ({ ctx }) => {
    const gatherings = await ctx.db
      .selectFrom('gathering')
      .selectAll()
      .where('host_id', '=', ctx.userId)
      .orderBy('created_at', 'desc')
      .execute()

    return gatherings.map((g) => serializeGathering(g))
  }),
})
```

- [ ] **Step 4: Register gathering router**

Add to `apps/server/src/trpc/router.ts`:

```typescript
import { authRouter } from './auth.js'
import { gameRouter } from './game.js'
import { gatheringRouter } from './gathering.js'
import { createRouter, publicProcedure } from './init.js'

export const appRouter = createRouter({
  health: createRouter({
    check: publicProcedure.query(() => {
      return { status: 'ok' as const }
    }),
  }),
  auth: authRouter,
  game: gameRouter,
  gathering: gatheringRouter,
})

export type AppRouter = typeof appRouter
```

- [ ] **Step 5: Run all tests**

Run: `cd apps/server && pnpm test`
Expected: All tests PASS (game, gathering, next-occurrence, auth, health).

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/trpc/gathering.ts apps/server/src/trpc/router.ts apps/server/tests/gathering.test.ts apps/server/tests/helpers.ts
git commit -m "feat(server): add gathering tRPC router with full CRUD"
```

---

## Task 11: Shadcn UI Components

**Files:**
- Create: `packages/ui/src/components/select.tsx`
- Create: `packages/ui/src/components/badge.tsx`
- Create: `packages/ui/src/components/textarea.tsx`
- Create: `packages/ui/src/components/table.tsx`

- [ ] **Step 1: Add Shadcn components via CLI**

Run these from the `packages/ui` directory using the shadcn CLI (components.json is at `packages/ui/components.json`):

```bash
cd packages/ui && pnpm dlx shadcn@latest add select badge textarea table
```

This generates the component files following the project's shadcn config (new-york style, no RSC, Tailwind v4 CSS variables).

- [ ] **Step 2: Verify components exist and export correctly**

Check that all four files exist in `packages/ui/src/components/`. Verify they follow the same pattern as existing `button.tsx` — named exports, `cn()` utility from `@game-finder/ui/lib/utils`.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/components/select.tsx packages/ui/src/components/badge.tsx packages/ui/src/components/textarea.tsx packages/ui/src/components/table.tsx
git commit -m "feat(ui): add Select, Badge, Textarea, Table shadcn components"
```

---

## Task 12: Install Web Dependencies

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Install CodeMirror and Markdown rendering dependencies**

```bash
cd apps/web && pnpm add codemirror @codemirror/lang-markdown @codemirror/language @codemirror/state @codemirror/view @codemirror/theme-one-dark @replit/codemirror-vim react-markdown
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "feat(web): add CodeMirror 6 and react-markdown dependencies"
```

---

## Task 13: Markdown Editor Component

**Files:**
- Create: `apps/web/app/components/markdown-editor.tsx`

- [ ] **Step 1: Write the Markdown editor component**

```typescript
// apps/web/app/components/markdown-editor.tsx
import { markdown } from '@codemirror/lang-markdown'
import { EditorState } from '@codemirror/state'
import { oneDark } from '@codemirror/theme-one-dark'
import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import { defaultKeymap } from '@codemirror/commands'
import { useCallback, useEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function MarkdownEditor({ value, onChange, placeholder }: MarkdownEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const [vimEnabled, setVimEnabled] = useState(false)
  const [vimModule, setVimModule] = useState<typeof import('@replit/codemirror-vim') | null>(null)

  useEffect(() => {
    import('@replit/codemirror-vim').then(setVimModule)
  }, [])

  const createEditor = useCallback(() => {
    if (!editorRef.current) return

    if (viewRef.current) {
      viewRef.current.destroy()
    }

    const extensions = [
      lineNumbers(),
      markdown(),
      oneDark,
      keymap.of(defaultKeymap),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onChange(update.state.doc.toString())
        }
      }),
      EditorView.theme({
        '&': { height: '100%' },
        '.cm-scroller': { overflow: 'auto' },
      }),
    ]

    if (vimEnabled && vimModule) {
      extensions.unshift(vimModule.vim())
    }

    if (placeholder) {
      extensions.push(EditorView.contentAttributes.of({ 'aria-placeholder': placeholder }))
    }

    const state = EditorState.create({
      doc: value,
      extensions,
    })

    viewRef.current = new EditorView({
      state,
      parent: editorRef.current,
    })
  }, [vimEnabled, vimModule, placeholder])

  useEffect(() => {
    createEditor()
    return () => viewRef.current?.destroy()
  }, [createEditor])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const currentDoc = view.state.doc.toString()
    if (currentDoc !== value) {
      view.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: value },
      })
    }
  }, [value])

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      onChange(text)
    }
    reader.readAsText(file)
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-0 overflow-hidden rounded-md border border-border">
        <div ref={editorRef} className="min-h-[300px] bg-background" />
        <div className="min-h-[300px] overflow-auto border-l border-border bg-card p-4 prose prose-invert prose-sm max-w-none">
          {value ? (
            <Markdown>{value}</Markdown>
          ) : (
            <p className="text-muted-foreground">Preview will appear here...</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <label className="cursor-pointer rounded border border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          Upload .md / .txt
          <input
            type="file"
            accept=".md,.txt"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>
        <button
          type="button"
          onClick={() => setVimEnabled(!vimEnabled)}
          className="rounded border border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          vim mode: {vimEnabled ? 'on' : 'off'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify it renders**

Start the dev server and navigate to a test page to confirm the editor renders without errors. Check:
- Editor pane loads with monospace font
- Preview pane renders Markdown
- Vim mode toggle works
- File upload populates the editor

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/components/markdown-editor.tsx
git commit -m "feat(web): add CodeMirror 6 markdown editor with vim mode and preview"
```

---

## Task 14: Gathering Form Component

**Files:**
- Create: `apps/web/app/components/gathering-form.tsx`

- [ ] **Step 1: Write the shared gathering form**

This component is used by both create and edit pages. It takes optional initial data for edit mode.

```typescript
// apps/web/app/components/gathering-form.tsx
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
import { Badge } from '@game-finder/ui/components/badge'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTRPC } from '../trpc/provider.js'
import { MarkdownEditor } from './markdown-editor.js'

interface GatheringFormData {
  title: string
  gameIds: string[]
  zipCode: string
  scheduleType: 'once' | 'weekly' | 'biweekly' | 'monthly'
  startsAt: string
  endDate: string
  durationMinutes: string
  maxPlayers: string
  description: string
}

interface GatheringFormProps {
  initialData?: Partial<GatheringFormData>
  onSubmit: (data: GatheringFormData) => void
  isPending: boolean
  submitLabel: string
  errors?: Record<string, string>
}

const SCHEDULE_OPTIONS = [
  { value: 'once', label: 'One-time' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Biweekly' },
  { value: 'monthly', label: 'Monthly' },
]

export function GatheringForm({
  initialData,
  onSubmit,
  isPending,
  submitLabel,
  errors = {},
}: GatheringFormProps) {
  const trpc = useTRPC()
  const { data: games = [] } = useQuery(trpc.game.list.queryOptions({}))

  const [title, setTitle] = useState(initialData?.title ?? '')
  const [gameIds, setGameIds] = useState<string[]>(initialData?.gameIds ?? [])
  const [zipCode, setZipCode] = useState(initialData?.zipCode ?? '')
  const [scheduleType, setScheduleType] = useState(initialData?.scheduleType ?? 'once')
  const [startsAt, setStartsAt] = useState(initialData?.startsAt ?? '')
  const [endDate, setEndDate] = useState(initialData?.endDate ?? '')
  const [durationMinutes, setDurationMinutes] = useState(initialData?.durationMinutes ?? '')
  const [maxPlayers, setMaxPlayers] = useState(initialData?.maxPlayers ?? '')
  const [description, setDescription] = useState(initialData?.description ?? '')

  const toggleGame = (gameId: string) => {
    setGameIds((prev) =>
      prev.includes(gameId)
        ? prev.filter((id) => id !== gameId)
        : [...prev, gameId],
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      title,
      gameIds,
      zipCode,
      scheduleType: scheduleType as GatheringFormData['scheduleType'],
      startsAt,
      endDate,
      durationMinutes,
      maxPlayers,
      description,
    })
  }

  return (
    <Card className="border-border bg-card/80 backdrop-blur-sm">
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <CardTitle className="font-display text-xl font-bold tracking-tight text-foreground">
            {submitLabel === 'Create Gathering' ? 'Create a Gathering' : 'Edit Gathering'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {errors.form && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5">
              <p className="text-sm text-destructive-foreground">{errors.form}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="title" className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Title</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Friday Board Game Night" required />
              {errors.title && <p className="text-sm text-destructive">{errors.title}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Games</Label>
              <div className="flex flex-wrap gap-1.5 rounded-md border border-border p-2 min-h-[40px]">
                {games.map((game) => (
                  <Badge
                    key={game.id}
                    variant={gameIds.includes(game.id) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => toggleGame(game.id)}
                  >
                    {game.name}
                  </Badge>
                ))}
              </div>
              {errors.gameIds && <p className="text-sm text-destructive">{errors.gameIds}</p>}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="zipCode" className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Zip Code</Label>
              <Input id="zipCode" value={zipCode} onChange={(e) => setZipCode(e.target.value)} placeholder="90210" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="scheduleType" className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Schedule</Label>
              <select
                id="scheduleType"
                value={scheduleType}
                onChange={(e) => setScheduleType(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors"
              >
                {SCHEDULE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="startsAt" className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Date & Time</Label>
              <Input id="startsAt" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {scheduleType !== 'once' && (
              <div className="space-y-1.5">
                <Label htmlFor="endDate" className="text-xs font-medium tracking-wide text-muted-foreground uppercase">End Date</Label>
                <Input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="durationMinutes" className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Duration (min)</Label>
              <Input id="durationMinutes" type="number" value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} placeholder="180" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="maxPlayers" className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Max Players</Label>
              <Input id="maxPlayers" type="number" value={maxPlayers} onChange={(e) => setMaxPlayers(e.target.value)} placeholder="6" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Description (Markdown)</Label>
            <MarkdownEditor value={description} onChange={setDescription} placeholder="Describe your gathering..." />
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? 'Saving...' : submitLabel}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/components/gathering-form.tsx
git commit -m "feat(web): add shared GatheringForm component"
```

---

## Task 15: Create Gathering Page

**Files:**
- Create: `apps/web/app/routes/gatherings.new.tsx`

- [ ] **Step 1: Write the create gathering route**

```typescript
// apps/web/app/routes/gatherings.new.tsx
import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { GatheringForm } from '../components/gathering-form.js'
import { useTRPC } from '../trpc/provider.js'

export default function NewGathering() {
  const navigate = useNavigate()
  const trpc = useTRPC()
  const [errors, setErrors] = useState<Record<string, string>>({})

  const { data: user, isLoading } = useQuery(trpc.auth.me.queryOptions())

  useEffect(() => {
    if (!isLoading && !user) navigate('/login')
  }, [user, isLoading, navigate])

  const createMutation = useMutation(
    trpc.gathering.create.mutationOptions({
      onSuccess: (data) => {
        navigate(`/gatherings/${data.id}`)
      },
      onError: (error) => {
        setErrors({ form: error.message })
      },
    }),
  )

  const handleSubmit = (data: {
    title: string
    gameIds: string[]
    zipCode: string
    scheduleType: 'once' | 'weekly' | 'biweekly' | 'monthly'
    startsAt: string
    endDate: string
    durationMinutes: string
    maxPlayers: string
    description: string
  }) => {
    setErrors({})
    createMutation.mutate({
      title: data.title,
      gameIds: data.gameIds,
      zipCode: data.zipCode,
      scheduleType: data.scheduleType,
      startsAt: new Date(data.startsAt).toISOString(),
      endDate: data.endDate ? new Date(data.endDate).toISOString() : null,
      durationMinutes: data.durationMinutes ? Number(data.durationMinutes) : null,
      maxPlayers: data.maxPlayers ? Number(data.maxPlayers) : null,
      description: data.description,
    })
  }

  if (isLoading) return null

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <GatheringForm
        onSubmit={handleSubmit}
        isPending={createMutation.isPending}
        submitLabel="Create Gathering"
        errors={errors}
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/routes/gatherings.new.tsx
git commit -m "feat(web): add create gathering page"
```

---

## Task 16: Gathering Details Page

**Files:**
- Create: `apps/web/app/routes/gatherings.$id.tsx`

- [ ] **Step 1: Write the details page**

```typescript
// apps/web/app/routes/gatherings.$id.tsx
import { Badge } from '@game-finder/ui/components/badge'
import { Button } from '@game-finder/ui/components/button'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router'
import Markdown from 'react-markdown'
import type { Route } from './+types/gatherings.$id.js'
import { useTRPC } from '../trpc/provider.js'

function formatSchedule(scheduleType: string, startsAt: Date): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const day = days[new Date(startsAt).getDay()]
  const time = new Date(startsAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

  switch (scheduleType) {
    case 'once': return `One-time — ${new Date(startsAt).toLocaleDateString()} at ${time}`
    case 'weekly': return `Weekly — ${day}s at ${time}`
    case 'biweekly': return `Every 2 weeks — ${day}s at ${time}`
    case 'monthly': return `Monthly — ${day}s at ${time}`
    default: return scheduleType
  }
}

export default function GatheringDetail({ params }: Route.ComponentProps) {
  const trpc = useTRPC()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: user } = useQuery(trpc.auth.me.queryOptions())
  const { data: gathering, isLoading } = useQuery(
    trpc.gathering.getById.queryOptions({ id: params.id }),
  )

  const closeMutation = useMutation(
    trpc.gathering.close.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.gathering.getById.queryOptions({ id: params.id }).queryKey })
      },
    }),
  )

  if (isLoading) {
    return <div className="mx-auto max-w-3xl px-6 py-8 text-muted-foreground">Loading...</div>
  }

  if (!gathering) {
    return <div className="mx-auto max-w-3xl px-6 py-8 text-muted-foreground">Gathering not found.</div>
  }

  const isOwner = user?.id === gathering.hostId

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">{gathering.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Hosted by <span className="font-medium text-primary">{gathering.host.displayName}</span>
          </p>
        </div>
        <Badge variant={gathering.status === 'active' ? 'default' : 'secondary'}>
          {gathering.status}
        </Badge>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 rounded-lg border border-border bg-card/50 p-4 sm:grid-cols-4">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Schedule</p>
          <p className="mt-1 text-sm text-foreground">{formatSchedule(gathering.scheduleType, gathering.startsAt)}</p>
        </div>
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Next Session</p>
          <p className="mt-1 text-sm text-foreground">
            {gathering.nextOccurrenceAt
              ? new Date(gathering.nextOccurrenceAt).toLocaleDateString()
              : 'Series ended'}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Location</p>
          <p className="mt-1 text-sm text-foreground">{gathering.zipCode}</p>
        </div>
        {gathering.maxPlayers && (
          <div>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Max Players</p>
            <p className="mt-1 text-sm text-foreground">{gathering.maxPlayers}</p>
          </div>
        )}
      </div>

      {gathering.games.length > 0 && (
        <div className="mb-6">
          <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">Games</p>
          <div className="flex flex-wrap gap-1.5">
            {gathering.games.map((game) => (
              <Badge key={game.id} variant="outline">{game.name}</Badge>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-border pt-6">
        <p className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">About this Gathering</p>
        <div className="prose prose-invert prose-sm max-w-none">
          <Markdown>{gathering.description}</Markdown>
        </div>
      </div>

      {isOwner && (
        <div className="mt-8 flex gap-3 border-t border-border pt-6">
          <Button variant="outline" asChild>
            <Link to={`/gatherings/${gathering.id}/edit`}>Edit</Link>
          </Button>
          {gathering.status === 'active' && (
            <Button
              variant="secondary"
              onClick={() => closeMutation.mutate({ id: gathering.id })}
              disabled={closeMutation.isPending}
            >
              {closeMutation.isPending ? 'Closing...' : 'Close Gathering'}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/routes/gatherings.\$id.tsx
git commit -m "feat(web): add gathering details page with markdown rendering"
```

---

## Task 17: Edit Gathering Page

**Files:**
- Create: `apps/web/app/routes/gatherings.$id.edit.tsx`

- [ ] **Step 1: Write the edit gathering route**

```typescript
// apps/web/app/routes/gatherings.$id.edit.tsx
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import type { Route } from './+types/gatherings.$id.edit.js'
import { GatheringForm } from '../components/gathering-form.js'
import { useTRPC } from '../trpc/provider.js'

export default function EditGathering({ params }: Route.ComponentProps) {
  const navigate = useNavigate()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [errors, setErrors] = useState<Record<string, string>>({})

  const { data: user, isLoading: userLoading } = useQuery(trpc.auth.me.queryOptions())
  const { data: gathering, isLoading: gatheringLoading } = useQuery(
    trpc.gathering.getById.queryOptions({ id: params.id }),
  )

  useEffect(() => {
    if (!userLoading && !user) navigate('/login')
  }, [user, userLoading, navigate])

  useEffect(() => {
    if (gathering && user && gathering.hostId !== user.id) {
      navigate(`/gatherings/${params.id}`)
    }
  }, [gathering, user, params.id, navigate])

  const updateMutation = useMutation(
    trpc.gathering.update.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: trpc.gathering.getById.queryOptions({ id: params.id }).queryKey })
        navigate(`/gatherings/${data.id}`)
      },
      onError: (error) => {
        setErrors({ form: error.message })
      },
    }),
  )

  if (userLoading || gatheringLoading) return null
  if (!gathering) return <div className="mx-auto max-w-3xl px-6 py-8 text-muted-foreground">Gathering not found.</div>

  const formatDateTimeLocal = (date: Date) => {
    const d = new Date(date)
    return d.toISOString().slice(0, 16)
  }

  const handleSubmit = (data: {
    title: string
    gameIds: string[]
    zipCode: string
    scheduleType: 'once' | 'weekly' | 'biweekly' | 'monthly'
    startsAt: string
    endDate: string
    durationMinutes: string
    maxPlayers: string
    description: string
  }) => {
    setErrors({})
    updateMutation.mutate({
      id: params.id,
      title: data.title,
      gameIds: data.gameIds,
      zipCode: data.zipCode,
      scheduleType: data.scheduleType,
      startsAt: new Date(data.startsAt).toISOString(),
      endDate: data.endDate ? new Date(data.endDate).toISOString() : null,
      durationMinutes: data.durationMinutes ? Number(data.durationMinutes) : null,
      maxPlayers: data.maxPlayers ? Number(data.maxPlayers) : null,
      description: data.description,
    })
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <GatheringForm
        initialData={{
          title: gathering.title,
          gameIds: gathering.games.map((g) => g.id),
          zipCode: gathering.zipCode,
          scheduleType: gathering.scheduleType as 'once' | 'weekly' | 'biweekly' | 'monthly',
          startsAt: formatDateTimeLocal(gathering.startsAt),
          endDate: gathering.endDate ? new Date(gathering.endDate).toISOString().slice(0, 10) : '',
          durationMinutes: gathering.durationMinutes?.toString() ?? '',
          maxPlayers: gathering.maxPlayers?.toString() ?? '',
          description: gathering.description,
        }}
        onSubmit={handleSubmit}
        isPending={updateMutation.isPending}
        submitLabel="Save Changes"
        errors={errors}
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/routes/gatherings.\$id.edit.tsx
git commit -m "feat(web): add edit gathering page"
```

---

## Task 18: Host Dashboard Page

**Files:**
- Create: `apps/web/app/routes/dashboard.tsx`

- [ ] **Step 1: Write the dashboard page**

```typescript
// apps/web/app/routes/dashboard.tsx
import { Badge } from '@game-finder/ui/components/badge'
import { Button } from '@game-finder/ui/components/button'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router'
import { useTRPC } from '../trpc/provider.js'

export default function Dashboard() {
  const navigate = useNavigate()
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const { data: user, isLoading: userLoading } = useQuery(trpc.auth.me.queryOptions())
  const { data: gatherings = [], isLoading: gatheringsLoading } = useQuery(
    trpc.gathering.listByHost.queryOptions(undefined, { enabled: !!user }),
  )

  useEffect(() => {
    if (!userLoading && !user) navigate('/login')
  }, [user, userLoading, navigate])

  const closeMutation = useMutation(
    trpc.gathering.close.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.gathering.listByHost.queryOptions().queryKey })
      },
    }),
  )

  const deleteMutation = useMutation(
    trpc.gathering.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.gathering.listByHost.queryOptions().queryKey })
      },
    }),
  )

  if (userLoading || gatheringsLoading) {
    return <div className="mx-auto max-w-4xl px-6 py-8 text-muted-foreground">Loading...</div>
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Your Gatherings</h1>
        <Button asChild>
          <Link to="/gatherings/new">+ New Gathering</Link>
        </Button>
      </div>

      {gatherings.length === 0 ? (
        <div className="rounded-lg border border-border bg-card/50 p-12 text-center">
          <p className="text-muted-foreground">You haven't created any gatherings yet.</p>
          <Button className="mt-4" asChild>
            <Link to="/gatherings/new">Create Your First Gathering</Link>
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="grid grid-cols-[2fr_1fr_1fr_auto] gap-4 border-b border-border bg-card/50 px-4 py-3">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Title</span>
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Next Session</span>
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Status</span>
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Actions</span>
          </div>
          {gatherings.map((gathering) => (
            <div key={gathering.id} className="grid grid-cols-[2fr_1fr_1fr_auto] gap-4 border-b border-border px-4 py-3 last:border-b-0 items-center">
              <Link to={`/gatherings/${gathering.id}`} className="text-sm font-medium text-foreground hover:text-primary transition-colors">
                {gathering.title}
              </Link>
              <span className="text-sm text-muted-foreground">
                {gathering.nextOccurrenceAt
                  ? new Date(gathering.nextOccurrenceAt).toLocaleDateString()
                  : '—'}
              </span>
              <Badge variant={gathering.status === 'active' ? 'default' : 'secondary'}>
                {gathering.status}
              </Badge>
              <div className="flex gap-2">
                <Link to={`/gatherings/${gathering.id}/edit`} className="text-xs text-primary hover:text-primary/80 transition-colors">
                  Edit
                </Link>
                {gathering.status === 'active' ? (
                  <button
                    type="button"
                    onClick={() => closeMutation.mutate({ id: gathering.id })}
                    disabled={closeMutation.isPending}
                    className="text-xs text-amber-500 hover:text-amber-400 transition-colors disabled:opacity-50"
                  >
                    Close
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Delete this gathering? This cannot be undone.')) {
                        deleteMutation.mutate({ id: gathering.id })
                      }
                    }}
                    disabled={deleteMutation.isPending}
                    className="text-xs text-destructive hover:text-destructive/80 transition-colors disabled:opacity-50"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/routes/dashboard.tsx
git commit -m "feat(web): add host dashboard page"
```

---

## Task 19: Routes & Nav Updates

**Files:**
- Modify: `apps/web/app/routes.ts`
- Modify: `apps/web/app/components/nav.tsx`

- [ ] **Step 1: Add new routes**

Update `apps/web/app/routes.ts`:

```typescript
import { type RouteConfig, index, route } from '@react-router/dev/routes'

export default [
  index('routes/home.tsx'),
  route('signup', 'routes/signup.tsx'),
  route('login', 'routes/login.tsx'),
  route('dashboard', 'routes/dashboard.tsx'),
  route('gatherings/new', 'routes/gatherings.new.tsx'),
  route('gatherings/:id', 'routes/gatherings.$id.tsx'),
  route('gatherings/:id/edit', 'routes/gatherings.$id.edit.tsx'),
] satisfies RouteConfig
```

- [ ] **Step 2: Add Dashboard link to nav**

In `apps/web/app/components/nav.tsx`, add a "Dashboard" link in the authenticated section (between display name and logout button):

```tsx
// Inside the `user ? (` branch, add before the logout button:
<Link
  to="/dashboard"
  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
>
  Dashboard
</Link>
```

- [ ] **Step 3: Verify navigation works**

Start dev server, log in, verify:
- Dashboard link appears in nav
- All routes resolve correctly
- Navigation between pages works

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/routes.ts apps/web/app/components/nav.tsx
git commit -m "feat(web): add gathering routes and dashboard nav link"
```

---

## Task 20: End-to-End Verification

- [ ] **Step 1: Run all server tests**

Run: `cd apps/server && pnpm test`
Expected: All tests pass (health, auth, game, gathering, next-occurrence).

- [ ] **Step 2: Run type checks**

Run: `pnpm turbo typecheck`
Expected: No type errors across all packages.

- [ ] **Step 3: Manual smoke test**

Start the full stack with `docker compose up` (or dev mode) and verify:

1. Register/login works (Epic 2)
2. Dashboard link appears in nav when logged in
3. Dashboard shows empty state with CTA
4. Create a gathering with title, games, schedule, and Markdown description
5. Verify gathering appears on dashboard
6. View the public details page — Markdown renders, games show as tags
7. Edit the gathering — change title and games
8. Close the gathering from dashboard
9. Delete a closed gathering from dashboard
10. Log out and verify details page is still viewable (public)
11. Verify non-owner cannot see edit/close buttons on details page

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix(web): address smoke test issues"
```

---

## Verification Checklist

| Check | Command |
|-------|---------|
| Server tests pass | `cd apps/server && pnpm test` |
| Type check passes | `pnpm turbo typecheck` |
| Migrations run | `pnpm --filter db migrate` |
| Seed runs | `pnpm --filter db seed` |
| Full stack starts | `docker compose up` |
| Create gathering works | Manual test via UI |
| Dashboard lists gatherings | Manual test via UI |
| Details page renders Markdown | Manual test via UI |
| Edit/close/delete work | Manual test via UI |
| Auth guards work | Manual test via UI |
| Owner-only checks work | Manual test with two accounts |
