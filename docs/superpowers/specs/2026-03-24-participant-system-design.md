# Design: Gathering Participant System

**Date:** 2026-03-24
**Status:** Approved
**Depends on:** Nothing (ships first)
**Depended on by:** Friendship System

## Overview

Adds the ability for users to join, leave, and be waitlisted for gatherings. Introduces public/private gathering visibility with shareable invite links for private gatherings. Transforms gatherings from static listings into interactive events users can participate in.

## Background

Currently, gatherings display a `max_players` field but have no participant tracking. Users can only view gathering details and contact the host externally. This design adds an in-app participation model.

Inspired by roll-api's session participant system, but simplified for game-finder's prototype scope: no invite-per-user flow, no accept/decline lifecycle. Private gatherings use shareable join codes instead.

## Data Model

### New table: `gathering_participant`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | auto-generated |
| `gathering_id` | uuid FK -> gathering | cascade delete |
| `user_id` | uuid FK -> users | |
| `status` | enum: `joined`, `waitlisted` | |
| `created_at` | timestamptz | used for waitlist ordering |

Unique constraint on `(gathering_id, user_id)`.

### New columns on `gathering`

- `visibility` — enum: `public`, `private` (default: `public`)
- `join_code` — varchar(8), nullable, unique index. Auto-generated when visibility is `private`.

### Auto-promote logic

When a participant with `joined` status leaves a gathering that has `max_players` set, the system auto-promotes the oldest `waitlisted` participant (by `created_at`) to `joined` status. This happens in the same transaction as the leave.

## API: tRPC Procedures

### New procedures on the `gathering` router

#### `join`
- **Auth:** protected
- **Input:** `{ gatheringId: uuid, joinCode?: string }`
- **Logic:**
  1. Validate gathering exists and is `active`
  2. Validate user is not already a participant
  3. Validate user is not the host (host is implicitly "in" the gathering)
  4. If visibility is `private`, validate `joinCode` matches
  5. If `max_players` is set and count of `joined` participants >= `max_players`, set status to `waitlisted`
  6. Otherwise set status to `joined`
- **Returns:** participant record with status

#### `leave`
- **Auth:** protected
- **Input:** `{ gatheringId: uuid }`
- **Logic:**
  1. Validate user is a participant (not the host)
  2. Record whether leaver had `joined` status
  3. Delete the participant row
  4. If leaver was `joined` and `max_players` is set, auto-promote oldest waitlisted participant
- **Returns:** `{ success: true }`

#### `listParticipants`
- **Auth:** public
- **Input:** `{ gatheringId: uuid }`
- **Returns:** Array of `{ id, userId, displayName, status, createdAt }` ordered by `createdAt`

### Changes to existing procedures

#### `create`
- Accepts new optional `visibility` field (defaults to `public`)
- If `private`, auto-generates a random 8-character alphanumeric `join_code`

#### `update`
- Accepts optional `visibility` field
- If changed to `private` and no `join_code` exists, generate one
- If changed to `public`, clear the `join_code`

#### `getById`
- Response includes:
  - `visibility` field
  - `joinCode` — only returned when the current user is the host; `null` for everyone else
  - `participantCount` — count of `joined` participants (computed at query time)
  - `currentUserStatus` — `joined`, `waitlisted`, or `null` if not a participant (computed at query time, requires auth context; `null` for unauthenticated users)

#### `search`
- Filters to `public` gatherings only. Private gatherings are not discoverable via search.

## Contracts (Zod Schemas)

### New schemas in `packages/contracts`

```typescript
gatheringVisibilitySchema = z.enum(['public', 'private'])

participantStatusSchema = z.enum(['joined', 'waitlisted'])

joinGatheringSchema = z.object({
  gatheringId: z.string().uuid(),
  joinCode: z.string().optional(),
})

leaveGatheringSchema = z.object({
  gatheringId: z.string().uuid(),
})

listParticipantsSchema = z.object({
  gatheringId: z.string().uuid(),
})

participantSchema = z.object({
  id: z.string().uuid(),
  gatheringId: z.string().uuid(),
  userId: z.string().uuid(),
  displayName: z.string(),
  status: participantStatusSchema,
  createdAt: z.string().datetime(),
})
```

### Updates to existing schemas

- `createGatheringSchema` — add `visibility: gatheringVisibilitySchema.default('public')`
- `updateGatheringSchema` — add `visibility: gatheringVisibilitySchema.optional()`
- `gatheringSchema` — add `visibility`, `joinCode` (nullable string), `participantCount` (number), `currentUserStatus` (participantStatusSchema nullable)

## Web UI Changes

### Gathering detail page (`/gatherings/:id`)

- **Participant count**: Display "4/6 players" (or "4 players" if no max) near the gathering info
- **Participant list**: Section showing display names with status badges (`joined` / `waitlisted`)
- **Join/Leave button** (contextual):
  - Not joined -> "Join Game" button (for private: prompts for join code if accessed without one in URL)
  - Joined -> "Leave Game" button
  - Waitlisted -> "Leave Waitlist" button with position indicator ("You're #3 on the waitlist")
  - Host -> no join/leave button (sees Edit/Close instead)
- **Private gathering invite link**: Host sees a "Share Invite Link" section with a copyable URL (`/gatherings/:id?code=ABC123`)
- **Join via URL**: When accessing `/gatherings/:id?code=ABC123`, the code is pre-filled so joining is one click

### Dashboard (`/dashboard`)

- New section: **"My Games"** — gatherings the user has joined (not hosted)
  - Shows gathering title, next occurrence, status badge (joined/waitlisted)
  - Links to gathering detail page

### Gathering form (create/edit)

- New field: **Visibility toggle** — Public / Private radio group, defaulting to Public

### Search results

- No UI changes needed. Backend filters to public-only.

## Migration

Single Kysely migration:

1. Create `gathering_participant` table with columns, FK constraints, unique constraint, and index on `gathering_id`
2. Create enum types `gathering_visibility` and `participant_status`
3. Add `visibility` column to `gathering` (non-nullable, default `public`)
4. Add `join_code` column to `gathering` (nullable, unique index)

## Out of scope

- In-app notifications when auto-promoted from waitlist
- Host-sends-invite flow (using shareable codes instead)
- Hybrid visibility (public after a date) — future enhancement
- Participant chat or messaging
- Participant limits per user (e.g., max gatherings you can join)
