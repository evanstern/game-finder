# RR7 SSR Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the web app to use React Router 7 loaders and actions for all data fetching and mutations, replacing client-side React Query + tRPC with server-side rendering.

**Architecture:** Each route exports `loader` (data fetching) and `action` (mutations) functions that call the tRPC backend via a server-side tRPC client over HTTP. React Query is removed entirely. Components consume data via `useLoaderData()` and `useActionData()`. Auth-protected routes redirect from loaders.

**Tech Stack:** React Router 7 (loaders/actions), @trpc/client (server-side), Hono (SSR server)

**Spec:** `docs/superpowers/specs/2026-03-24-rr7-ssr-refactor-design.md`

---

## File Structure

### New files
- `apps/web/app/trpc/server.ts` — Server-side tRPC client factory
- `apps/web/app/routes/logout.tsx` — Resource route for logout action (no component)

### Modified files
- `apps/web/app/root.tsx` — Add auth.me to loader, remove TRPCReactProvider/Suspense
- `apps/web/app/components/nav.tsx` — Get user from root loader data, convert logout to fetcher action
- `apps/web/app/components/gathering-form.tsx` — Remove useQuery/useTRPC, accept games as prop, use hidden inputs for gameIds
- `apps/web/app/routes/home.tsx` — Remove useQuery, get user from root loader
- `apps/web/app/routes/search.tsx` — Add loader for search, remove useQuery
- `apps/web/app/routes/gatherings.$id.tsx` — Add loader + action, remove useQuery/useMutation
- `apps/web/app/routes/gatherings.new.tsx` — Add loader + action, remove useQuery/useMutation/useEffect
- `apps/web/app/routes/gatherings.$id.edit.tsx` — Add loader + action, remove useQuery/useMutation/useEffect
- `apps/web/app/routes/dashboard.tsx` — Add loader + action, remove useQuery/useMutation/useEffect
- `apps/web/app/routes/login.tsx` — Add loader + action (raw fetch), remove useQuery/useMutation/useEffect
- `apps/web/app/routes/signup.tsx` — Add loader + action (raw fetch), remove useQuery/useMutation/useEffect

### Deleted files
- `apps/web/app/trpc/provider.tsx`
- `apps/web/app/trpc/query-client.ts`

---

## Task 1: Create server-side tRPC client

**Files:**
- Create: `apps/web/app/trpc/server.ts`

- [ ] **Step 1: Create the server tRPC client factory**

```ts
// apps/web/app/trpc/server.ts
import type { AppRouter } from '@game-finder/server/trpc/router'
import { createTRPCClient, httpBatchLink } from '@trpc/client'

export function createServerTRPC(cookie: string) {
  const serverUrl = process.env.SERVER_URL
  if (!serverUrl) {
    throw new Error('SERVER_URL environment variable is required')
  }

  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${serverUrl}/trpc`,
        headers: () => (cookie ? { cookie } : {}),
      }),
    ],
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/trpc/server.ts
git commit -m "feat(web): add server-side tRPC client factory"
```

---

## Task 2: Refactor root loader and remove React Query providers

**Files:**
- Modify: `apps/web/app/root.tsx`

- [ ] **Step 1: Rewrite root.tsx**

Replace the root loader to fetch `auth.me` server-side. Remove `TRPCReactProvider`, `QueryClientProvider`, and `Suspense` wrapper. The component becomes:

```tsx
import '@game-finder/ui/styles/globals.css'
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from 'react-router'
import type { Route } from './+types/root.js'
import { Nav } from './components/nav.js'
import { createServerTRPC } from './trpc/server.js'

