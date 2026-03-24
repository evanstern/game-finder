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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { MapBackground } from '../components/map-background.js'
import { useTRPC } from '../trpc/provider.js'

export default function SignUp() {
  const navigate = useNavigate()
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const { data: currentUser } = useQuery(trpc.auth.me.queryOptions())

  useEffect(() => {
    if (currentUser) navigate('/')
  }, [currentUser, navigate])

  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const registerMutation = useMutation(
    trpc.auth.register.mutationOptions({
      onSuccess: (data) => {
        queryClient.setQueryData(
          trpc.auth.me.queryOptions().queryKey,
          data.user,
        )
        navigate('/')
      },
      onError: (error) => {
        if (error.message === 'Email already in use') {
          setErrors({ email: 'Email already in use' })
        } else {
          setErrors({ form: error.message })
        }
      },
    }),
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    registerMutation.mutate({ displayName, email, password })
  }

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
        <form onSubmit={handleSubmit}>
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
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
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
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
              disabled={registerMutation.isPending}
            >
              {registerMutation.isPending ? 'Creating account...' : 'Create Account'}
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
        </form>
      </Card>
    </div>
  )
}
