# React Router 7 SSR Refactor Design

## Summary

Refactor the `apps/web` frontend to leverage React Router 7's `loader` and `action` functions for server-side rendering, replacing the current client-side React Query + tRPC pattern. All data fetching moves to loaders (SSR), all mutations move to actions, and React Query is removed entirely.

## Decisions

- **Approach:** Server-side tRPC client via `@trpc/client` with `httpBatchLink`, created per-request in loaders/actions
- **Architecture:** Keep apps decoupled — loaders/actions make HTTP calls to the tRPC backend (no in-process router import)
- **Auth pattern:** Protected route loaders redirect to `/login?returnTo=<path>` if unauthenticated
- **Client-side state:** Remove React Query entirely; rely on RR7's `useLoaderData`, `useActionData`, and built-in revalidation
- **Cookie forwarding for auth:** Login and signup actions use raw `fetch` to the tRPC backend (not the tRPC client) so `set-cookie` headers can be captured and forwarded to the browser

## Architecture

### New: Server-side tRPC helper

A new module `app/trpc/server.ts` that creates a typed tRPC client for use in loaders/actions:

```ts
import type { AppRouter } from '@game-finder/server/trpc/router'
import { createTRPCClient, httpBatchLink } from '@trpc/client'

export function createServerTRPC(cookie: string) {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${process.env.SERVER_URL}/trpc`,
        headers: () => (cookie ? { cookie } : {}),
      }),
    ],
  })
}
```

### Root loader

The root loader becomes the single source of truth for the current user:

```ts
export async function loader({ context }: Route.LoaderArgs) {
  const trpc = createServerTRPC(context.cookie)
  const user = await trpc.auth.me.query().catch(() => null)
  return { user }
}
```

The `Nav` component receives the user from root loader data. `TRPCReactProvider`, `QueryClientProvider`, and the `Suspense` wrapper are removed from `root.tsx`.

### Auth-protected route pattern

Protected routes check auth in their loader and redirect if missing:

```ts
export async function loader({ context, request }: Route.LoaderArgs) {
  const trpc = createServerTRPC(context.cookie)
  const user = await trpc.auth.me.query().catch(() => null)
  if (!user) throw redirect(`/login?returnTo=${new URL(request.url).pathname}`)
  // fetch route-specific data...
}
```

### Already-authenticated redirect pattern

Login and signup loaders redirect away if user is already authenticated:

```ts
export async function loader({ context }: Route.LoaderArgs) {
  const trpc = createServerTRPC(context.cookie)
  const user = await trpc.auth.me.query().catch(() => null)
  if (user) throw redirect('/')
  return {}
}
```

## Route-by-route changes

### home.tsx

- **Loader:** None needed (user comes from root loader)
- **Action:** None
- **Component:** Removes `useQuery(trpc.auth.me.queryOptions())`. Gets user via root loader data.

### search.tsx

- **Loader:** Parses URL search params (`zip`, `radius`, `q`, `types`, `sort`, `page`). If `zip` is present, calls `trpc.gathering.search.query(...)`. Returns results or null.
- **Action:** None
- **Component:** Uses `useLoaderData()` for results. Search form inputs remain controlled state. Submitting the form navigates with updated URL params (re-runs the loader). Removes `useQuery`.

### gatherings.$id.tsx

- **Loader:** Fetches `trpc.gathering.getById.query({ id: params.id })`. Throws 404 response if not found. Also fetches user from root or via `trpc.auth.me` for ownership check.
- **Action:** Handles `intent=close` via `trpc.gathering.close.mutate(...)`. RR7 revalidates the loader after action.
- **Component:** Uses `useLoaderData()`. Removes `useQuery`, `useMutation`, `useQueryClient`.

### gatherings.new.tsx

- **Loader:** Auth-protected. Redirects to `/login?returnTo=/gatherings/new` if not authenticated. Returns empty data.
- **Action:** Parses form data, calls `trpc.gathering.create.mutate(...)`. Redirects to `/gatherings/${result.id}` on success. Returns `{ errors }` on failure.
- **Component:** Uses RR7 `<Form>` or adapts `GatheringForm` to submit to the action. Uses `useActionData()` for errors. Removes `useMutation`, `useEffect` redirect.

### gatherings.$id.edit.tsx

- **Loader:** Auth-protected. Fetches gathering via `trpc.gathering.getById.query(...)`. Redirects if not authenticated or not the host. Returns gathering data for form pre-population.
- **Action:** Parses form data, calls `trpc.gathering.update.mutate(...)`. Redirects to `/gatherings/${params.id}` on success. Returns `{ errors }` on failure.
- **Component:** Uses `useLoaderData()` for initial form data. Uses `useActionData()` for errors. Removes `useMutation`, `useQuery`, `useEffect` redirects.

### dashboard.tsx

- **Loader:** Auth-protected. Fetches `trpc.gathering.listByHost.query()`. Returns user and gatherings list.
- **Action:** Handles `intent=close` and `intent=delete` via hidden form field. Calls appropriate tRPC mutation. RR7 revalidates the loader after action, refreshing the list.
- **Component:** Uses `useLoaderData()`. Removes `useQuery`, `useMutation`, `useQueryClient`, `useEffect` redirect.

### login.tsx

- **Loader:** Redirects to `/` if already authenticated.
- **Action:** Reads `email` and `password` from `FormData`. Makes a raw `fetch` POST to the tRPC backend's `auth.login` endpoint. Captures `set-cookie` headers from the response. Returns a redirect to `/` (or `returnTo` param) with the `set-cookie` headers forwarded.
- **Component:** Uses RR7 `<Form>`. Uses `useActionData()` for errors. Removes `useMutation`, `useQuery`, `useQueryClient`, `useEffect` redirect, `useState` for form fields (form fields become uncontrolled or use RR7 patterns).

### signup.tsx

- **Loader:** Redirects to `/` if already authenticated.
- **Action:** Same raw `fetch` pattern as login. Calls `auth.register` endpoint. Forwards `set-cookie` headers in the redirect response.
- **Component:** Same pattern as login. Uses `<Form>` and `useActionData()`.

## What gets removed

### Deleted files
- `app/trpc/provider.tsx` — `TRPCReactProvider`, `useTRPC`, client-side tRPC context
- `app/trpc/query-client.ts` — QueryClient factory

### Removed dependencies
- `@tanstack/react-query`
- `@trpc/tanstack-react-query`

### Removed patterns across all routes
- All `useQuery`, `useMutation`, `useQueryClient` imports and usage
- All `useEffect`-based auth redirects
- `Suspense` wrapper in `root.tsx`

## What gets added

### New files
- `app/trpc/server.ts` — server-side tRPC client factory (~10 lines)

### New exports in each route
- `loader` functions for SSR data fetching
- `action` functions for mutation handling

## What stays the same

- `app/server.ts` (Hono setup) — `/trpc/*` proxy remains for potential future client-side needs
- All UI components and visual styling — no visual changes
- `GatheringForm` component — minor adaptation to work with RR7 `<Form>` submission instead of `onSubmit` callback
- `@trpc/client` dependency — still used for the server-side client

## Cookie forwarding detail

For login and signup actions, the tRPC client is bypassed in favor of raw `fetch` calls. This is because `createTRPCClient` does not expose response headers, but auth mutations set session cookies via `set-cookie` that must be forwarded to the browser.

Pattern:
```ts
const res = await fetch(`${SERVER_URL}/trpc/auth.login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', cookie },
  body: JSON.stringify({ json: { email, password } }),
})
const data = await res.json()
const setCookie = res.headers.getSetCookie()
// Forward set-cookie in the redirect response
```

This only affects 2 routes (login, signup). All other mutations use the typed tRPC client normally.

## GatheringForm adaptation

The `GatheringForm` component currently accepts an `onSubmit` callback prop. It will need to be adapted to either:
- Render a RR7 `<Form>` that posts to the route's action (preferred)
- Or use `useSubmit()` to programmatically submit form data

The form fields themselves remain the same. The component will receive errors from `useActionData()` instead of local state.