export async function loader({ context }: Route.LoaderArgs) {
  const ctx = context as { cookie?: string }
  const trpc = createServerTRPC(ctx.cookie ?? '')
  const user = await trpc.auth.me.query().catch(() => null)
  return { user }
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/android-chrome-192x192.png" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export default function Root({ loaderData }: Route.ComponentProps) {
  return (
    <>
      <Nav user={loaderData.user} />
      <Outlet />
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/root.tsx
git commit -m "refactor(web): move auth.me to root loader, remove React Query providers"
```

---

## Task 3: Refactor Nav component

**Files:**
- Modify: `apps/web/app/components/nav.tsx`

The Nav component currently fetches `auth.me` via useQuery and uses useMutation for logout. It needs to:
1. Accept `user` as a prop from the root loader
2. Use a `fetcher` to POST to a logout action

- [ ] **Step 1: Rewrite Nav component**

```tsx
import { Button } from '@game-finder/ui/components/button'
import { Logo } from '@game-finder/ui/components/logo'
import { useState } from 'react'
import { Link, useFetcher } from 'react-router'

interface NavUser {
  id: string
  displayName: string
}

export function Nav({ user }: { user: NavUser | null }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const fetcher = useFetcher()
  const isLoggingOut = fetcher.state !== 'idle'

  return (
    <nav className="border-b border-border bg-card/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center">
          <Logo size="sm" />
        </Link>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="md:hidden text-muted-foreground"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? '✕' : '☰'}
        </Button>
        <div className="hidden md:flex items-center gap-5">
          <Link to="/search" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Find Games
          </Link>
          <Link to="/gatherings/new" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Post a Game
          </Link>
          {user ? (
            <>
              <span className="text-sm font-medium text-primary">
                {user.displayName}
              </span>
              <Link
                to="/dashboard"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Dashboard
              </Link>
              <fetcher.Form method="post" action="/logout">
                <Button
                  type="submit"
                  variant="ghost"
                  size="sm"
                  disabled={isLoggingOut}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Log Out
                </Button>
              </fetcher.Form>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="text-sm leading-none text-muted-foreground transition-colors hover:text-foreground"
              >
                Log In
              </Link>
              <Link
                to="/signup"
                className="text-sm font-semibold text-primary"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border bg-card/95 backdrop-blur-md px-6 py-4 flex flex-col gap-3">
          <Link to="/search" className="text-sm text-muted-foreground" onClick={() => setMobileMenuOpen(false)}>Find Games</Link>
          <Link to="/gatherings/new" className="text-sm text-muted-foreground" onClick={() => setMobileMenuOpen(false)}>Post a Game</Link>
          {user ? (
            <>
              <span className="text-sm font-medium text-primary">{user.displayName}</span>
              <fetcher.Form method="post" action="/logout">
                <Button
                  type="submit"
                  variant="ghost"
                  size="sm"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-muted-foreground justify-start"
                >
                  Log Out
                </Button>
              </fetcher.Form>
            </>
          ) : (
            <>
              <Link to="/login" className="text-sm text-muted-foreground" onClick={() => setMobileMenuOpen(false)}>Log In</Link>
              <Link to="/signup" className="text-sm text-primary font-semibold" onClick={() => setMobileMenuOpen(false)}>Sign Up</Link>
            </>
          )}
        </div>
      )}
    </nav>
  )
}
```

- [ ] **Step 2: Add the logout route**

Add a new resource route (no component) at `apps/web/app/routes/logout.tsx`:

```tsx
import { redirect } from 'react-router'
import type { Route } from './+types/logout.js'

export async function action({ context }: Route.ActionArgs) {
  const ctx = context as { cookie?: string }
  const serverUrl = process.env.SERVER_URL
  if (!serverUrl) throw new Error('SERVER_URL environment variable is required')

  const res = await fetch(`${serverUrl}/trpc/auth.logout`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(ctx.cookie ? { cookie: ctx.cookie } : {}),
    },
    body: JSON.stringify({}),
  })

  const setCookies = res.headers.getSetCookie()
  const headers = new Headers()
  for (const cookie of setCookies) {
    headers.append('set-cookie', cookie)
  }

  return redirect('/', { headers })
}
```

- [ ] **Step 3: Register the logout route in routes.ts**

Add to `apps/web/app/routes.ts`:

```ts
route('logout', 'routes/logout.tsx'),
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/components/nav.tsx apps/web/app/routes/logout.tsx apps/web/app/routes.ts
git commit -m "refactor(web): convert Nav to use root loader data and fetcher logout"
```

---

## Task 4: Refactor home route

**Files:**
- Modify: `apps/web/app/routes/home.tsx`

The home page currently fetches `auth.me` via useQuery to show a welcome message. The user now comes from the root loader.

- [ ] **Step 1: Rewrite home.tsx**

Remove `useQuery`, `useTRPC` imports. Use `useRouteLoaderData` from react-router to access root loader data. The `SearchCard` component stays the same (it uses client-side navigation, no data fetching).

Key changes:
- Remove: `import { useQuery } from '@tanstack/react-query'`, `import { useTRPC } from '../trpc/provider.js'`
- Remove: `const trpc = useTRPC()`, `const { data: user, isLoading } = useQuery(...)`
- Remove: `if (isLoading) return null`
- Add: `import { useRouteLoaderData } from 'react-router'`
- Add: `const rootData = useRouteLoaderData('root') as { user: { displayName: string } | null }` then `const user = rootData?.user`

Everything else in the component stays identical.

- [ ] **Step 2: Verify the app builds**

Run: `cd /Users/evanstern/projects/evanstern/game-finder && pnpm turbo build --filter=@game-finder/web`

Expected: Build succeeds. If type errors occur around `useRouteLoaderData`, check the RR7 generated types — the root route ID is typically `'root'`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/routes/home.tsx
git commit -m "refactor(web): home route uses root loader for user data"
```

---

## Task 5: Refactor login route

**Files:**
- Modify: `apps/web/app/routes/login.tsx`

Login needs both a loader (redirect if already authenticated) and an action (raw fetch to tRPC backend to capture set-cookie headers).

- [ ] **Step 1: Rewrite login.tsx**

