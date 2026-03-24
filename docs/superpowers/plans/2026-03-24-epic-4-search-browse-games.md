# Epic 4: Search & Browse Games — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users search for nearby tabletop gatherings by ZIP code + radius, browse results as rich cards, filter by game type, and sort by distance or next session.

**Architecture:** Static ZIP code lookup table in PostgreSQL (~40k US ZIPs). Haversine formula in SQL computes distance. A single `gathering.search` tRPC query handles filtering, sorting, and pagination. The web app renders a search page with sidebar filters and URL-based state for shareable results.

**Tech Stack:** PostgreSQL (Haversine, ILIKE), Kysely, tRPC, React Router 7 (SSR), Tailwind, Shadcn (Checkbox, RadioGroup, Pagination)

**Depends on:** Epic 3 (Create & Manage Gatherings) must be merged first. This plan assumes the `gathering`, `game`, and `gathering_game` tables, the `gathering` and `game` tRPC routers, and the Epic 3 web routes all exist.

---

## File Structure

### Files to create

| File | Responsibility |
|------|---------------|
| `packages/db/src/migrations/005-create-zip-code-location.ts` | Migration: `zip_code_location` table |
| `packages/db/src/types/zip-code-location.ts` | TypeScript interface for the new table |
| `packages/db/src/seed-zip-codes.ts` | Seed script: load ~40k US ZIPs from CSV |
| `packages/db/data/us-zip-codes.csv` | Bundled CSV of US ZIP code coordinates |
| `packages/contracts/src/search.ts` | Zod schemas for search input/output |
| `apps/server/src/gathering/haversine.ts` | Haversine distance SQL expression builder |
| `apps/server/src/gathering/strip-markdown.ts` | Strip Markdown for description previews |
| `apps/server/tests/haversine.test.ts` | Unit tests for Haversine utility |
| `apps/server/tests/search.test.ts` | Integration tests for `gathering.search` |
| `apps/web/app/routes/search.tsx` | Search & Browse page |
| `packages/ui/src/components/checkbox.tsx` | Shadcn Checkbox component |
| `packages/ui/src/components/radio-group.tsx` | Shadcn RadioGroup component |
| `packages/ui/src/components/pagination.tsx` | Shadcn Pagination component |

### Files to modify

| File | Change |
|------|--------|
| `packages/db/src/types.ts` | Add `ZipCodeLocationTable`, register in `Database` |
| `packages/db/src/index.ts` | Export `ZipCodeLocationTable` type |
| `packages/db/package.json` | Add `seed:zip-codes` script |
| `packages/contracts/src/index.ts` | Add `export * from './search.js'` |
| `packages/contracts/package.json` | Add `"./search"` subpath export |
| `apps/server/src/trpc/gathering.ts` | Add `search` procedure |
| `apps/server/tests/helpers.ts` | Add `seedZipCodes()`, `createTestGathering()`, update `cleanup()` |
| `apps/web/app/routes.ts` | Add `/search` route |
| `apps/web/app/components/nav.tsx` | Add "Find Games" link |

---

## Task 1: Create ZIP code location migration and types

**Files:**
- Create: `packages/db/src/migrations/005-create-zip-code-location.ts`
- Modify: `packages/db/src/types.ts`
- Modify: `packages/db/src/index.ts`

- [ ] **Step 1: Create the migration file**

```typescript
// packages/db/src/migrations/005-create-zip-code-location.ts
import { type Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('zip_code_location')
    .addColumn('zip_code', 'varchar(5)', (col) => col.primaryKey())
    .addColumn('city', 'varchar(100)', (col) => col.notNull())
    .addColumn('state', 'varchar(2)', (col) => col.notNull())
    .addColumn('latitude', 'decimal(9,6)', (col) => col.notNull())
    .addColumn('longitude', 'decimal(9,6)', (col) => col.notNull())
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('zip_code_location').execute()
}
```

- [ ] **Step 2: Add the TypeScript interface to `packages/db/src/types.ts`**

Add `ZipCodeLocationTable` interface and register it in the `Database` interface:

```typescript
export interface ZipCodeLocationTable {
  zip_code: string
  city: string
  state: string
  latitude: number
  longitude: number
}
```

Add to the `Database` interface:

```typescript
export interface Database {
  users: UsersTable
  game: GameTable
  gathering: GatheringTable
  gathering_game: GatheringGameTable
  zip_code_location: ZipCodeLocationTable
}
```

- [ ] **Step 3: Export the new type from `packages/db/src/index.ts`**

Add `ZipCodeLocationTable` to the existing type exports:

```typescript
export type { Database, UsersTable, GameTable, GatheringTable, GatheringGameTable, ZipCodeLocationTable } from './types.js'
```

- [ ] **Step 4: Run the migration**

Run: `pnpm --filter @game-finder/db migrate`

Expected: Migration 005 runs successfully, `zip_code_location` table created.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/migrations/005-create-zip-code-location.ts packages/db/src/types.ts packages/db/src/index.ts
git commit -m "feat(db): add zip_code_location table migration and types"
```

---

## Task 2: Download and seed ZIP code data

**Files:**
- Create: `packages/db/data/us-zip-codes.csv`
- Create: `packages/db/src/seed-zip-codes.ts`
- Modify: `packages/db/package.json`

- [ ] **Step 1: Download the free US ZIP code CSV**

Download the SimpleMaps free US ZIP code database from https://simplemaps.com/data/us-zips (free version). The CSV has columns including `zip`, `lat`, `lng`, `city`, `state_id`. Place the downloaded file at `packages/db/data/us-zip-codes.csv`.

If SimpleMaps isn't available, any freely available US ZIP code dataset with ZIP, city, state, latitude, longitude columns works. The seed script (next step) parses the CSV, so adjust column names to match the source.

The file should have ~33k+ rows (~2-3 MB). This is small enough to commit to the repo for a prototype. Verify the CSV has the expected columns:

Run: `head -1 packages/db/data/us-zip-codes.csv`

Expected: Header row with zip, lat, lng, city, state_id (or similar column names).

- [ ] **Step 2: Create the seed script**

```typescript
// packages/db/src/seed-zip-codes.ts
import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'
import { resolve } from 'node:path'
import { createDb } from './client.js'

const CSV_PATH = resolve(import.meta.dirname, '../data/us-zip-codes.csv')

