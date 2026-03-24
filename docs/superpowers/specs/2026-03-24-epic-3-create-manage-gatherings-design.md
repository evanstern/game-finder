# Epic 3: Create & Manage Gatherings — Design Spec

## Overview

Hosts create and manage game gatherings — the core listing experience. Introduces two new data models: **Game** (a curated catalog of real-world tabletop games) and **Gathering** (a host-created event that links to one or more Games). Hosts get a dashboard to manage their gatherings, and visitors can view a public details page with rendered Markdown.

## Key Decisions

- **Game vs Gathering separation:** "Game" is a catalog entry (e.g., "Catan"). "Gathering" is a hosted event ("Friday Board Game Night"). A Gathering links to one or more Games via a join table.
- **Game catalog:** Admin-seeded via a seed script. No CRUD UI for games in this epic. ~20-30 popular tabletop games across board games, TTRPGs, and card games.
- **Scheduling:** Schedule columns directly on the `gathering` table with a computed `next_occurrence_at` field. Supports one-off and recurring (weekly, biweekly, monthly). No separate occurrences table.
- **Markdown editor:** CodeMirror 6 with Markdown syntax highlighting, optional vim keybindings (`@replit/codemirror-vim`), file upload (.md/.txt), and a live preview pane.
- **Singular table names:** `game`, `gathering`, `gathering_game`.
- **Timestamps:** `created_at` + `updated_at` on all new tables (convention from Epic 2).

---

## Database

### `game` table

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `name` | `varchar(255)` | Not null |
| `type` | `game_type` enum | Not null |
| `description` | `text` | Not null |
| `min_players` | `smallint` | Not null |
| `max_players` | `smallint` | Not null |
| `image_url` | `varchar(500)` | Nullable |
| `created_at` | `timestamptz` | Not null, default `now()` |
| `updated_at` | `timestamptz` | Not null, default `now()` |

`game_type` enum: `'board_game'`, `'ttrpg'`, `'card_game'`

### `gathering` table

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `host_id` | `uuid` | FK → `user.id`, not null |
| `title` | `varchar(255)` | Not null |
| `description` | `text` | Not null (Markdown body) |
| `zip_code` | `varchar(10)` | Not null |
| `schedule_type` | `schedule_type` enum | Not null |
| `starts_at` | `timestamptz` | Not null |
| `end_date` | `date` | Nullable (when a recurring series ends) |
| `duration_minutes` | `smallint` | Nullable |
| `max_players` | `smallint` | Nullable |
| `status` | `gathering_status` enum | Not null, default `'active'` |
| `next_occurrence_at` | `timestamptz` | Nullable (null when recurring series is over) |
| `created_at` | `timestamptz` | Not null, default `now()` |
| `updated_at` | `timestamptz` | Not null, default `now()` |

`schedule_type` enum: `'once'`, `'weekly'`, `'biweekly'`, `'monthly'`

`gathering_status` enum: `'active'`, `'closed'`

### `gathering_game` join table

| Column | Type | Constraints |
|--------|------|-------------|
| `gathering_id` | `uuid` | FK → `gathering.id`, not null, on delete cascade |
| `game_id` | `uuid` | FK → `game.id`, not null |
| | | PK (`gathering_id`, `game_id`) |

### Indexes

- `gathering.host_id` — dashboard queries
- `gathering.zip_code` — search (until geocoding in Epic 4)
- `gathering.next_occurrence_at` — sort by upcoming
- `gathering.status` — filter active only
- `game.type` — filter by game type

### Migrations

Three Kysely migrations:

1. Create `game_type` enum + `game` table
2. Create `schedule_type` enum + `gathering_status` enum + `gathering` table
3. Create `gathering_game` join table

Run `kysely-codegen` after migrations to regenerate types.

### Seed script

A seed script in `packages/db` (e.g., `src/seed.ts`, run via `pnpm --filter db seed`) that inserts ~20-30 popular tabletop games:

- **Board games:** Catan, Ticket to Ride, Pandemic, Civilization, Azul, Wingspan, Terraforming Mars, Spirit Island, Gloomhaven, Codenames
- **TTRPGs:** Dungeons & Dragons 5e, Pathfinder 2e, Call of Cthulhu, Blades in the Dark, Fate Core
- **Card games:** Magic: The Gathering, Pokemon TCG, Arkham Horror LCG, Dominion, Exploding Kittens

