# Game Finder — Epic Breakdown

## Product Summary

Game Finder is a classifieds board for tabletop gaming. Users search by zip code + radius to find local board games, TTRPGs, and card game sessions to join. They browse results, read game details (rendered Markdown), and contact the host via an anonymous contact form that emails the host.

### Key decisions

- **Auth:** Email/password. Required for hosts, optional for searchers. Anonymous browsing and contacting is fully supported.
- **Game types:** Board games, TTRPGs, card games.
- **Listing model:** Structured fields (title, type, location, schedule, player count) + freeform Markdown body. Different game types have different details, so the flexible body handles that variation.
- **Contact flow:** In-app contact form sends an email to the host. No accounts required for the searcher.
- **Location search:** Zip code + radius (requires geocoding).
- **Host tools:** CRUD with active/closed status. Simple dashboard.
- **Dockerized:** Full stack runs via `docker compose up`.

### Architecture (from CLAUDE.md)

- Monorepo: pnpm + Turborepo
- TypeScript everywhere
- `apps/web` — React Router 7 (SSR via Hono), Tailwind, Shadcn
- `apps/server` — Hono + tRPC API server
- `packages/db` — Kysely, PostgreSQL
- `packages/contracts` — Zod schemas, shared types
- `packages/shared` — Utilities
- `packages/ui` — Shadcn component library

---

## Epic 1: Project Foundation

Monorepo scaffolding and infrastructure. Everything needed before feature work begins.

### Scope

- pnpm workspaces + Turborepo config
- TypeScript configuration (root + per-package)
- `packages/db` — Kysely connection, migration tooling (no schema yet)
- `packages/contracts` — Zod + types scaffolding
- `packages/shared` — utility scaffolding
- `packages/ui` — Shadcn setup with Tailwind
- `apps/server` — Hono + tRPC boilerplate (health check endpoint)
- `apps/web` — React Router 7 + Hono SSR boilerplate (renders a hello world)
- Dockerfiles for web and server apps
- `docker-compose.yml` — full stack: web, server, Postgres (Redis placeholder for later)
- Dev workflow via `docker compose up` with hot reload inside containers
- Dev tooling: ESLint, `.env.example`

### Exit criteria

`docker compose up` starts the full stack — web app renders, server responds to a health check, DB connects.

---

## Epic 2: Auth & User Accounts

User authentication so hosts can create listings.

### Scope

- DB schema: `users` table (email, hashed password, name, created_at)
- API: tRPC endpoints — register, login, logout, get current user
- Session management: cookie-based sessions
- Web: Sign up, log in, log out pages
- Web: Logged-in state in nav (username, logout button)

### Exit criteria

A user can register, log in, see their logged-in state in the nav, and log out.

---

## Epic 3: Create & Manage Game Listings

Hosts create and manage their games. Defines the real data model.

### Scope

- DB schema: `games` table — title, game type, location/zip, schedule, player count, Markdown body, status (active/closed), host user FK
- API: tRPC CRUD endpoints — create, read, update, delete, close listing (protected behind auth)
- Web: Create listing page — form with structured fields + Markdown editor for the body
- Web: Host dashboard — list of the host's own listings, edit/delete/close actions
- Web: Game details page — public view with rendered Markdown body

### Exit criteria

A logged-in user can create a game listing, see it on their dashboard, edit/delete/close it, and view the public details page with rendered Markdown.

---

## Epic 4: Search & Browse Games

The discovery experience. Search has real data from Epic 3 to work with.

### Scope

- Geocoding: zip code to lat/lng lookup for radius-based search
- API: tRPC search endpoint — zip + radius + optional text query, paginated results
- Web: Search page — search form (zip code, radius selector, optional keyword) + results list with game cards (title, type, distance, player count, next session)
- Web: Filter by game type, sort options

### Exit criteria

A user can enter a zip code and radius, see matching game listings, filter by game type, and page through results.

---

## Epic 5: Contact Host

The final piece of the user journey — reaching out to a host.

### Scope

- API: Contact endpoint — accepts message + sender email/name, sends email to host
- Email integration: transactional email service (Resend, SendGrid, or similar)
- Web: Contact form on the game details page (works anonymous or logged-in, pre-fills info for logged-in users)
- Rate limiting: basic spam prevention on the contact endpoint

### Exit criteria

A user (anonymous or logged-in) can send a message to a host from the game details page, and the host receives it via email.

---

## Delivery

Each epic maps to a GitHub milestone. Issues within each milestone break down the work into implementable chunks. Each epic gets its own design/plan/implementation cycle.

### Epic order

1. Project Foundation
2. Auth & User Accounts
3. Create & Manage Game Listings
4. Search & Browse Games
5. Contact Host

Each epic builds on the previous one. The order is designed so that each completed epic produces a working, demoable increment.
