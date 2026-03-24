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
    <div className="flex min-h-[calc(100vh-57px)] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create an account</CardTitle>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {errors.form && (
              <p className="text-sm text-destructive">{errors.form}</p>
            )}
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />
              {errors.displayName && (
                <p className="text-sm text-destructive">
                  {errors.displayName}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
              {registerMutation.isPending ? 'Creating account...' : 'Sign Up'}
            </Button>
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link to="/login" className="text-primary hover:underline">
                Log in
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
