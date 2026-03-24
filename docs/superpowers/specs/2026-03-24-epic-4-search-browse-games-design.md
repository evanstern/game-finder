# Epic 4: Search & Browse Games — Design Spec

## Overview

The discovery experience. Users search by ZIP code and radius to find nearby tabletop gatherings, browse results as rich cards, filter by game type, and sort by distance or next session date. Search is public — no account required.

## Key Decisions

- **Geocoding:** Static ZIP code lookup table in PostgreSQL (~40k US ZIPs with lat/lng). Haversine formula in SQL for distance calculation. No external API dependency.
- **Text search:** `ILIKE` on gathering title and linked game names. Lightweight — no full-text search infrastructure.
- **Result cards:** Rich cards showing title, game badges, distance, schedule, host, description preview, next session, and player count.
- **Pagination:** Classic offset-based (LIMIT/OFFSET with page numbers).
- **Filters/Sort:** Game type multi-select filter (board game, TTRPG, card game). Sort by distance (default) or next session date.
- **URL state:** Search parameters stored in query params for shareable/bookmarkable URLs.
- **Layout:** Sidebar filters with search bar at top.

---

## Database

### `zip_code_location` table

| Column | Type | Constraints |
|--------|------|-------------|
| `zip_code` | `varchar(5)` | PK |
| `city` | `varchar(100)` | Not null |
| `state` | `varchar(2)` | Not null |
| `latitude` | `decimal(9,6)` | Not null |
| `longitude` | `decimal(9,6)` | Not null |

Reference data — no `id`, no timestamps. ZIP code is the natural primary key.

### Seed data

A migration creates the table. A seed script in `packages/db` loads ~40k US ZIP codes from a bundled CSV (freely available datasets like US Census ZCTA or SimpleMaps). Runs alongside the existing game seed script.

### Indexes

- `gathering.zip_code` — already indexed from Epic 3
- `zip_code_location` — PK on `zip_code` handles lookups
- Composite index on `gathering(status, next_occurrence_at)` for active+upcoming filter if not already present

### Haversine distance

SQL expression computing approximate miles between two lat/lng pairs:

```sql
(3959 * acos(
  cos(radians(:lat)) * cos(radians(z.latitude)) *
  cos(radians(z.longitude) - radians(:lng)) +
  sin(radians(:lat)) * sin(radians(z.latitude))
)) AS distance_miles
```

3959 = Earth's radius in miles. Used in SELECT (display), WHERE (radius filter), and ORDER BY (distance sort).

---

## API Layer

### tRPC `gathering` router — new `search` procedure

Added to the existing `gathering` router from Epic 3.

| Procedure | Type | Input | Output | Auth |
|-----------|------|-------|--------|------|
| `gathering.search` | query | `SearchGatheringsInput` | `SearchGatheringsOutput` | Public |

### `SearchGatheringsInput` (Zod schema in `packages/contracts`)

```typescript
{
  zipCode: string       // 5-digit US ZIP (required)
  radius: number        // miles: 5, 10, 25, 50 (required)
  query?: string        // optional keyword search
  gameTypes?: GameType[] // optional filter: ['board_game', 'ttrpg', 'card_game']
  sortBy?: 'distance' | 'next_session'  // default: 'distance'
  page?: number         // default: 1
  pageSize?: number     // default: 20, max: 50
}
```

### `SearchGatheringsOutput`

```typescript
{
  gatherings: SearchResult[]
  total: number
  page: number
  pageSize: number
  searchLocation: {
    city: string
    state: string
  }
}
```

### `SearchResult` shape

```typescript
{
  id: string
  title: string
  description: string        // first ~150 chars, Markdown stripped
  zipCode: string
  distanceMiles: number
  scheduleType: ScheduleType
  startsAt: string
  nextOccurrenceAt: string | null
  maxPlayers: number | null
  status: GatheringStatus
  hostDisplayName: string
  games: Array<{
    id: string
    name: string
    type: GameType
  }>
  locationLabel: string       // "City, ST" from zip_code_location
}
```

### Query behavior