interface ZipRow {
  zip_code: string
  city: string
  state: string
  latitude: number
  longitude: number
}

function parseCsvLine(header: string[], line: string): Record<string, string> {
  const values: string[] = []
  let current = ''
  let inQuotes = false

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  values.push(current.trim())

  const record: Record<string, string> = {}
  for (let i = 0; i < header.length; i++) {
    record[header[i]] = values[i] ?? ''
  }
  return record
}

async function main() {
  const db = createDb()

  const existing = await db
    .selectFrom('zip_code_location')
    .select('zip_code')
    .limit(1)
    .executeTakeFirst()

  if (existing) {
    console.log('ZIP code data already seeded, skipping.')
    await db.destroy()
    return
  }

  console.log('Loading ZIP code data from CSV...')

  const rl = createInterface({
    input: createReadStream(CSV_PATH, 'utf-8'),
    crlfDelay: Number.POSITIVE_INFINITY,
  })

  let header: string[] = []
  const rows: ZipRow[] = []
  let lineNum = 0

  for await (const line of rl) {
    lineNum++
    if (lineNum === 1) {
      header = line.split(',').map((h) => h.replace(/"/g, '').trim())
      continue
    }

    const record = parseCsvLine(header, line)

    // Adapt column names to match your CSV source.
    // SimpleMaps uses: zip, lat, lng, city, state_id
    const zipCode = (record.zip ?? '').replace(/"/g, '').padStart(5, '0')
    const lat = Number.parseFloat(record.lat ?? '')
    const lng = Number.parseFloat(record.lng ?? '')
    const city = record.city ?? ''
    const state = record.state_id ?? ''

    if (zipCode.length !== 5 || Number.isNaN(lat) || Number.isNaN(lng) || !city || !state) {
      continue
    }

    rows.push({
      zip_code: zipCode,
      city,
      state,
      latitude: lat,
      longitude: lng,
    })
  }

  console.log(`Parsed ${rows.length} ZIP codes. Inserting...`)

  const BATCH_SIZE = 1000
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    await db.insertInto('zip_code_location').values(batch).execute()
  }

  console.log(`Seeded ${rows.length} ZIP codes.`)
  await db.destroy()
}

main().catch((err) => {
  console.error('Failed to seed ZIP codes:', err)
  process.exit(1)
})
```

- [ ] **Step 3: Add the seed script to `packages/db/package.json`**

Add to the `"scripts"` section:

```json
"seed:zip-codes": "tsx src/seed-zip-codes.ts"
```

- [ ] **Step 4: Run the seed**

Run: `pnpm --filter @game-finder/db seed:zip-codes`

Expected: "Parsed NNNNN ZIP codes. Inserting..." then "Seeded NNNNN ZIP codes." with 30k+ entries.

- [ ] **Step 5: Verify the seed data**

Run a quick spot check via psql or a test query. For example, ZIP 10001 (New York) should exist with lat/lng near 40.75/-73.99.

- [ ] **Step 6: Commit**

```bash
git add packages/db/data/us-zip-codes.csv packages/db/src/seed-zip-codes.ts packages/db/package.json
git commit -m "feat(db): add ZIP code seed script with US ZIP code data"
```

---

## Task 3: Add search validation schemas

**Files:**
- Create: `packages/contracts/src/search.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `packages/contracts/package.json`

- [ ] **Step 1: Create the search schemas**

```typescript
// packages/contracts/src/search.ts
import { z } from 'zod'
import { gameTypeSchema } from './game.js'

export const searchGatheringsSchema = z.object({
  zipCode: z.string().regex(/^\d{5}$/, 'Must be a 5-digit ZIP code'),
  radius: z.number().positive(),
  query: z.string().trim().optional(),
  gameTypes: z.array(gameTypeSchema).optional(),
  sortBy: z.enum(['distance', 'next_session']).default('distance'),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(50).default(20),
})

export const searchResultSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  zipCode: z.string(),
  distanceMiles: z.number(),
  scheduleType: z.enum(['once', 'weekly', 'biweekly', 'monthly']),
  startsAt: z.coerce.date(),
  nextOccurrenceAt: z.coerce.date().nullable(),
  maxPlayers: z.number().nullable(),
  status: z.enum(['active', 'closed']),
  hostDisplayName: z.string(),
  games: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      type: gameTypeSchema,
    }),
  ),
  locationLabel: z.string(),
})

export const searchGatheringsOutputSchema = z.object({
  gatherings: z.array(searchResultSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
  searchLocation: z.object({
    city: z.string(),
    state: z.string(),
  }),
})

export type SearchGatheringsInput = z.infer<typeof searchGatheringsSchema>
export type SearchResult = z.infer<typeof searchResultSchema>
export type SearchGatheringsOutput = z.infer<typeof searchGatheringsOutputSchema>
```

- [ ] **Step 2: Add barrel export to `packages/contracts/src/index.ts`**

Add at the end of the file:

```typescript
export * from './search.js'
```

- [ ] **Step 3: Add subpath export to `packages/contracts/package.json`**

Add to the `"exports"` object:

```json
"./search": "./src/search.ts"
```

- [ ] **Step 4: Verify types compile**

Run: `pnpm --filter @game-finder/contracts typecheck`

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/src/search.ts packages/contracts/src/index.ts packages/contracts/package.json
git commit -m "feat(contracts): add search validation schemas"
```

---

## Task 4: Implement Haversine distance utility

**Files:**
- Create: `apps/server/src/gathering/haversine.ts`
- Create: `apps/server/tests/haversine.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/server/tests/haversine.test.ts
import { describe, expect, it } from 'vitest'
import { haversineDistanceMiles } from '../src/gathering/haversine.js'

describe('haversineDistanceMiles', () => {
  it('returns 0 for the same point', () => {
    const distance = haversineDistanceMiles(40.7128, -74.006, 40.7128, -74.006)
    expect(distance).toBe(0)
  })

  it('calculates distance between New York and Los Angeles (~2,451 mi)', () => {
    const distance = haversineDistanceMiles(40.7128, -74.006, 34.0522, -118.2437)
    expect(distance).toBeGreaterThan(2400)
    expect(distance).toBeLessThan(2500)
  })

  it('calculates short distance between nearby ZIP codes (~5 mi)', () => {
    // Manhattan (10001) to Brooklyn (11201) is roughly 3-5 miles
    const distance = haversineDistanceMiles(40.7484, -73.9967, 40.6892, -73.9857)
    expect(distance).toBeGreaterThan(2)
    expect(distance).toBeLessThan(10)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/server && pnpm vitest run tests/haversine.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the Haversine utility**

```typescript
// apps/server/src/gathering/haversine.ts

const EARTH_RADIUS_MILES = 3959

export function haversineDistanceMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180

  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return EARTH_RADIUS_MILES * c
}
```

**Note:** This is a pure JS utility for testing distance calculations. The actual SQL Haversine expression is inlined in the `gathering.search` procedure (Task 8) using Kysely's `sql` template tag directly, which avoids import complexity.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/server && pnpm vitest run tests/haversine.test.ts`

Expected: All 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/gathering/haversine.ts apps/server/tests/haversine.test.ts
git commit -m "feat(server): add Haversine distance utility with tests"
```

---

## Task 5: Implement strip-markdown utility

**Files:**
- Create: `apps/server/src/gathering/strip-markdown.ts`

- [ ] **Step 1: Create the utility**

```typescript
// apps/server/src/gathering/strip-markdown.ts

export function stripMarkdownPreview(markdown: string, maxLength = 150): string {
  const stripped = markdown
    .replace(/#{1,6}\s+/g, '')          // headings
    .replace(/\*\*(.+?)\*\*/g, '$1')    // bold
    .replace(/\*(.+?)\*/g, '$1')        // italic
    .replace(/__(.+?)__/g, '$1')        // bold (underscores)
    .replace(/_(.+?)_/g, '$1')          // italic (underscores)
    .replace(/~~(.+?)~~/g, '$1')        // strikethrough
    .replace(/`{1,3}[^`]*`{1,3}/g, '')  // inline code / code blocks
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1') // links and images
    .replace(/^\s*[-*+]\s+/gm, '')      // list markers
    .replace(/^\s*\d+\.\s+/gm, '')      // ordered list markers
    .replace(/^\s*>\s+/gm, '')          // blockquotes
    .replace(/---+/g, '')               // horizontal rules
    .replace(/\n{2,}/g, ' ')            // collapse double newlines
    .replace(/\n/g, ' ')               // remaining newlines
    .replace(/\s+/g, ' ')              // collapse whitespace
    .trim()

  if (stripped.length <= maxLength) return stripped
  return `${stripped.slice(0, maxLength).trimEnd()}...`
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/server/src/gathering/strip-markdown.ts
git commit -m "feat(server): add strip-markdown utility for description previews"
```

---

## Task 6: Update test helpers for search tests

**Files:**
- Modify: `apps/server/tests/helpers.ts`

**Prerequisite:** Epic 3 must be merged first. The existing `helpers.ts` at that point will already have `seedGames()` and a `cleanup()` that deletes from `gathering_game`, `gathering`, `game`, and `users`. The changes below add to that state.

- [ ] **Step 1: Add `seedZipCodes()` helper**

Add this function to `apps/server/tests/helpers.ts`:

```typescript
export async function seedZipCodes() {
  const zips = [
    { zip_code: '10001', city: 'New York', state: 'NY', latitude: 40.7484, longitude: -73.9967 },
    { zip_code: '10002', city: 'New York', state: 'NY', latitude: 40.7157, longitude: -73.9863 },
    { zip_code: '11201', city: 'Brooklyn', state: 'NY', latitude: 40.6892, longitude: -73.9857 },
    { zip_code: '90210', city: 'Beverly Hills', state: 'CA', latitude: 34.0901, longitude: -118.4065 },
    { zip_code: '60601', city: 'Chicago', state: 'IL', latitude: 41.8819, longitude: -87.6278 },
  ]
  await db.insertInto('zip_code_location').values(zips).execute()
  return zips
}
```

- [ ] **Step 2: Add `createTestGathering()` helper**

Add this function to `apps/server/tests/helpers.ts`:

```typescript
export async function createTestGathering(
  hostId: string,
  gameIds: string[],
  overrides?: {
    title?: string
    description?: string
    zipCode?: string
    scheduleType?: 'once' | 'weekly' | 'biweekly' | 'monthly'
    startsAt?: Date
    nextOccurrenceAt?: Date | null
    status?: 'active' | 'closed'
    maxPlayers?: number | null
  },
) {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)

  const gathering = await db
    .insertInto('gathering')
    .values({
      host_id: hostId,
      title: overrides?.title ?? 'Test Gathering',
      description: overrides?.description ?? 'A test gathering description.',
      zip_code: overrides?.zipCode ?? '10001',
      schedule_type: overrides?.scheduleType ?? 'weekly',
      starts_at: overrides?.startsAt ?? tomorrow,
      next_occurrence_at: overrides?.nextOccurrenceAt !== undefined
        ? overrides.nextOccurrenceAt
        : tomorrow,
      status: overrides?.status ?? 'active',
      max_players: overrides?.maxPlayers ?? 6,
    })
    .returningAll()
    .executeTakeFirstOrThrow()

  if (gameIds.length > 0) {
    await db
      .insertInto('gathering_game')
      .values(gameIds.map((gameId) => ({
        gathering_id: gathering.id,
        game_id: gameId,
      })))
      .execute()
  }

  return gathering
}
```

- [ ] **Step 3: Update `cleanup()` to include `zip_code_location`**

Update the `cleanup` function to also delete ZIP code data:

```typescript
export async function cleanup() {
  await db.deleteFrom('gathering_game').execute()
  await db.deleteFrom('gathering').execute()
  await db.deleteFrom('game').execute()
  await db.deleteFrom('users').execute()
  await db.deleteFrom('zip_code_location').execute()
  const keys = await redis.keys('session:*')
  if (keys.length > 0) await redis.del(...keys)
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/server/tests/helpers.ts
git commit -m "test(server): add search test helpers (seedZipCodes, createTestGathering)"
```

---

## Task 7: Write failing search integration tests

**Files:**
- Create: `apps/server/tests/search.test.ts`

- [ ] **Step 1: Write all search tests**

```typescript
// apps/server/tests/search.test.ts
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  cleanup,
  createTestCaller,
  createTestUser,
  db,
  redis,
  seedGames,
  seedZipCodes,
  createTestGathering,
} from './helpers.js'

let caller: Awaited<ReturnType<typeof createTestCaller>>['caller']

beforeEach(async () => {
  const result = await createTestCaller()
  caller = result.caller
  await seedZipCodes()
})

afterEach(async () => {
  await cleanup()
})

afterAll(async () => {
  await db.destroy()
  redis.disconnect()
})

describe('gathering.search', () => {
  it('returns gatherings within the search radius sorted by distance', async () => {
    const user = await createTestUser()
    const games = await seedGames()

    // Create gatherings at different ZIPs
    await createTestGathering(user.id, [games[0].id], {
      title: 'Near Gathering',
      zipCode: '10002', // ~2 miles from 10001
    })
    await createTestGathering(user.id, [games[0].id], {
      title: 'Far Gathering',
      zipCode: '60601', // Chicago, ~700 miles
    })

    const result = await caller.gathering.search({
      zipCode: '10001',
      radius: 25,
    })

    expect(result.gatherings).toHaveLength(1)
    expect(result.gatherings[0].title).toBe('Near Gathering')
    expect(result.gatherings[0].distanceMiles).toBeGreaterThan(0)
    expect(result.gatherings[0].distanceMiles).toBeLessThan(25)
    expect(result.searchLocation.city).toBe('New York')
    expect(result.searchLocation.state).toBe('NY')
  })

  it('returns distance in miles for each result', async () => {
    const user = await createTestUser()
    const games = await seedGames()

    await createTestGathering(user.id, [games[0].id], {
      title: 'Brooklyn Gathering',
      zipCode: '11201', // ~4 miles from 10001
    })

    const result = await caller.gathering.search({
      zipCode: '10001',
      radius: 25,
    })

    expect(result.gatherings).toHaveLength(1)
    expect(result.gatherings[0].distanceMiles).toBeGreaterThan(2)
    expect(result.gatherings[0].distanceMiles).toBeLessThan(10)
  })

  it('filters by keyword matching gathering title', async () => {
    const user = await createTestUser()
    const games = await seedGames()

    await createTestGathering(user.id, [games[0].id], {
      title: 'Friday Board Game Night',
      zipCode: '10001',
    })
    await createTestGathering(user.id, [games[1].id], {
      title: 'Saturday D&D Session',
      zipCode: '10002',
    })

    const result = await caller.gathering.search({
      zipCode: '10001',
      radius: 25,
      query: 'Board Game',
    })

    expect(result.gatherings).toHaveLength(1)
    expect(result.gatherings[0].title).toBe('Friday Board Game Night')
  })

  it('filters by keyword matching linked game name', async () => {
    const user = await createTestUser()
    const games = await seedGames()

    await createTestGathering(user.id, [games[0].id], {
      title: 'Friday Night',
      zipCode: '10001',
    }) // linked to Catan
    await createTestGathering(user.id, [games[1].id], {
      title: 'Saturday Night',
      zipCode: '10002',
    }) // linked to D&D

    const result = await caller.gathering.search({
      zipCode: '10001',
      radius: 25,
      query: 'Catan',
    })

    expect(result.gatherings).toHaveLength(1)
    expect(result.gatherings[0].title).toBe('Friday Night')
  })

  it('filters by game type', async () => {
    const user = await createTestUser()
    const games = await seedGames()

    await createTestGathering(user.id, [games[0].id], {
      title: 'Board Game Night',
      zipCode: '10001',
    }) // board_game
    await createTestGathering(user.id, [games[1].id], {
      title: 'D&D Night',
      zipCode: '10002',
    }) // ttrpg

    const result = await caller.gathering.search({
      zipCode: '10001',
      radius: 25,
      gameTypes: ['ttrpg'],
    })

    expect(result.gatherings).toHaveLength(1)
    expect(result.gatherings[0].title).toBe('D&D Night')
  })

  it('combines keyword and game type filters', async () => {
    const user = await createTestUser()
    const games = await seedGames()

    await createTestGathering(user.id, [games[0].id], {
      title: 'Catan Night',
      zipCode: '10001',
    })
    await createTestGathering(user.id, [games[1].id], {
      title: 'D&D Night',
      zipCode: '10002',
    })
    await createTestGathering(user.id, [games[2].id], {
      title: 'Magic Night',
      zipCode: '10001',
    })

    const result = await caller.gathering.search({
      zipCode: '10001',
      radius: 25,
      query: 'Night',
      gameTypes: ['board_game'],
    })

    expect(result.gatherings).toHaveLength(1)
    expect(result.gatherings[0].title).toBe('Catan Night')
  })

  it('paginates results correctly', async () => {
    const user = await createTestUser()
    const games = await seedGames()

    // Create 3 gatherings
    await createTestGathering(user.id, [games[0].id], { title: 'G1', zipCode: '10001' })
    await createTestGathering(user.id, [games[0].id], { title: 'G2', zipCode: '10001' })
    await createTestGathering(user.id, [games[0].id], { title: 'G3', zipCode: '10002' })

    const page1 = await caller.gathering.search({
      zipCode: '10001',
      radius: 25,
      pageSize: 2,
      page: 1,
    })

    expect(page1.gatherings).toHaveLength(2)
    expect(page1.total).toBe(3)
    expect(page1.page).toBe(1)
    expect(page1.pageSize).toBe(2)

    const page2 = await caller.gathering.search({
      zipCode: '10001',
      radius: 25,
      pageSize: 2,
      page: 2,
    })

    expect(page2.gatherings).toHaveLength(1)
    expect(page2.total).toBe(3)
    expect(page2.page).toBe(2)
  })

  it('returns empty results when no gatherings match', async () => {
    const result = await caller.gathering.search({
      zipCode: '10001',
      radius: 5,
    })

    expect(result.gatherings).toHaveLength(0)
    expect(result.total).toBe(0)
  })

  it('excludes closed gatherings', async () => {
    const user = await createTestUser()
    const games = await seedGames()

    await createTestGathering(user.id, [games[0].id], {
      title: 'Active Gathering',
      zipCode: '10001',
      status: 'active',
    })
    await createTestGathering(user.id, [games[0].id], {
      title: 'Closed Gathering',
      zipCode: '10001',
      status: 'closed',
    })

    const result = await caller.gathering.search({
      zipCode: '10001',
      radius: 25,
    })

    expect(result.gatherings).toHaveLength(1)
    expect(result.gatherings[0].title).toBe('Active Gathering')
  })

  it('excludes gatherings with null next_occurrence_at', async () => {
    const user = await createTestUser()
    const games = await seedGames()

    await createTestGathering(user.id, [games[0].id], {
      title: 'Upcoming Gathering',
      zipCode: '10001',
      nextOccurrenceAt: new Date(Date.now() + 86400000),
    })
    await createTestGathering(user.id, [games[0].id], {
      title: 'Past Gathering',
      zipCode: '10001',
      nextOccurrenceAt: null,
    })

    const result = await caller.gathering.search({
      zipCode: '10001',
      radius: 25,
    })

    expect(result.gatherings).toHaveLength(1)
    expect(result.gatherings[0].title).toBe('Upcoming Gathering')
  })

  it('throws BAD_REQUEST for an invalid ZIP code', async () => {
    await expect(
      caller.gathering.search({ zipCode: '00000', radius: 25 }),
    ).rejects.toThrow('Invalid ZIP code')
  })

  it('sorts by next_session when requested', async () => {
    const user = await createTestUser()
    const games = await seedGames()

    const soon = new Date()
    soon.setDate(soon.getDate() + 1)
    const later = new Date()
    later.setDate(later.getDate() + 10)

    await createTestGathering(user.id, [games[0].id], {
      title: 'Later Gathering',
      zipCode: '10001',
      nextOccurrenceAt: later,
    })
    await createTestGathering(user.id, [games[0].id], {
      title: 'Sooner Gathering',
      zipCode: '10002',
      nextOccurrenceAt: soon,
    })

    const result = await caller.gathering.search({
      zipCode: '10001',
      radius: 25,
      sortBy: 'next_session',
    })

    expect(result.gatherings).toHaveLength(2)
    expect(result.gatherings[0].title).toBe('Sooner Gathering')
    expect(result.gatherings[1].title).toBe('Later Gathering')
  })

  it('includes games and host info in results', async () => {
    const user = await createTestUser({ displayName: 'GameHost' })
    const games = await seedGames()

    await createTestGathering(user.id, [games[0].id, games[2].id], {
      title: 'Multi Game Night',
      zipCode: '10001',
    })

    const result = await caller.gathering.search({
      zipCode: '10001',
      radius: 25,
    })

    expect(result.gatherings).toHaveLength(1)
    expect(result.gatherings[0].hostDisplayName).toBe('GameHost')
    expect(result.gatherings[0].games).toHaveLength(2)
    expect(result.gatherings[0].games.map((g) => g.name).sort()).toEqual(
      ['Catan', 'Magic: The Gathering'].sort(),
    )
    expect(result.gatherings[0].locationLabel).toBe('New York, NY')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/server && pnpm vitest run tests/search.test.ts`

Expected: FAIL — `gathering.search` procedure does not exist.

- [ ] **Step 3: Commit**

```bash
git add apps/server/tests/search.test.ts
git commit -m "test(server): add failing search integration tests"
```

---

## Task 8: Implement `gathering.search` procedure

**Files:**
- Modify: `apps/server/src/trpc/gathering.ts`

This is the core implementation. The `search` procedure is added to the existing `gatheringRouter`.

- [ ] **Step 1: Add imports to `apps/server/src/trpc/gathering.ts`**

Add at the top of the file, alongside existing imports:

```typescript
import { searchGatheringsSchema } from '@game-finder/contracts/search'
import { sql } from 'kysely'
import { stripMarkdownPreview } from '../gathering/strip-markdown.js'
```

- [ ] **Step 2: Add the `search` procedure to the `gatheringRouter`**

Add the following procedure inside the `createRouter({...})` call in `gathering.ts`, after the existing `listByHost` procedure:

```typescript
  search: publicProcedure
    .input(searchGatheringsSchema)
    .query(async ({ input, ctx }) => {
      const { zipCode, radius, query, gameTypes, sortBy, page, pageSize } = input

      // 1. Look up the searcher's ZIP
      const searchZip = await ctx.db
        .selectFrom('zip_code_location')
        .selectAll()
        .where('zip_code', '=', zipCode)
        .executeTakeFirst()

      if (!searchZip) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid ZIP code' })
      }

      const lat = Number(searchZip.latitude)
      const lng = Number(searchZip.longitude)

      // Haversine distance SQL expression
      const distanceExpr = sql<number>`(
        3959 * acos(
          cos(radians(${lat})) * cos(radians(cast(${sql.ref('z.latitude')} as double precision))) *
          cos(radians(cast(${sql.ref('z.longitude')} as double precision)) - radians(${lng})) +
          sin(radians(${lat})) * sin(radians(cast(${sql.ref('z.latitude')} as double precision)))
        )
      )`

      // 2. Build the base query
      let baseQuery = ctx.db
        .selectFrom('gathering')
        .innerJoin('zip_code_location as z', 'z.zip_code', 'gathering.zip_code')
        .innerJoin('users', 'users.id', 'gathering.host_id')
        .where('gathering.status', '=', 'active')
        .where('gathering.next_occurrence_at', 'is not', null)

      // 3. Keyword filter: match title or linked game name
      if (query) {
        const pattern = `%${query}%`
        baseQuery = baseQuery.where((eb) =>
          eb.or([
            eb('gathering.title', 'ilike', pattern),
            eb.exists(
              eb
                .selectFrom('gathering_game')
                .innerJoin('game', 'game.id', 'gathering_game.game_id')
                .whereRef('gathering_game.gathering_id', '=', 'gathering.id')
                .where('game.name', 'ilike', pattern)
                .select(sql.lit(1).as('one')),
            ),
          ]),
        )
      }

      // 4. Game type filter
      if (gameTypes && gameTypes.length > 0) {
        baseQuery = baseQuery.where((eb) =>
          eb.exists(
            eb
              .selectFrom('gathering_game')
              .innerJoin('game', 'game.id', 'gathering_game.game_id')
              .whereRef('gathering_game.gathering_id', '=', 'gathering.id')
              .where('game.type', 'in', gameTypes)
              .select(sql.lit(1).as('one')),
          ),
        )
      }

      // 5. Radius filter — use HAVING on the distance alias via a subquery wrapper
      //    or filter using the raw expression in WHERE
      baseQuery = baseQuery.where(distanceExpr, '<=', radius)

      // 6. Count total
      const countResult = await baseQuery
        .select(sql<number>`count(*)`.as('count'))
        .executeTakeFirstOrThrow()
      const total = Number(countResult.count)

      // 7. Fetch paginated results
      let resultsQuery = baseQuery
        .select([
          'gathering.id',
          'gathering.title',
          'gathering.description',
          'gathering.zip_code',
          'gathering.schedule_type',
          'gathering.starts_at',
          'gathering.next_occurrence_at',
          'gathering.max_players',
          'gathering.status',
          'users.display_name as host_display_name',
          'z.city as location_city',
          'z.state as location_state',
          distanceExpr.as('distance_miles'),
        ])
        .limit(pageSize)
        .offset((page - 1) * pageSize)

      if (sortBy === 'next_session') {
        resultsQuery = resultsQuery.orderBy('gathering.next_occurrence_at', 'asc')
      } else {
        resultsQuery = resultsQuery.orderBy(sql`distance_miles`, 'asc')
      }

      const rows = await resultsQuery.execute()

      // 8. Fetch games for each gathering
      const gatheringIds = rows.map((r) => r.id)
      let gamesMap: Map<string, Array<{ id: string; name: string; type: string }>> = new Map()

      if (gatheringIds.length > 0) {
        const gameRows = await ctx.db
          .selectFrom('gathering_game')
          .innerJoin('game', 'game.id', 'gathering_game.game_id')
          .select([
            'gathering_game.gathering_id',
            'game.id',
            'game.name',
            'game.type',
          ])
          .where('gathering_game.gathering_id', 'in', gatheringIds)
          .execute()

        for (const row of gameRows) {
          const existing = gamesMap.get(row.gathering_id) ?? []
          existing.push({ id: row.id, name: row.name, type: row.type })
          gamesMap.set(row.gathering_id, existing)
        }
      }

      // 9. Serialize results
      const gatherings = rows.map((row) => ({
        id: row.id,
        title: row.title,
        description: stripMarkdownPreview(row.description),
        zipCode: row.zip_code,
        distanceMiles: Math.round(Number(row.distance_miles) * 10) / 10,
        scheduleType: row.schedule_type,
        startsAt: row.starts_at,
        nextOccurrenceAt: row.next_occurrence_at,
        maxPlayers: row.max_players,
        status: row.status,
        hostDisplayName: (row as Record<string, unknown>).host_display_name as string,
        games: gamesMap.get(row.id) ?? [],
        locationLabel: `${(row as Record<string, unknown>).location_city}, ${(row as Record<string, unknown>).location_state}`,
      }))

      return {
        gatherings,
        total,
        page,
        pageSize,
        searchLocation: {
          city: searchZip.city,
          state: searchZip.state,
        },
      }
    }),
```

**Implementation notes for the developer:**
- The `distanceExpr` uses `cast(... as double precision)` because `decimal(9,6)` columns need explicit casting for PostgreSQL trig functions.
- The `sql.ref()` calls reference the `z` alias for `zip_code_location`.
- The Kysely types may need minor adjustments depending on the exact version. If type inference struggles with the complex query, use type assertions on the row results.
- The `ilike` operator is PostgreSQL-specific (case-insensitive LIKE). This is fine since the project uses PostgreSQL.

- [ ] **Step 3: Run all tests**

Run: `cd apps/server && pnpm vitest run tests/search.test.ts`

Expected: All 12 search tests PASS.

- [ ] **Step 4: Run the full test suite**

Run: `pnpm --filter @game-finder/server test`

Expected: All tests pass (search + existing auth/gathering/game/health tests).

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/trpc/gathering.ts apps/server/src/gathering/strip-markdown.ts
git commit -m "feat(server): implement gathering.search procedure with distance, filters, and pagination"
```

---

## Task 9: Add Shadcn UI components

**Files:**
- Create: `packages/ui/src/components/checkbox.tsx`
- Create: `packages/ui/src/components/radio-group.tsx`
- Create: `packages/ui/src/components/pagination.tsx`

- [ ] **Step 1: Install Shadcn components**

Run from the `packages/ui` directory:

```bash
cd packages/ui && pnpm dlx shadcn@latest add checkbox radio-group pagination
```

If prompted, accept defaults. This creates the component files and installs any required dependencies (like `@radix-ui/react-checkbox`, `@radix-ui/react-radio-group`).

- [ ] **Step 2: Verify components were created**

Check that these files exist:
- `packages/ui/src/components/checkbox.tsx`
- `packages/ui/src/components/radio-group.tsx`
- `packages/ui/src/components/pagination.tsx`

- [ ] **Step 3: Commit**

```bash
git add packages/ui/
git commit -m "feat(ui): add Checkbox, RadioGroup, and Pagination Shadcn components"
```

---

## Task 10: Add search route and page

**Files:**
- Create: `apps/web/app/routes/search.tsx`
- Modify: `apps/web/app/routes.ts`

- [ ] **Step 1: Register the route in `apps/web/app/routes.ts`**

Add to the route array:

```typescript
route('search', 'routes/search.tsx'),
```

The file should look like:

```typescript
import { type RouteConfig, index, route } from '@react-router/dev/routes'

export default [
  index('routes/home.tsx'),
  route('signup', 'routes/signup.tsx'),
  route('login', 'routes/login.tsx'),
  // Epic 3 routes (dashboard, gatherings) will be here
  route('search', 'routes/search.tsx'),
] satisfies RouteConfig
```

Note: Epic 3 may have added additional routes (dashboard, gatherings). Add the search route alongside whatever exists.

- [ ] **Step 2: Create the search page**

```tsx
// apps/web/app/routes/search.tsx
import { Badge } from '@game-finder/ui/components/badge'
import { Button } from '@game-finder/ui/components/button'
import { Card, CardContent } from '@game-finder/ui/components/card'
import { Checkbox } from '@game-finder/ui/components/checkbox'
import { Input } from '@game-finder/ui/components/input'
import { Label } from '@game-finder/ui/components/label'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@game-finder/ui/components/pagination'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useTRPC } from '../trpc/provider.js'

type GameType = 'board_game' | 'ttrpg' | 'card_game'

const GAME_TYPE_LABELS: Record<GameType, string> = {
  board_game: 'Board Games',
  ttrpg: 'TTRPGs',
  card_game: 'Card Games',
}

const RADIUS_OPTIONS = [5, 10, 25, 50]

const SCHEDULE_LABELS: Record<string, string> = {
  once: 'One-time',
  weekly: 'Every week',
  biweekly: 'Every other week',
  monthly: 'Monthly',
}

function formatDate(date: string | Date | null): string {
  if (!date) return 'TBD'
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function GameTypeBadge({ type }: { type: GameType }) {
  const colorMap: Record<GameType, string> = {
    board_game: 'bg-primary/15 text-primary border-primary/20',
    ttrpg: 'bg-teal/15 text-teal border-teal/20',
    card_game: 'bg-plum/15 text-plum border-plum/20',
  }
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${colorMap[type]}`}>
      {GAME_TYPE_LABELS[type]}
    </span>
  )
}

export default function SearchPage() {
  const trpc = useTRPC()
  const [searchParams, setSearchParams] = useSearchParams()

  // Read state from URL
  const urlZip = searchParams.get('zip') ?? ''
  const urlRadius = Number(searchParams.get('radius')) || 25
  const urlQuery = searchParams.get('q') ?? ''
  const urlTypes = searchParams.get('types')?.split(',').filter(Boolean) as GameType[] | undefined
  const urlSort = (searchParams.get('sort') ?? 'distance') as 'distance' | 'next_session'
  const urlPage = Number(searchParams.get('page')) || 1

  // Form state (local until submit)
  const [zipInput, setZipInput] = useState(urlZip)
  const [radiusInput, setRadiusInput] = useState(urlRadius)
  const [queryInput, setQueryInput] = useState(urlQuery)

  const hasSearched = !!urlZip

  // Fetch results based on URL state
  const { data, isLoading, error } = useQuery(
    trpc.gathering.search.queryOptions(
      {
        zipCode: urlZip,
        radius: urlRadius,
        query: urlQuery || undefined,
        gameTypes: urlTypes && urlTypes.length > 0 ? urlTypes : undefined,
        sortBy: urlSort,
        page: urlPage,
        pageSize: 20,
      },
      { enabled: hasSearched },
    ),
  )

  function updateSearchParams(updates: Record<string, string | undefined>) {
    const newParams = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined || value === '') {
        newParams.delete(key)
      } else {
        newParams.set(key, value)
      }
    }
    setSearchParams(newParams)
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!zipInput || !/^\d{5}$/.test(zipInput)) return
    updateSearchParams({
      zip: zipInput,
      radius: String(radiusInput),
      q: queryInput || undefined,
      page: '1',
    })
  }

  function toggleGameType(type: GameType) {
    const current = urlTypes ?? []
    const next = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type]
    updateSearchParams({
      types: next.length > 0 ? next.join(',') : undefined,
      page: '1',
    })
  }

  function setSort(sort: 'distance' | 'next_session') {
    updateSearchParams({ sort, page: '1' })
  }

  function goToPage(page: number) {
    updateSearchParams({ page: String(page) })
  }

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      {/* Search Form */}
      <form onSubmit={handleSearch} className="mb-8">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="zip" className="text-xs text-muted-foreground">ZIP Code</Label>
            <Input
              id="zip"
              type="text"
              placeholder="e.g. 10001"
              value={zipInput}
              onChange={(e) => setZipInput(e.target.value)}
              className="w-28"
              maxLength={5}
              pattern="\d{5}"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="radius" className="text-xs text-muted-foreground">Radius</Label>
            <select
              id="radius"
              value={radiusInput}
              onChange={(e) => setRadiusInput(Number(e.target.value))}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              {RADIUS_OPTIONS.map((r) => (
                <option key={r} value={r}>{r} miles</option>
              ))}
            </select>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Label htmlFor="query" className="text-xs text-muted-foreground">Keyword (optional)</Label>
            <Input
              id="query"
              type="text"
              placeholder="e.g. Catan, D&D..."
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
            />
          </div>
          <Button type="submit" className="h-9">Search</Button>
        </div>
      </form>

      {/* Pre-search state */}
      {!hasSearched && (
        <div className="flex min-h-[40vh] items-center justify-center">
          <p className="text-center text-muted-foreground">
            Enter your ZIP code to find tabletop gatherings near you.
          </p>
        </div>
      )}

      {/* Results layout */}
      {hasSearched && (
        <div className="flex gap-8">
          {/* Sidebar filters */}
          <aside className="w-48 shrink-0">
            <div className="sticky top-8 space-y-6">
              {/* Game Type filter */}
              <div>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Game Type
                </h3>
                <div className="space-y-2">
                  {(Object.entries(GAME_TYPE_LABELS) as [GameType, string][]).map(
                    ([type, label]) => (
                      <label key={type} className="flex cursor-pointer items-center gap-2">
                        <Checkbox
                          checked={urlTypes?.includes(type) ?? false}
                          onCheckedChange={() => toggleGameType(type)}
                        />
                        <span className="text-sm text-foreground">{label}</span>
                      </label>
                    ),
                  )}
                </div>
              </div>

              {/* Sort */}
              <div>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Sort By
                </h3>
                <div className="space-y-2">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="sort"
                      checked={urlSort === 'distance'}
                      onChange={() => setSort('distance')}
                      className="accent-primary"
                    />
                    <span className="text-sm text-foreground">Distance</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="sort"
                      checked={urlSort === 'next_session'}
                      onChange={() => setSort('next_session')}
                      className="accent-primary"
                    />
                    <span className="text-sm text-foreground">Next Session</span>
                  </label>
                </div>
              </div>
            </div>
          </aside>

          {/* Results */}
          <main className="min-w-0 flex-1">
            {isLoading && (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-32 animate-pulse rounded-lg border border-border bg-card/40" />
                ))}
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
                {error.message === 'Invalid ZIP code'
                  ? 'That ZIP code was not found. Please enter a valid 5-digit US ZIP code.'
                  : 'Something went wrong. Please try again.'}
              </div>
            )}

            {data && !isLoading && (
              <>
                <p className="mb-4 text-sm text-muted-foreground">
                  {data.total} gathering{data.total !== 1 ? 's' : ''} near{' '}
                  {data.searchLocation.city}, {data.searchLocation.state}
                </p>

                {data.gatherings.length === 0 ? (
                  <div className="flex min-h-[30vh] items-center justify-center">
                    <p className="text-center text-muted-foreground">
                      No gatherings found within {urlRadius} miles. Try expanding your search radius.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.gatherings.map((gathering) => (
                      <Link key={gathering.id} to={`/gatherings/${gathering.id}`} className="block">
                        <Card className="transition-colors hover:border-primary/30">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0 flex-1">
                                <h3 className="font-display text-sm font-semibold text-foreground">
                                  {gathering.title}
                                </h3>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                  {SCHEDULE_LABELS[gathering.scheduleType]} &middot; Hosted by{' '}
                                  {gathering.hostDisplayName}
                                </p>
                              </div>
                              <Badge variant="secondary" className="shrink-0 font-mono text-xs text-primary">
                                {gathering.distanceMiles} mi
                              </Badge>
                            </div>

                            {gathering.games.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {gathering.games.map((game) => (
                                  <GameTypeBadge key={game.id} type={game.type as GameType} />
                                ))}
                                {gathering.games.map((game) => (
                                  <span
                                    key={`name-${game.id}`}
                                    className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground"
                                  >
                                    {game.name}
                                  </span>
                                ))}
                              </div>
                            )}

                            {gathering.description && (
                              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                                {gathering.description}
                              </p>
                            )}

                            <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                              <span>Next: {formatDate(gathering.nextOccurrenceAt)}</span>
                              {gathering.maxPlayers && (
                                <span>Up to {gathering.maxPlayers} players</span>
                              )}
                              <span>{gathering.locationLabel}</span>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                  <Pagination className="mt-6">
                    <PaginationContent>
                      {urlPage > 1 && (
                        <PaginationItem>
                          <PaginationPrevious
                            href="#"
                            onClick={(e) => { e.preventDefault(); goToPage(urlPage - 1) }}
                          />
                        </PaginationItem>
                      )}
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                        <PaginationItem key={p}>
                          <PaginationLink
                            href="#"
                            isActive={p === urlPage}
                            onClick={(e) => { e.preventDefault(); goToPage(p) }}
                          >
                            {p}
                          </PaginationLink>
                        </PaginationItem>
                      ))}
                      {urlPage < totalPages && (
                        <PaginationItem>
                          <PaginationNext
                            href="#"
                            onClick={(e) => { e.preventDefault(); goToPage(urlPage + 1) }}
                          />
                        </PaginationItem>
                      )}
                    </PaginationContent>
                  </Pagination>
                )}
              </>
            )}
          </main>
        </div>
      )}
    </div>
  )
}
```

**Implementation notes for the developer:**
- The page reads search state from URL query params (`useSearchParams`) so results are shareable and bookmarkable.
- Form submission updates URL params, which triggers the `useQuery` fetch.
- Filter/sort changes immediately update URL params (and re-fetch).
- The Shadcn Pagination component's exact API may vary — adjust the import names to match what `shadcn add pagination` generates. Check the component file after install.
- If the Shadcn RadioGroup feels too heavy for two options, plain HTML radio inputs with Tailwind styling (as shown) work fine.
- This implementation uses client-side fetching via `useQuery`. For SSR, the implementer could add a route `loader` that calls `gathering.search` on the server and passes the data down — but for the prototype, client-side fetching with URL state is sufficient.

- [ ] **Step 3: Verify the page renders**

Start the dev server (`pnpm dev`) and navigate to `http://localhost:3000/search`. Verify:
- The search form renders
- The pre-search empty state shows
- Entering a seeded ZIP code and clicking Search returns results (requires gatherings to exist)

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/routes/search.tsx apps/web/app/routes.ts
git commit -m "feat(web): add Search & Browse page with filters, sort, and pagination"
```

---

## Task 11: Update nav with "Find Games" link

**Files:**
- Modify: `apps/web/app/components/nav.tsx`

- [ ] **Step 1: Add "Find Games" link to the nav**

In `apps/web/app/components/nav.tsx`, add a "Find Games" link visible to all users. It should go between the logo and the auth section (the right-side `div`).

Inside the `<nav>` element, between the logo `<Link>` and the right-side `<div className="flex items-center gap-5">`, add:

```tsx
<Link
  to="/search"
  className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
>
  Find Games
</Link>
```

The nav structure should now be: `[Logo ... Find Games ... [auth section]]`.

To achieve proper spacing, you may need to adjust the parent flex container. For example, change the outer flex div to include `gap-6` or use a spacer. The simplest approach is to ensure the three sections (logo, find games, auth) are spaced with the existing `justify-between`:

```tsx
<div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
  <div className="flex items-center gap-6">
    <Link to="/" className="group flex items-center gap-2">
      {/* ... logo ... */}
    </Link>
    <Link
      to="/search"
      className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
    >
      Find Games
    </Link>
  </div>
  <div className="flex items-center gap-5">
    {/* ... auth section (unchanged) ... */}
  </div>
</div>
```

- [ ] **Step 2: Verify the nav update**

Start the dev server and verify "Find Games" appears in the nav for both logged-in and logged-out users. Click it and verify it navigates to `/search`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/components/nav.tsx
git commit -m "feat(web): add Find Games link to nav bar"
```

---

## Task 12: Final verification

- [ ] **Step 1: Run the full test suite**

Run: `pnpm --filter @game-finder/server test`

Expected: All tests pass, including the new search tests.

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck`

Expected: No type errors across all packages.

- [ ] **Step 3: Run lint**

Run: `pnpm lint`

Expected: No lint errors. Fix any that appear.

- [ ] **Step 4: Manual smoke test**

Start the full stack (`pnpm dev` or `docker compose up`) and verify:

1. Navigate to `/search` via the "Find Games" nav link
2. Enter a valid ZIP code (e.g., 10001) with 25 mile radius
3. See search results with distance, game badges, schedule, and description
4. Toggle game type filters — results update
5. Change sort to "Next Session" — results re-sort
6. Click pagination — pages through results
7. Click a result card — navigates to gathering details
8. Copy the URL and paste in a new tab — same results load
9. Enter an invalid ZIP — see error message

- [ ] **Step 5: Commit any fixes**

If any fixes were needed during verification, commit them:

```bash
git add -A
git commit -m "fix(web): address issues found during smoke testing"
```
