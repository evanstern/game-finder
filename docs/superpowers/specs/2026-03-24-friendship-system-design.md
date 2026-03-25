# Design: Friendship System

**Date:** 2026-03-24
**Status:** Approved
**Depends on:** Participant System
**Depended on by:** Nothing

## Overview

Adds a mutual friendship model that enables social discovery of gatherings. Users who share a gathering (as host or participant) can send friend requests. Accepted friends can see each other's public gathering activity. Turns game-finder from a classifieds board into a platform with a social graph.

## Background

Currently, game-finder has no social layer. Users find gatherings via search, but there's no way to stay connected with people you've played with. This design adds friendships gated by shared gathering participation, plus a "friend activity" feed for social discovery.

Inspired by roll-api's friendship system but adapted: no `RelationshipType` enum (YAGNI), no `BLOCKED` status, and friend requests are gated by shared gathering participation rather than open to any user ID.

## Data Model

### New table: `friendship`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | auto-generated |
| `requester_id` | uuid FK -> users | who sent the request |
| `addressee_id` | uuid FK -> users | who received it |
| `status` | enum: `pending`, `accepted`, `declined` | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

Unique constraint on `(requester_id, addressee_id)`.

### Bidirectional uniqueness

The application layer checks for an existing row in either direction before inserting. If A->B exists (in any status), B->A is rejected with 409 Conflict. This prevents mirrored rows.

### Shared gathering gate

To send a friend request, both users must appear in the same gathering — either as the host (`gathering.host_id`) or as a participant (`gathering_participant.user_id`). This is validated at request time via a query joining `gathering` and `gathering_participant`.

## API: tRPC Procedures

### New `friendship` router

All procedures require authentication.

#### `sendRequest`
- **Input:** `{ userId: uuid }`
- **Logic:**
  1. Cannot friend yourself -> 400
  2. Check for existing row in either direction -> 409 if exists
  3. Validate target user exists -> 404
  4. Validate shared gathering exists (either user is host or participant in the same gathering) -> 403 if no shared gathering
  5. Create friendship row with status `pending`
- **Returns:** friendship record

#### `acceptRequest`
- **Input:** `{ friendshipId: uuid }`
- **Logic:**
  1. Validate friendship exists and is `pending`
  2. Validate current user is the addressee -> 403
  3. Update status to `accepted`
- **Returns:** friendship record

#### `declineRequest`
- **Input:** `{ friendshipId: uuid }`
- **Logic:**
  1. Validate friendship exists and is `pending`
  2. Validate current user is the addressee -> 403
  3. Update status to `declined`
- **Returns:** friendship record

#### `remove`
- **Input:** `{ friendshipId: uuid }`
- **Logic:**
  1. Validate friendship exists
  2. Validate current user is either requester or addressee -> 403
  3. Delete the row
- **Returns:** `{ success: true }`

#### `listFriends`
- **Input:** `{}`
- **Returns:** Array of `{ friendshipId, friendId, displayName, createdAt }`. The `friendId` is computed: whichever of `requester_id` / `addressee_id` is NOT the current user.

#### `listIncomingRequests`
- **Input:** `{}`
- **Returns:** Array of friendship records where `addressee_id` is the current user and status is `pending`. Includes requester's `displayName`.

### New procedure on `gathering` router

#### `friendActivity`
- **Auth:** protected
- **Input:** `{ page?: number, pageSize?: number }` (default page 1, pageSize 20, max 50)
- **Logic:**
  1. Get current user's accepted friend IDs
  2. Query public gatherings where a friend is the host OR a joined participant
  3. Exclude gatherings the current user already participates in or hosts
  4. Order by `next_occurrence_at` ascending (soonest first)
  5. Paginate
- **Returns:** `{ gatherings: Array<gathering with friend names>, total, page, pageSize }`

Each result includes a `friends` array indicating which friends are involved and their role (host or participant).

## Contracts (Zod Schemas)

### New schemas in `packages/contracts`

```typescript
friendshipStatusSchema = z.enum(['pending', 'accepted', 'declined'])

sendFriendRequestSchema = z.object({
  userId: z.string().uuid(),
})

friendshipActionSchema = z.object({
  friendshipId: z.string().uuid(),
})

friendshipSchema = z.object({
  id: z.string().uuid(),
  requesterId: z.string().uuid(),
  addresseeId: z.string().uuid(),
  status: friendshipStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

friendSchema = z.object({
  friendshipId: z.string().uuid(),
  friendId: z.string().uuid(),
  displayName: z.string(),
  createdAt: z.string().datetime(),
})

incomingRequestSchema = friendshipSchema.extend({
  requesterDisplayName: z.string(),
})

friendActivityInputSchema = z.object({
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(50).default(20),
})

friendActivityGatheringSchema = gatheringSchema.extend({
  friends: z.array(z.object({
    friendId: z.string().uuid(),
    displayName: z.string(),
    role: z.enum(['host', 'participant']),
  })),
})

friendActivityOutputSchema = z.object({
  gatherings: z.array(friendActivityGatheringSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
})
```

## Web UI Changes

### Gathering detail page (`/gatherings/:id`)

- **Add Friend button**: Shown next to each participant (and the host) in the participant list. Not shown if:
  - It's the current user
  - Already friends
  - Request already pending (show "Pending" badge instead)

### Nav bar

- **Friend request badge**: Small count indicator on a bell/people icon when there are pending incoming requests. Links to `/friends`.

### New route: `/friends`

Two sections:

- **Friend Requests**: Incoming pending requests with requester display name and Accept/Decline buttons. Empty state: "No pending requests."
- **My Friends**: List of accepted friends with display names and "Remove Friend" action (with confirmation). Empty state: "No friends yet. Join a gathering to meet people!"

### New route: `/friends/activity`

- **Friend Activity feed**: Public gatherings friends are hosting or playing in
- Each card shows:
  - Gathering title
  - Which friend(s) are involved (with role badges: "hosting" / "playing")
  - Next session date
  - Location (zip code / city)
- Links to gathering detail page
- Paginated
- Empty state: "Your friends aren't in any upcoming gatherings." or "Add friends from gatherings you've joined!"

### Dashboard (`/dashboard`)

- **Friend Activity preview**: A compact section showing count/summary ("3 friends are playing this week") with link to `/friends/activity`

## Migration

Single Kysely migration:

1. Create `friendship_status` enum type (`pending`, `accepted`, `declined`)
2. Create `friendship` table with columns, FK constraints, unique constraint on `(requester_id, addressee_id)`
3. Index on `addressee_id` (for incoming request queries)
4. Index on `status` (for filtering accepted friendships)

## Out of scope

- Blocking users
- Follow/fan relationship types
- Friend suggestions / recommendations
- Notifications (in-app or email) for friend requests or activity
- Mutual friend counts or social graph analytics
- User search by name/email (friend requests are gated by shared gatherings)