Future nice-to-have: scrape BoardGameGeek for richer catalog data.

---

## API Layer

### tRPC `game` router

Read-only, public. Added to root router alongside existing `auth` router.

| Procedure | Type | Input | Output | Auth |
|-----------|------|-------|--------|------|
| `game.list` | query | `{ type?: GameType }` | `Game[]` | Public |
| `game.getById` | query | `{ id: uuid }` | `Game` | Public |

### tRPC `gathering` router

Full CRUD. Added to root router.

| Procedure | Type | Input | Output | Auth |
|-----------|------|-------|--------|------|
| `gathering.create` | mutation | `CreateGatheringInput` | `Gathering` | Protected |
| `gathering.update` | mutation | `UpdateGatheringInput` | `Gathering` | Protected (owner) |
| `gathering.delete` | mutation | `{ id }` | `{ success }` | Protected (owner) |
| `gathering.close` | mutation | `{ id }` | `Gathering` | Protected (owner) |
| `gathering.getById` | query | `{ id }` | `GatheringDetail` | Public |
| `gathering.listByHost` | query | none | `Gathering[]` | Protected |

### Procedure behaviors

**`gathering.create`:** Validate input → insert gathering → insert `gathering_game` rows → compute and set `next_occurrence_at` → return gathering with games.

**`gathering.update`:** Validate input → verify ownership (throw `FORBIDDEN` if not owner) → update gathering fields → replace `gathering_game` rows (delete old, insert new) → recompute `next_occurrence_at` → return gathering.

**`gathering.delete`:** Verify ownership → hard delete (cascade deletes `gathering_game` rows) → return `{ success: true }`.

**`gathering.close`:** Verify ownership → set `status = 'closed'` → return gathering.

**`gathering.getById`:** Fetch gathering joined with games and host display name. Throw `NOT_FOUND` if missing.

**`gathering.listByHost`:** Fetch all gatherings where `host_id = session userId`, ordered by `created_at` desc.

### `next_occurrence_at` computation

App-level utility function in `apps/server`. Given `schedule_type`, `starts_at`, and `end_date`:

- `once` → `starts_at`
- `weekly` → next occurrence of the same weekday ≥ now (or `starts_at` if in the future)
- `biweekly` → same, stepping in 2-week intervals from `starts_at`
- `monthly` → same day-of-month, next occurrence ≥ now

If `end_date` is set and the computed next occurrence is past it, set `next_occurrence_at` to `null`. Queries for active upcoming gatherings filter on `next_occurrence_at IS NOT NULL`.

No background job for the prototype. Recomputed on create/update.

### Validation schemas (`packages/contracts`)

New file `src/gathering.ts`:

- `createGatheringSchema` — title (1-255), gameIds (uuid[], min 1), zipCode (5-10 chars), scheduleType, startsAt (ISO datetime), endDate? (ISO date), durationMinutes? (positive int), maxPlayers? (positive int), description (1+)
- `updateGatheringSchema` — id (uuid) required, all other fields optional
- `gatheringSchema` — full gathering shape for responses

New file `src/game.ts`:

- `gameTypeSchema` — enum of game types
- `gameSchema` — full game shape for responses

### Error handling

| Scenario | tRPC code | Message |
|----------|-----------|---------|
| Gathering not found | `NOT_FOUND` | "Gathering not found" |
| Not the owner on update/delete/close | `FORBIDDEN` | "Not authorized" |
| Not authenticated on protected route | `UNAUTHORIZED` | "Not authenticated" |
| Invalid game IDs | `BAD_REQUEST` | "One or more games not found" |

---

## Web Layer

### Routes

| Path | Page | Auth |
|------|------|------|
| `/gatherings/new` | Create Gathering | Protected (redirect to `/login`) |
| `/gatherings/:id` | Gathering Details | Public |
| `/gatherings/:id/edit` | Edit Gathering | Protected (owner only) |
| `/dashboard` | Host Dashboard | Protected (redirect to `/login`) |

### Create Gathering page (`/gatherings/new`)

- Two-column grid for structured fields:
  - Row 1: Title, Games (multi-select from catalog via `game.list`)
  - Row 2: Zip Code, Schedule Type (select), Date & Time (datetime picker)
  - Row 3: End Date (conditional, only shown for recurring), Duration, Max Players