1. Look up searcher's ZIP from `zip_code_location` → throw `BAD_REQUEST` ("Invalid ZIP code") if not found
2. Base query: active gatherings (`status = 'active'`, `next_occurrence_at IS NOT NULL`)
3. JOIN `zip_code_location` on `gathering.zip_code` → compute Haversine distance
4. WHERE distance ≤ radius
5. If `query` provided: filter where `gathering.title ILIKE '%query%'` OR any linked `game.name ILIKE '%query%'`
6. If `gameTypes` provided: filter where at least one linked game has matching type
7. ORDER BY distance (default) or `next_occurrence_at` ASC
8. LIMIT/OFFSET for pagination
9. Separate COUNT query for total (same filters, no LIMIT)

### Description preview

Strip Markdown and truncate to ~150 chars in application code after fetching. Not in SQL.

### Validation schemas (`packages/contracts`)

New file `src/search.ts`:

- `searchGatheringsSchema` — zipCode (5-digit string), radius (number), query (optional string), gameTypes (optional GameType array), sortBy (optional enum), page (optional positive int), pageSize (optional positive int, max 50)

### Error handling

| Scenario | tRPC code | Message |
|----------|-----------|---------|
| Invalid/unknown ZIP code | `BAD_REQUEST` | "Invalid ZIP code" |

All other errors (auth, not found) are handled by existing middleware from previous epics.

---

## Web Layer

### Routes

| Path | Page | Auth |
|------|------|------|
| `/search` | Search & Browse | Public |

### Search page structure (`/search`)

**Top section:** Search form bar
- ZIP code input (required, 5-digit validation)
- Radius dropdown (5, 10, 25, 50 miles — default 25)
- Keyword input (optional)
- Search button

**Two-column layout below search bar:**

**Left sidebar (~200px fixed):**
- **Game Type** — checkboxes: Board Games, TTRPGs, Card Games
- **Sort By** — radio buttons: Distance (default), Next Session
- Filters apply immediately on change (re-fetch with current search params)

**Right content area:**
- Results count + location: "42 gatherings near Springfield, IL"
- Rich card list, each card showing:
  - Title (links to `/gatherings/:id`)
  - Schedule label ("Every Friday", "One-time", "Every other Saturday") + host display name
  - Distance badge (right-aligned, e.g., "3.2 mi")
  - Game badges (colored pills for each linked game)
  - Description preview (~150 chars, Markdown stripped)
  - Next session date + player count
- Pagination controls at bottom (page numbers, prev/next)

**States:**
- Pre-search: "Enter your ZIP code to find tabletop gatherings near you"
- No results: "No gatherings found within [radius] miles of [ZIP]. Try expanding your search radius."
- Invalid ZIP: Inline form validation error

### URL state

Search parameters stored as query params: `/search?zip=62704&radius=25&q=catan&types=board_game,ttrpg&sort=distance&page=1`

- Shareable/bookmarkable
- Browser back/forward works naturally
- Page refresh preserves search
- Route loader reads params and calls `gathering.search` server-side (SSR)

### Nav updates

Add "Find Games" link to the nav bar, visible to all users (logged in or not). Positioned between the logo and the auth section.

### New Shadcn components (`packages/ui`)

- `Checkbox` — game type filter checkboxes
- `RadioGroup` — sort selection
- `Pagination` — page controls

Use whatever components already exist from previous epics; add only what's missing.

---

## Testing

### Server integration tests (Vitest)

**ZIP code location:**
- Seed data loads correctly (spot-check known ZIPs)
- Unknown ZIP returns `BAD_REQUEST`

**`gathering.search` procedure:**
- Happy path — returns gatherings within radius, sorted by distance
- Distance calculation — verify known ZIP pair returns expected approximate distance
- Text search — keyword matches gathering title
- Text search — keyword matches linked game name
- Game type filter — returns only gatherings with matching game type
- Combined filters — keyword + game type together
- Pagination — correct page/total/results count
- No results — returns empty array with total: 0
- Active only — closed gatherings excluded
- Past gatherings — null `next_occurrence_at` excluded

### Web tests

Not in scope — consistent with Epics 2 and 3. Server integration tests cover the business logic.

---

## Exit Criteria

A user (anonymous or logged-in) can:

1. Navigate to the search page via "Find Games" in the nav
2. Enter a ZIP code and radius, optionally a keyword, and submit
3. See matching gatherings displayed as rich cards with distance, schedule, games, and description preview
4. Filter results by game type (Board Games, TTRPGs, Card Games)
5. Sort results by distance or next session date
6. Page through results with pagination controls
7. Click a result card to navigate to the gathering details page
8. Share a search URL and have it reproduce the same results
9. See helpful empty states (no results, invalid ZIP, pre-search)
