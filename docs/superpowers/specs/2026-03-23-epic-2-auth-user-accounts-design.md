# Epic 2: Auth & User Accounts — Design Spec

## Overview

Email/password authentication so hosts can create listings. Users register, log in, see their logged-in state in the nav, and log out. No email verification, no OAuth — simple and direct.

## Key Decisions

- **Session storage:** Server-side sessions in Redis (ioredis). Session ID in an httpOnly cookie, session data in Redis with 7-day TTL.
- **Auth library:** Hand-rolled. bcrypt for password hashing, thin session middleware. The auth surface is small enough that a library adds more complexity than it removes.
- **Password requirements:** Minimum 8 characters. No complexity rules.
- **Email verification:** None. Register and immediately log in.
- **Timestamps:** `created_at` + `updated_at` on all tables (convention going forward).

---

## Database

### `users` table

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `email` | `varchar(255)` | Unique, not null |
| `password_hash` | `varchar(255)` | Not null |
| `display_name` | `varchar(100)` | Not null |
| `created_at` | `timestamptz` | Not null, default `now()` |
| `updated_at` | `timestamptz` | Not null, default `now()` |

Single Kysely migration creates the table. Run `kysely-codegen` after to generate types.

### Sessions

Stored in Redis, not in the database.

- Key: `session:<uuid>`
- Value: JSON `{ userId, createdAt }`
- TTL: 7 days (604800 seconds)

No sessions table. Redis handles expiry automatically.

---

## Redis Integration

### Package: `packages/db`

New file `src/redis.ts` alongside the existing Kysely client:

- Exports `createRedisClient()` factory using `ioredis`
- Env vars: `REDIS_HOST`, `REDIS_PORT` (required, throw if missing — same pattern as DB env vars)
- Docker Compose already has Redis on port 6379

### Session helpers: `apps/server`

Sessions are an app concern, not a db concern. Three functions:

- `createSession(userId)` — generates UUID, stores in Redis with 7-day TTL, returns session ID
- `getSession(sessionId)` — fetches from Redis, returns `{ userId }` or null
- `deleteSession(sessionId)` — removes from Redis

---

## API Layer

### tRPC auth router

New `auth` router added to the root router alongside the existing `health` router.

| Procedure | Type | Input | Output | Auth |
|-----------|------|-------|--------|------|
| `auth.register` | mutation | `{ email, password, displayName }` | `{ user }` | Public |
| `auth.login` | mutation | `{ email, password }` | `{ user }` | Public |
| `auth.logout` | mutation | none | `{ success }` | Protected |
| `auth.me` | query | none | `{ user }` or `null` | Public |

`user` in responses contains `id`, `email`, `displayName`, `createdAt`. Never includes `passwordHash`.

### Validation schemas (`packages/contracts`)

Zod schemas shared between client and server:

- `email` — valid email format, lowercased and trimmed
- `password` — string, min 8 characters
- `displayName` — string, min 1, max 100, trimmed

### Auth middleware

Hono middleware that runs before tRPC:

1. Reads `session_id` cookie from the request
2. Looks up the session in Redis via `getSession()`
3. If valid, attaches `userId` to the request context
4. tRPC context factory reads `userId` from the Hono context

### tRPC procedures

- `publicProcedure` — existing, no auth required
- `protectedProcedure` — new, throws `UNAUTHORIZED` if no `userId` in context

### Cookie configuration

- Name: `session_id`
- httpOnly: true
- secure: true in production, false in development
- sameSite: lax
- path: `/`
- maxAge: 7 days (604800 seconds)

### Auth flows

**Register:** Validate input → check email uniqueness (throw `CONFLICT` if taken) → hash password with bcrypt → insert user → create session → set cookie → return user.

**Login:** Validate input → find user by email → compare password with bcrypt (throw `UNAUTHORIZED` if mismatch or no user) → create session → set cookie → return user.

**Logout:** Delete session from Redis → clear cookie → return `{ success: true }`.

**Me:** Read `userId` from context → if null, return null → otherwise fetch user from DB and return.

---

## Web Layer

### Routes

| Path | Page | Auth guard |
|------|------|------------|
| `/` | Home | None (existing) |
| `/login` | Log In | Redirect to `/` if logged in |
| `/signup` | Sign Up | Redirect to `/` if logged in |

Logout is not a route — it's a nav button that calls `auth.logout` and redirects to `/`.

### Nav bar

Lives in the root layout (`root.tsx`). Calls `auth.me` to determine auth state.

**Logged out:**
- Left: "Game Finder" (logo/text, links to `/`)
- Right: "Log In" link + "Sign Up" button

**Logged in:**
- Left: "Game Finder" (logo/text, links to `/`)
- Right: Display name + "Log Out" link

Simple inline layout. No dropdown menu — can evolve in later epics when there are more menu items.

### Sign Up page (`/signup`)

- Centered card layout on blank page
- Heading: "Create an account"
- Fields: Display Name, Email, Password
- Field-level validation errors displayed below each field
- Submit calls `auth.register`, on success redirects to `/`
- Footer link: "Already have an account? Log in" (links to `/login`)

### Log In page (`/login`)

- Centered card layout on blank page
- Heading: "Welcome back"
- Fields: Email, Password
- Field-level validation errors displayed below each field
- Submit calls `auth.login`, on success redirects to `/`
- Footer link: "Don't have an account? Sign up" (links to `/signup`)

### New Shadcn components (`packages/ui`)

- `Input` — text input component
- `Card` — card container (CardHeader, CardContent, CardFooter)
- `Label` — form field label

Auth form logic lives in `apps/web` route components. No shared form abstraction — the two forms are different enough to keep separate.

---

## Error Handling

### Server-side errors

| Scenario | tRPC code | Message |
|----------|-----------|---------|
| Duplicate email on register | `CONFLICT` | "Email already in use" |
| Invalid credentials on login | `UNAUTHORIZED` | "Invalid email or password" |
| Expired/invalid session on protected route | `UNAUTHORIZED` | "Not authenticated" |

Login error is deliberately vague — does not reveal whether the email exists.

### Client-side error display

- tRPC errors are caught and mapped to field-level messages where applicable (e.g., duplicate email → error under email field)
- Generic errors (network issues, unexpected server errors) show as a banner above the form

### Cookie passthrough

The web app's Hono server proxies `/trpc/*` to the API server. The proxy must:

- Forward the `Cookie` header from the browser to the API server
- Pass `Set-Cookie` headers from the API server back to the browser

This is the trickiest integration point and requires careful attention in the proxy middleware.

---

## Testing

### Server integration tests (Vitest)

- **Session helpers:** create, get, delete sessions against real Redis
- **Register:** happy path, duplicate email error
- **Login:** happy path, wrong password, nonexistent email
- **Logout:** clears session
- **Me:** returns user when logged in, returns null when not

### Web tests

Not in scope for this epic. Auth forms are thin wrappers around tRPC calls. Server integration tests cover the important logic. E2e tests (Playwright MCP) can be added in a future pass.

---

## Exit Criteria

A user can:

1. Register with email, password, and display name
2. Be automatically logged in after registration
3. See their display name in the nav bar
4. Log out via the nav bar
5. Log back in with their credentials
6. See login/signup pages redirect to home if already authenticated
