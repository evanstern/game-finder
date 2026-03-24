import '@game-finder/ui/styles/globals.css'
import { Suspense } from 'react'
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from 'react-router'
import type { Route } from './+types/root.js'
import { Nav } from './components/nav.js'
import { TRPCReactProvider } from './trpc/provider.js'

export function loader({ context }: Route.LoaderArgs) {
  const ctx = context as { cookie?: string }
  return { cookie: ctx?.cookie ?? '' }
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
    <TRPCReactProvider ssrCookie={loaderData.cookie}>
      <Nav />
      <Suspense fallback={<div>Loading...</div>}>
        <Outlet />
      </Suspense>
    </TRPCReactProvider>
  )
}
