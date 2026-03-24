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
      <Suspense fallback={<div>Loading...</div>}>
        <Outlet />
      </Suspense>
    </TRPCReactProvider>
  )
}