- Markdown editor section:
  - Left: CodeMirror 6 editor (monospace, Markdown syntax highlighting)
  - Right: Live preview pane (renders Markdown in real-time)
  - Below editor: "Upload .md/.txt" button + "vim mode: off/on" toggle
- Submit button: "Create Gathering"
- On success: redirect to `/gatherings/:id`

### Edit Gathering page (`/gatherings/:id/edit`)

Same form component as Create, pre-populated with existing data via `gathering.getById`. On success: redirect to `/gatherings/:id`.

If the current user is not the owner, redirect to the details page.

### Host Dashboard (`/dashboard`)

- Header with "Your Gatherings" title and "+ New Gathering" button (links to `/gatherings/new`)
- Table listing the user's gatherings via `gathering.listByHost`:
  - Columns: Title, Next Session, Players, Status, Actions
  - Status shown as badge (green "Active", yellow "Closed")
  - Actions: Edit (link to edit page), Close/Delete (inline actions with confirmation)
- Empty state: "You haven't created any gatherings yet." with a CTA to create one

### Gathering Details page (`/gatherings/:id`)

- Header: Title, "Hosted by [display name]", status badge
- Info card: Schedule (human-readable), Next Session date, Location (zip), Max Players
- Game tags: Badges for each linked game
- Body: Rendered Markdown (use a Markdown rendering library like `react-markdown`)
- If the current user is the owner: show "Edit" and "Close" action buttons

### Markdown Editor component (`apps/web`)

Lives in `apps/web/app/components/markdown-editor.tsx`. Not in `packages/ui` — it's app-specific.

- **Editor pane:** CodeMirror 6 with `@codemirror/lang-markdown`, monospace theme
- **Vim mode:** `@replit/codemirror-vim`, toggled via a button. Preference could be stored in localStorage.
- **File upload:** Accepts `.md` and `.txt` files. Reads file content and replaces editor content.
- **Preview pane:** Side-by-side, renders Markdown via `react-markdown` (or similar). Updates on every keystroke (debounced).
- **Props:** `value`, `onChange`, `placeholder`

### New Shadcn/UI components (`packages/ui`)

- `Select` — dropdown for schedule type, game type filters
- `Badge` — status badges, game tags
- `Textarea` — base textarea (fallback / other uses)
- `Table` — dashboard listing (Table, TableHeader, TableRow, TableCell)

### Nav updates

Add "Dashboard" link to the nav bar when logged in (between display name and logout).

---

## Testing

### Server integration tests (Vitest)

**Game router:**
- `game.list` — returns seeded games
- `game.list` with type filter — returns only matching type

**Gathering router:**
- `gathering.create` — happy path (creates gathering with games, correct `next_occurrence_at`)
- `gathering.create` — unauthenticated → `UNAUTHORIZED`
- `gathering.create` — invalid game IDs → `BAD_REQUEST`
- `gathering.update` — happy path, updates fields and games
- `gathering.update` — non-owner → `FORBIDDEN`
- `gathering.delete` — happy path, cascade deletes join rows
- `gathering.delete` — non-owner → `FORBIDDEN`
- `gathering.close` — sets status to closed
- `gathering.getById` — returns gathering with games and host
- `gathering.getById` — not found → `NOT_FOUND`
- `gathering.listByHost` — returns only current user's gatherings

**`next_occurrence_at` computation (unit tests):**
- `once` → returns `starts_at`
- `weekly` → returns next matching weekday
- `biweekly` → returns correct 2-week interval
- `monthly` → returns next matching day-of-month
- Recurring with `end_date` past → handles correctly

### Web tests

Not in scope for this epic. Server integration tests cover the business logic. E2e tests can be added in a future pass.

---

## Exit Criteria

A logged-in user can:

1. View the host dashboard with their gatherings listed
2. Create a new gathering with title, games, location, schedule, and Markdown description
3. See the gathering on their dashboard after creation
4. View the public details page with rendered Markdown and linked games
5. Edit their gathering (update fields, change games)
6. Close their gathering (sets status to closed)
7. Delete their gathering
8. Use the CodeMirror editor with vim mode toggle and file upload
9. Non-owners cannot edit/delete/close someone else's gathering
