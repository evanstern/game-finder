import '@game-finder/ui/styles/globals.css'
import { Button } from '@game-finder/ui/components/button'
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
} from 'react-router'
import type { Route } from './+types/root.js'
import { Nav } from './components/nav.js'
import { createServerTRPC } from './trpc/server.js'

export async function loader({ context }: Route.LoaderArgs) {
  const ctx = context as { cookie?: string }
  const trpc = createServerTRPC(ctx.cookie ?? '')
  const user = await trpc.auth.me.query().catch(() => null)

  let friendRequestCount = 0
  if (user) {
    const requests = await trpc.friendship.listIncomingRequests
      .query()
      .catch(() => [])
    friendRequestCount = requests.length
  }

  return { user, friendRequestCount }
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/favicon-32x32.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href="/favicon-16x16.png"
        />
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/apple-touch-icon.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="192x192"
          href="/android-chrome-192x192.png"
        />
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
      <Nav
        user={loaderData.user}
        friendRequestCount={loaderData.friendRequestCount}
      />
      <Outlet />
    </>
  )
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let status = 500
  let title = 'Internal Server Error'
  let message = 'Something went wrong. Please try again later.'

  if (isRouteErrorResponse(error)) {
    status = error.status
    if (status === 404) {
      title = 'Page Not Found'
      message =
        typeof error.data === 'string'
          ? error.data
          : 'The page you are looking for does not exist.'
    } else {
      message = typeof error.data === 'string' ? error.data : message
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <div className="max-w-md text-center space-y-4">
        <p className="text-6xl font-bold text-primary">{status}</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        <p className="text-muted-foreground">{message}</p>
        <Button asChild>
          <a href="/">Go Home</a>
        </Button>
      </div>
    </div>
  )
}
