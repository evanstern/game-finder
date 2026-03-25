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