```tsx
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
import { Form, Link, redirect, useActionData, useNavigation } from 'react-router'
import { MapBackground } from '../components/map-background.js'
import { createServerTRPC } from '../trpc/server.js'
import type { Route } from './+types/login.js'

export async function loader({ context }: Route.LoaderArgs) {
  const ctx = context as { cookie?: string }
  const trpc = createServerTRPC(ctx.cookie ?? '')
  const user = await trpc.auth.me.query().catch(() => null)
  if (user) throw redirect('/')
  return {}
}

export async function action({ request, context }: Route.ActionArgs) {
  const ctx = context as { cookie?: string }
  const formData = await request.formData()
  const email = String(formData.get('email') ?? '')
  const password = String(formData.get('password') ?? '')

  const serverUrl = process.env.SERVER_URL
  if (!serverUrl) throw new Error('SERVER_URL environment variable is required')

  const res = await fetch(`${serverUrl}/trpc/auth.login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(ctx.cookie ? { cookie: ctx.cookie } : {}),
    },
    body: JSON.stringify({ json: { email, password } }),
  })

  const body = await res.json()

  if (!res.ok || body.error) {
    const message = body.error?.json?.message ?? 'Login failed'
    return { errors: { form: message } }
  }

  const setCookies = res.headers.getSetCookie()
  const headers = new Headers()
  for (const cookie of setCookies) {
    headers.append('set-cookie', cookie)
  }

  const url = new URL(request.url)
  const returnTo = url.searchParams.get('returnTo') ?? '/'
  return redirect(returnTo, { headers })
}

