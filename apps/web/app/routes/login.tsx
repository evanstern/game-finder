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
import { Form, Link, redirect, useNavigation } from 'react-router'
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

  if (!email || !password) {
    const errors: Record<string, string> = {}
    if (!email) errors.email = 'Email is required'
    if (!password) errors.password = 'Password is required'
    return { errors }
  }

  const serverUrl = process.env.SERVER_URL
  if (!serverUrl) throw new Error('SERVER_URL environment variable is required')

  const res = await fetch(`${serverUrl}/trpc/auth.login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(ctx.cookie ? { cookie: ctx.cookie } : {}),
    },
    body: JSON.stringify({ email, password }),
  })

  const body = await res.json()

  if (!res.ok || body.error) {
    const message = body.error?.message ?? 'Login failed'
    const errors: Record<string, string> = { form: message }
    return { errors }
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
        <Form method="post" noValidate>
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
                placeholder="Enter your password"
                required
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
