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

  const errors: Record<string, string> = {}
  if (!displayName) errors.displayName = 'Display name is required'
  if (!email) errors.email = 'Email is required'
  if (!password) errors.password = 'Password is required'
  else if (password.length < 8) errors.password = 'Password must be at least 8 characters'
  if (Object.keys(errors).length > 0) return { errors }

  const serverUrl = process.env.SERVER_URL
  if (!serverUrl) throw new Error('SERVER_URL environment variable is required')

  const res = await fetch(`${serverUrl}/trpc/auth.register`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(ctx.cookie ? { cookie: ctx.cookie } : {}),
    },
    body: JSON.stringify({ displayName, email, password }),
  })

  const body = await res.json()

  if (!res.ok || body.error) {
    const message = body.error?.message ?? 'Registration failed'
    if (message === 'Email already in use') {
      return { errors: { email: message } as Record<string, string> }
    }
    return { errors: { form: message } as Record<string, string> }
  }

  const setCookies = res.headers.getSetCookie()
  const headers = new Headers()
  for (const cookie of setCookies) {
    headers.append('set-cookie', cookie)
  }

  return redirect('/?welcome=new', { headers })
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
        <Form method="post" noValidate>
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