export default function LogIn({ actionData }: Route.ComponentProps) {
  const navigation = useNavigation()
  const isPending = navigation.state === 'submitting'
  const errors = actionData?.errors ?? {}

  return (
    <div className="relative flex min-h-[calc(100vh-65px)] items-center justify-center px-6">
      <MapBackground />

      <Card className="animate-fade-in-up relative z-10 w-full max-w-sm border-border bg-card/80 backdrop-blur-sm">
        <CardHeader className="text-center">
          <p className="mb-1 text-[11px] font-semibold tracking-[0.2em] text-primary uppercase">
            Welcome back
          </p>
          <CardTitle className="text-xl font-bold tracking-tight text-foreground">
            Log in to your account
          </CardTitle>
        </CardHeader>
        <Form method="post">
          <CardContent className="space-y-5">
            {errors.form && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5">
                <p className="text-sm text-destructive-foreground">{errors.form}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Email
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Password
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Enter your password"
                required
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button
              type="submit"
              className="w-full"
              disabled={isPending}
            >
              {isPending ? 'Logging in...' : 'Log In'}
            </Button>
            <p className="text-sm text-muted-foreground">
              Don't have an account?{' '}
              <Link
                to="/signup"
                className="font-medium text-primary transition-colors hover:text-primary/80"
              >
                Sign up
              </Link>
            </p>
          </CardFooter>
        </Form>
      </Card>
    </div>
  )
}
```

Note: Form fields use `name` attributes instead of controlled `useState` + `onChange`. The `Form` component from react-router replaces the `<form>` element.

- [ ] **Step 2: Verify the app builds**

Run: `cd /Users/evanstern/projects/evanstern/game-finder && pnpm turbo build --filter=@game-finder/web`

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/routes/login.tsx
git commit -m "refactor(web): login route uses RR7 loader/action with cookie forwarding"
```

---

## Task 6: Refactor signup route

**Files:**
- Modify: `apps/web/app/routes/signup.tsx`

Same pattern as login — loader redirects if authenticated, action uses raw fetch for cookie forwarding.

- [ ] **Step 1: Rewrite signup.tsx**

```tsx
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
import { Form, Link, redirect, useActionData, useNavigation } from 'react-router'
import { MapBackground } from '../components/map-background.js'
import { createServerTRPC } from '../trpc/server.js'
import type { Route } from './+types/signup.js'

export async function loader({ context }: Route.LoaderArgs) {
  const ctx = context as { cookie?: string }
  const trpc = createServerTRPC(ctx.cookie ?? '')
  const user = await trpc.auth.me.query().catch(() => null)
  if (user) throw redirect('/')
  return {}
}

export async function action({ request, context }: Route.ActionArgs) {
  const ctx = context as { cookie?: string }
  const formData = await request.formData()
  const displayName = String(formData.get('displayName') ?? '')
  const email = String(formData.get('email') ?? '')
  const password = String(formData.get('password') ?? '')

  const serverUrl = process.env.SERVER_URL
  if (!serverUrl) throw new Error('SERVER_URL environment variable is required')

  const res = await fetch(`${serverUrl}/trpc/auth.register`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(ctx.cookie ? { cookie: ctx.cookie } : {}),
    },
    body: JSON.stringify({ json: { displayName, email, password } }),
  })

  const body = await res.json()

  if (!res.ok || body.error) {
    const message = body.error?.json?.message ?? 'Registration failed'
    if (message === 'Email already in use') {
      return { errors: { email: message } }
    }
    return { errors: { form: message } }
  }

  const setCookies = res.headers.getSetCookie()
  const headers = new Headers()
  for (const cookie of setCookies) {
    headers.append('set-cookie', cookie)
  }

  return redirect('/', { headers })
}

export default function SignUp({ actionData }: Route.ComponentProps) {
  const navigation = useNavigation()
  const isPending = navigation.state === 'submitting'
  const errors = actionData?.errors ?? {}

  return (
    <div className="relative flex min-h-[calc(100vh-65px)] items-center justify-center px-6">
      <MapBackground />

      <Card className="animate-fade-in-up relative z-10 w-full max-w-sm border-border bg-card/80 backdrop-blur-sm">
        <CardHeader className="text-center">
          <p className="mb-1 text-[11px] font-semibold tracking-[0.2em] text-primary uppercase">
            Join the table
          </p>
          <CardTitle className="text-xl font-bold tracking-tight text-foreground">
            Create an account
          </CardTitle>
        </CardHeader>
        <Form method="post">
          <CardContent className="space-y-5">
            {errors.form && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5">
                <p className="text-sm text-destructive-foreground">{errors.form}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="displayName" className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Display Name
              </Label>
              <Input
                id="displayName"
                name="displayName"
                placeholder="How others will see you"
                required
              />
              {errors.displayName && (
                <p className="text-sm text-destructive">
                  {errors.displayName}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Email
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Password
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="8 characters minimum"
                required
                minLength={8}
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password}</p>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button
              type="submit"
              className="w-full"
              disabled={isPending}
            >
              {isPending ? 'Creating account...' : 'Create Account'}
            </Button>
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link
                to="/login"
                className="font-medium text-primary transition-colors hover:text-primary/80"
              >
                Log in
              </Link>
            </p>
          </CardFooter>
        </Form>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/routes/signup.tsx
git commit -m "refactor(web): signup route uses RR7 loader/action with cookie forwarding"
```

---

## Task 7: Refactor search route

**Files:**
- Modify: `apps/web/app/routes/search.tsx`

The search route reads URL params and fetches results. The loader parses search params from the request URL and calls the tRPC search endpoint. The form still uses client-side navigation to update URL params (which re-runs the loader).

- [ ] **Step 1: Add loader to search.tsx**

Add the loader at the top of the file:

```tsx
import { createServerTRPC } from '../trpc/server.js'
import type { Route } from './+types/search.js'

export async function loader({ request, context }: Route.LoaderArgs) {
  const ctx = context as { cookie?: string }
  const url = new URL(request.url)
  const zip = url.searchParams.get('zip') ?? ''

  if (!zip) return { results: null }

  const trpc = createServerTRPC(ctx.cookie ?? '')
  const radius = Number(url.searchParams.get('radius')) || 25
  const query = url.searchParams.get('q') ?? ''
  const typesParam = url.searchParams.get('types')
  const gameTypes = typesParam ? typesParam.split(',').filter(Boolean) : undefined
  const sortBy = (url.searchParams.get('sort') ?? 'distance') as 'distance' | 'next_session'
  const page = Number(url.searchParams.get('page')) || 1

  const results = await trpc.gathering.search.query({
    zipCode: zip,
    radius,
    query: query || undefined,
    gameTypes: gameTypes && gameTypes.length > 0 ? gameTypes : undefined,
    sortBy,
    page,
    pageSize: 20,
  })

  return { results }
}
```

- [ ] **Step 2: Update the component to use useLoaderData**

Replace `useQuery` usage with `useLoaderData()`:
- Remove: `import { useQuery } from '@tanstack/react-query'`, `import { useTRPC } from '../trpc/provider.js'`
- Remove: `const trpc = useTRPC()` and the `useQuery(trpc.gathering.search.queryOptions(...))` block
- Add: Use `Route.ComponentProps` pattern — `export default function SearchPage({ loaderData }: Route.ComponentProps)`
- Replace `data` with `loaderData.results`
- Replace `isLoading` with `const navigation = useNavigation(); const isLoading = navigation.state === 'loading'`
- Remove the `error` handling from useQuery (loader errors are handled by RR7's error boundary)

Keep all the client-side form state (`zipInput`, `radiusInput`, `queryInput`) and URL manipulation logic (`updateSearchParams`, `handleSearch`, `toggleGameType`, `setSort`, `goToPage`) exactly as they are — these update URL params which triggers the loader.

Initialize form state from search params: read from `useSearchParams()` as before.

- [ ] **Step 3: Verify the app builds**

Run: `cd /Users/evanstern/projects/evanstern/game-finder && pnpm turbo build --filter=@game-finder/web`

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/routes/search.tsx
git commit -m "refactor(web): search route uses RR7 loader for SSR"
```

---

## Task 8: Refactor gathering detail route

**Files:**
- Modify: `apps/web/app/routes/gatherings.$id.tsx`

- [ ] **Step 1: Add loader and action**

```tsx
import { data, redirect } from 'react-router'
import { createServerTRPC } from '../trpc/server.js'
import type { Route } from './+types/gatherings.$id.js'

export async function loader({ params, context }: Route.LoaderArgs) {
  const ctx = context as { cookie?: string }
  const trpc = createServerTRPC(ctx.cookie ?? '')

  const [user, gathering] = await Promise.all([
    trpc.auth.me.query().catch(() => null),
    trpc.gathering.getById.query({ id: params.id }).catch(() => null),
  ])

  if (!gathering) {
    throw data('Gathering not found', { status: 404 })
  }

  return { gathering, user }
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const ctx = context as { cookie?: string }
  const trpc = createServerTRPC(ctx.cookie ?? '')
  const formData = await request.formData()
  const intent = String(formData.get('intent'))

  if (intent === 'close') {
    await trpc.gathering.close.mutate({ id: params.id })
  }

  return redirect(`/gatherings/${params.id}`)
}
```

- [ ] **Step 2: Update the component**

- Change signature: `export default function GatheringDetails({ loaderData }: Route.ComponentProps)`
- Destructure: `const { gathering, user } = loaderData`
- Remove: all `useQuery`, `useMutation`, `useQueryClient` usage
- Remove: the loading and error early returns (loader handles those)
- Replace close button with a `Form`:

```tsx
<Form method="post">
  <input type="hidden" name="intent" value="close" />
  <Button type="submit" variant="destructive" size="sm">
    Close
  </Button>
</Form>
```

- Replace `isOwner` check: `const isOwner = user?.id === gathering.hostId`
- Add: `import { Form, useNavigation } from 'react-router'` — use `navigation.state` for pending states if needed.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/routes/gatherings.\$id.tsx
git commit -m "refactor(web): gathering detail route uses RR7 loader/action"
```

---

## Task 9: Refactor GatheringForm component

**Files:**
- Modify: `apps/web/app/components/gathering-form.tsx`

The GatheringForm currently fetches the games list via `useQuery(trpc.game.list.queryOptions({}))`. Since this component is used by both `gatherings.new.tsx` and `gatherings.$id.edit.tsx`, the games list needs to come from those routes' loaders as a prop.

- [ ] **Step 1: Update GatheringForm to accept games as a prop**

Changes to the interface and component:
- Add `games` to props: `games: Array<{ id: string; name: string }>`
- Remove: `import { useQuery } from '@tanstack/react-query'`, `import { useTRPC } from '../trpc/provider.js'`
- Remove: `const trpc = useTRPC()`, `const { data: games = [] } = useQuery(...)`
- The `onSubmit` prop stays for now — the parent routes will use `useSubmit()` or adapt it to post formData. Actually, change the form to use hidden inputs and standard form submission:

Updated approach: The component accepts `action` prop (form action URL) instead of `onSubmit` callback. It uses hidden inputs for complex fields (gameIds). Form submission goes to the route action.

```tsx
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@game-finder/ui/components/select'
import { useState } from 'react'
import { Form } from 'react-router'
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
  games: Array<{ id: string; name: string }>
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
  games,
  isPending,
  submitLabel,
  errors = {},
}: GatheringFormProps) {
  const [gameIds, setGameIds] = useState<string[]>(initialData?.gameIds ?? [])
  const [scheduleType, setScheduleType] = useState(initialData?.scheduleType ?? 'once')
  const [description, setDescription] = useState(initialData?.description ?? '')

  const toggleGame = (gameId: string) => {
    setGameIds((prev) =>
      prev.includes(gameId)
        ? prev.filter((id) => id !== gameId)
        : [...prev, gameId],
    )
  }

  return (
    <Card className="animate-fade-in-up border-border bg-card/80 backdrop-blur-sm py-10">
      <Form method="post">
        <CardHeader className="text-center pb-2">
          <p className="mb-2 text-lg font-bold tracking-[0.25em] uppercase animate-fade-in animate-text-shimmer bg-gradient-to-r from-primary via-amber-200 to-primary bg-clip-text text-transparent">
            {submitLabel === 'Create Gathering' ? 'Summon your party' : 'Revise the scroll'}
          </p>
          <CardTitle className="text-sm font-medium tracking-wide text-muted-foreground">
            {submitLabel === 'Create Gathering' ? 'Create a Gathering' : 'Edit Gathering'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {errors.form && (
            <div className="animate-fade-in rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5">
              <p className="text-sm text-destructive-foreground">{errors.form}</p>
            </div>
          )}

          {/* Hidden inputs for gameIds */}
          {gameIds.map((id) => (
            <input key={id} type="hidden" name="gameIds" value={id} />
          ))}
          {/* Hidden input for description (managed by MarkdownEditor) */}
          <input type="hidden" name="description" value={description} />
          {/* Hidden input for scheduleType (managed by Select) */}
          <input type="hidden" name="scheduleType" value={scheduleType} />

          <div className="animate-fade-in-up animation-delay-100 grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="title" className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Title</Label>
              <Input id="title" name="title" defaultValue={initialData?.title ?? ''} placeholder="Friday Board Game Night" required />
              {errors.title && <p className="text-sm text-destructive">{errors.title}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Games</Label>
              <div className="flex flex-wrap gap-1.5 rounded-md border border-border bg-background/40 px-4 py-2 min-h-[40px] items-center">
                {games.map((game) => (
                  <Button
                    key={game.id}
                    type="button"
                    variant={gameIds.includes(game.id) ? 'default' : 'outline'}
                    size="sm"
                    className={`h-7 px-2.5 text-[11px] ${gameIds.includes(game.id) ? '' : 'text-muted-foreground'}`}
                    onClick={() => toggleGame(game.id)}
                  >
                    {game.name}
                  </Button>
                ))}
              </div>
              {errors.gameIds && <p className="text-sm text-destructive">{errors.gameIds}</p>}
            </div>
          </div>

          <div className="animate-fade-in-up animation-delay-200 grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="zipCode" className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Zip Code</Label>
              <Input id="zipCode" name="zipCode" defaultValue={initialData?.zipCode ?? ''} placeholder="90210" required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Schedule</Label>
              <Select value={scheduleType} onValueChange={(v) => setScheduleType(v as GatheringFormData['scheduleType'])}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCHEDULE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="startsAt" className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Date & Time</Label>
              <Input id="startsAt" name="startsAt" type="datetime-local" defaultValue={initialData?.startsAt ?? ''} required />
            </div>
          </div>

          <div className="animate-fade-in-up animation-delay-300 grid grid-cols-3 gap-4">
            {scheduleType !== 'once' && (
              <div className="space-y-1.5">
                <Label htmlFor="endDate" className="text-xs font-medium tracking-wide text-muted-foreground uppercase">End Date</Label>
                <Input id="endDate" name="endDate" type="date" defaultValue={initialData?.endDate ?? ''} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="durationMinutes" className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Duration (min)</Label>
              <Input id="durationMinutes" name="durationMinutes" type="number" defaultValue={initialData?.durationMinutes ?? ''} placeholder="180" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="maxPlayers" className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Max Players</Label>
              <Input id="maxPlayers" name="maxPlayers" type="number" defaultValue={initialData?.maxPlayers ?? ''} placeholder="6" />
            </div>
          </div>

          <div className="animate-fade-in-up animation-delay-300 space-y-1.5">
            <Label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Description (Markdown)</Label>
            <MarkdownEditor value={description} onChange={setDescription} placeholder="Describe your gathering..." />
          </div>
        </CardContent>
        <CardFooter className="justify-center pt-4">
          <Button type="submit" className="px-10" disabled={isPending}>
            {isPending ? 'Saving...' : submitLabel}
          </Button>
        </CardFooter>
      </Form>
    </Card>
  )
}
```

Key changes:
- Removed `onSubmit` prop, using RR7 `<Form method="post">` instead
- `gameIds`, `description`, and `scheduleType` use hidden inputs (since they're managed by custom UI widgets, not native inputs)
- Simple fields (`title`, `zipCode`, `startsAt`, `endDate`, `durationMinutes`, `maxPlayers`) use `name` attributes and `defaultValue`
- Games list comes from `games` prop instead of `useQuery`

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/components/gathering-form.tsx
git commit -m "refactor(web): GatheringForm uses RR7 Form, accepts games as prop"
```

---

## Task 10: Refactor new gathering route

**Files:**
- Modify: `apps/web/app/routes/gatherings.new.tsx`

- [ ] **Step 1: Rewrite gatherings.new.tsx**

```tsx
import { redirect, useNavigation } from 'react-router'
import { GatheringForm } from '../components/gathering-form.js'
import { MapBackground } from '../components/map-background.js'
import { createServerTRPC } from '../trpc/server.js'
import type { Route } from './+types/gatherings.new.js'

export async function loader({ context }: Route.LoaderArgs) {
  const ctx = context as { cookie?: string }
  const trpc = createServerTRPC(ctx.cookie ?? '')
  const user = await trpc.auth.me.query().catch(() => null)
  if (!user) throw redirect('/login?returnTo=/gatherings/new')

  const games = await trpc.game.list.query({})
  return { games }
}

export async function action({ request, context }: Route.ActionArgs) {
  const ctx = context as { cookie?: string }
  const trpc = createServerTRPC(ctx.cookie ?? '')

  const user = await trpc.auth.me.query().catch(() => null)
  if (!user) throw redirect('/login?returnTo=/gatherings/new')

  const formData = await request.formData()

  try {
    const result = await trpc.gathering.create.mutate({
      title: String(formData.get('title') ?? ''),
      gameIds: formData.getAll('gameIds').map(String),
      zipCode: String(formData.get('zipCode') ?? ''),
      scheduleType: String(formData.get('scheduleType') ?? 'once'),
      startsAt: new Date(String(formData.get('startsAt'))).toISOString(),
      endDate: formData.get('endDate') ? new Date(String(formData.get('endDate'))).toISOString() : null,
      durationMinutes: formData.get('durationMinutes') ? parseInt(String(formData.get('durationMinutes')), 10) : null,
      maxPlayers: formData.get('maxPlayers') ? parseInt(String(formData.get('maxPlayers')), 10) : null,
      description: String(formData.get('description') ?? ''),
    })
    return redirect(`/gatherings/${result.id}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create gathering'
    return { errors: { form: message } }
  }
}

export default function NewGathering({ loaderData, actionData }: Route.ComponentProps) {
  const navigation = useNavigation()
  const isPending = navigation.state === 'submitting'

  return (
    <div className="relative min-h-[calc(100vh-65px)]">
      <MapBackground />
      <div className="relative z-10 mx-auto max-w-4xl px-6 py-10">
        <GatheringForm
          submitLabel="Create Gathering"
          isPending={isPending}
          games={loaderData.games}
          errors={actionData?.errors}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/routes/gatherings.new.tsx
git commit -m "refactor(web): new gathering route uses RR7 loader/action"
```

---

## Task 11: Refactor edit gathering route

**Files:**
- Modify: `apps/web/app/routes/gatherings.$id.edit.tsx`

- [ ] **Step 1: Rewrite gatherings.$id.edit.tsx**

```tsx
import { redirect, useNavigation } from 'react-router'
import { GatheringForm } from '../components/gathering-form.js'
import { MapBackground } from '../components/map-background.js'
import { createServerTRPC } from '../trpc/server.js'
import type { Route } from './+types/gatherings.$id.edit.js'

function toDatetimeLocal(date: Date): string {
  const d = new Date(date)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function toDateInput(date: Date): string {
  const d = new Date(date)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const ctx = context as { cookie?: string }
  const trpc = createServerTRPC(ctx.cookie ?? '')

  const user = await trpc.auth.me.query().catch(() => null)
  if (!user) throw redirect(`/login?returnTo=/gatherings/${params.id}/edit`)

  const gathering = await trpc.gathering.getById.query({ id: params.id }).catch(() => null)
  if (!gathering) throw redirect('/dashboard')
  if (gathering.hostId !== user.id) throw redirect(`/gatherings/${params.id}`)

  const games = await trpc.game.list.query({})

  return {
    gathering: {
      title: gathering.title,
      gameIds: gathering.games.map((g) => g.id),
      zipCode: gathering.zipCode,
      scheduleType: gathering.scheduleType,
      startsAt: toDatetimeLocal(new Date(gathering.startsAt)),
      endDate: gathering.endDate ? toDateInput(new Date(gathering.endDate)) : '',
      durationMinutes: gathering.durationMinutes != null ? String(gathering.durationMinutes) : '',
      maxPlayers: gathering.maxPlayers != null ? String(gathering.maxPlayers) : '',
      description: gathering.description,
    },
    games,
  }
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const ctx = context as { cookie?: string }
  const trpc = createServerTRPC(ctx.cookie ?? '')

  const user = await trpc.auth.me.query().catch(() => null)
  if (!user) throw redirect(`/login?returnTo=/gatherings/${params.id}/edit`)

  const formData = await request.formData()

  try {
    await trpc.gathering.update.mutate({
      id: params.id,
      title: String(formData.get('title') ?? ''),
      gameIds: formData.getAll('gameIds').map(String),
      zipCode: String(formData.get('zipCode') ?? ''),
      scheduleType: String(formData.get('scheduleType') ?? 'once'),
      startsAt: new Date(String(formData.get('startsAt'))).toISOString(),
      endDate: formData.get('endDate') ? new Date(String(formData.get('endDate'))).toISOString() : null,
      durationMinutes: formData.get('durationMinutes') ? parseInt(String(formData.get('durationMinutes')), 10) : null,
      maxPlayers: formData.get('maxPlayers') ? parseInt(String(formData.get('maxPlayers')), 10) : null,
      description: String(formData.get('description') ?? ''),
    })
    return redirect(`/gatherings/${params.id}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update gathering'
    return { errors: { form: message } }
  }
}

export default function EditGathering({ loaderData, actionData }: Route.ComponentProps) {
  const navigation = useNavigation()
  const isPending = navigation.state === 'submitting'

  return (
    <div className="relative min-h-[calc(100vh-65px)]">
      <MapBackground />
      <div className="relative z-10 mx-auto max-w-4xl px-6 py-10">
        <GatheringForm
          submitLabel="Save Changes"
          isPending={isPending}
          initialData={loaderData.gathering}
          games={loaderData.games}
          errors={actionData?.errors}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/routes/gatherings.\$id.edit.tsx
git commit -m "refactor(web): edit gathering route uses RR7 loader/action"
```

---

## Task 12: Refactor dashboard route

**Files:**
- Modify: `apps/web/app/routes/dashboard.tsx`

- [ ] **Step 1: Rewrite dashboard.tsx**

```tsx
import { Badge } from '@game-finder/ui/components/badge'
import { Button } from '@game-finder/ui/components/button'
import { Form, Link, redirect, useNavigation } from 'react-router'
import { MapBackground } from '../components/map-background.js'
import { createServerTRPC } from '../trpc/server.js'
import type { Route } from './+types/dashboard.js'

export async function loader({ context }: Route.LoaderArgs) {
  const ctx = context as { cookie?: string }
  const trpc = createServerTRPC(ctx.cookie ?? '')

  const user = await trpc.auth.me.query().catch(() => null)
  if (!user) throw redirect('/login?returnTo=/dashboard')

  const gatherings = await trpc.gathering.listByHost.query()
  return { user, gatherings }
}

export async function action({ request, context }: Route.ActionArgs) {
  const ctx = context as { cookie?: string }
  const trpc = createServerTRPC(ctx.cookie ?? '')

  const formData = await request.formData()
  const intent = String(formData.get('intent'))
  const gatheringId = String(formData.get('gatheringId'))

  if (intent === 'close') {
    await trpc.gathering.close.mutate({ id: gatheringId })
  } else if (intent === 'delete') {
    await trpc.gathering.delete.mutate({ id: gatheringId })
  }

  return redirect('/dashboard')
}

export default function Dashboard({ loaderData }: Route.ComponentProps) {
  const { gatherings } = loaderData
  const navigation = useNavigation()
  const isPending = navigation.state !== 'idle'

  return (
    <div className="relative min-h-[calc(100vh-65px)]">
      <MapBackground />

      <div className="relative z-10 mx-auto max-w-4xl px-6 py-10 space-y-8">
        <div className="animate-fade-in-up flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold tracking-[0.2em] text-primary uppercase">
              Host command table
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Your Gatherings
            </h1>
          </div>
          <Button asChild>
            <Link to="/gatherings/new">+ New Gathering</Link>
          </Button>
        </div>

        {gatherings.length === 0 ? (
          <div className="animate-fade-in-up animation-delay-100 rounded-lg border border-border bg-card/60 p-10 text-center backdrop-blur-sm">
            <p className="text-sm text-muted-foreground">You have no gatherings yet.</p>
            <Button className="mt-4" asChild>
              <Link to="/gatherings/new">Create your first gathering</Link>
            </Button>
          </div>
        ) : (
          <div className="animate-fade-in-up animation-delay-100 space-y-3">
            {gatherings.map((gathering, index) => (
              <div
                key={gathering.id}
                className={`animate-fade-in-up ${index === 0 ? 'animation-delay-100' : index === 1 ? 'animation-delay-200' : 'animation-delay-300'} rounded-lg border border-border bg-card/60 p-5 backdrop-blur-sm transition-all duration-200 hover:border-primary/20`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/gatherings/${gathering.id}`}
                      className="text-base font-semibold tracking-tight text-foreground transition-colors hover:text-primary"
                    >
                      {gathering.title}
                    </Link>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <span>
                        {gathering.nextOccurrenceAt
                          ? new Date(gathering.nextOccurrenceAt).toLocaleDateString([], { dateStyle: 'medium' })
                          : 'No upcoming session'}
                      </span>
                      <Badge variant={gathering.status === 'active' ? 'default' : 'secondary'} className="text-[10px]">
                        {gathering.status === 'active' ? 'Active' : 'Closed'}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={`/gatherings/${gathering.id}/edit`}>Edit</Link>
                    </Button>
                    {gathering.status === 'active' ? (
                      <Form method="post">
                        <input type="hidden" name="intent" value="close" />
                        <input type="hidden" name="gatheringId" value={gathering.id} />
                        <Button
                          type="submit"
                          variant="outline"
                          size="sm"
                          disabled={isPending}
                        >
                          Close
                        </Button>
                      </Form>
                    ) : (
                      <Form method="post" onSubmit={(e) => {
                        if (!confirm(`Delete "${gathering.title}"? This cannot be undone.`)) {
                          e.preventDefault()
                        }
                      }}>
                        <input type="hidden" name="intent" value="delete" />
                        <input type="hidden" name="gatheringId" value={gathering.id} />
                        <Button
                          type="submit"
                          variant="destructive"
                          size="sm"
                          disabled={isPending}
                        >
                          Delete
                        </Button>
                      </Form>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/routes/dashboard.tsx
git commit -m "refactor(web): dashboard route uses RR7 loader/action"
```

---

## Task 13: Remove React Query and tRPC React dependencies

**Files:**
- Delete: `apps/web/app/trpc/provider.tsx`
- Delete: `apps/web/app/trpc/query-client.ts`
- Modify: `apps/web/package.json`

- [ ] **Step 1: Delete provider and query-client files**

```bash
rm apps/web/app/trpc/provider.tsx apps/web/app/trpc/query-client.ts
```

- [ ] **Step 2: Remove React Query and tRPC React Query dependencies**

```bash
cd /Users/evanstern/projects/evanstern/game-finder && pnpm --filter @game-finder/web remove @tanstack/react-query @trpc/tanstack-react-query
```

- [ ] **Step 3: Verify no remaining imports of removed modules**

Search the web app for any remaining imports of:
- `@tanstack/react-query`
- `@trpc/tanstack-react-query`
- `../trpc/provider`
- `./trpc/provider`
- `useTRPC`
- `useQuery`
- `useMutation`
- `useQueryClient`

All should be gone. Fix any stragglers.

- [ ] **Step 4: Verify the app builds**

Run: `cd /Users/evanstern/projects/evanstern/game-finder && pnpm turbo build --filter=@game-finder/web`

Expected: Build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(web): remove React Query and tRPC React dependencies"
```

---

## Task 14: Smoke test the full app

- [ ] **Step 1: Start the dev server**

```bash
cd /Users/evanstern/projects/evanstern/game-finder && pnpm dev
```

- [ ] **Step 2: Verify each route loads with SSR**

Test each route and verify the page HTML is server-rendered (view source should show content, not just an empty shell):

1. `/` — Home page renders with content, shows welcome message if logged in
2. `/search` — Empty state renders, search with a zip code returns results
3. `/search?zip=10001` — Results render server-side
4. `/login` — Login form renders, submitting logs in and redirects
5. `/signup` — Signup form renders
6. `/dashboard` — Redirects to login if not authenticated, shows gatherings if authenticated
7. `/gatherings/new` — Redirects to login if not authenticated, shows form if authenticated
8. `/gatherings/:id` — Detail page renders with gathering data
9. `/gatherings/:id/edit` — Redirects appropriately, shows pre-populated form for owner

- [ ] **Step 3: Verify mutations work**

1. Log in via the login form
2. Create a new gathering
3. Edit the gathering
4. Close the gathering from the detail page
5. Delete the gathering from the dashboard
6. Log out via the nav button

- [ ] **Step 4: Fix any issues found during smoke testing**

- [ ] **Step 5: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix(web): address issues found during SSR smoke test"
```
