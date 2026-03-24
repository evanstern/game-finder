import { Button } from '@game-finder/ui/components/button'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router'
import { useTRPC } from '../trpc/provider.js'

export function Nav() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const { data: user, isLoading } = useQuery(trpc.auth.me.queryOptions())

  const logoutMutation = useMutation(
    trpc.auth.logout.mutationOptions({
      onSuccess: () => {
        queryClient.setQueryData(trpc.auth.me.queryOptions().queryKey, null)
        navigate('/')
      },
    }),
  )

  return (
    <nav className="flex items-center justify-between border-b px-6 py-3">
      <Link to="/" className="text-lg font-bold">
        Game Finder
      </Link>
      <div className="flex items-center gap-4">
        {isLoading ? null : user ? (
          <>
            <span className="text-sm text-muted-foreground">
              {user.displayName}
            </span>
            <button
              type="button"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Log Out
            </button>
          </>
        ) : (
          <>
            <Link
              to="/login"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Log In
            </Link>
            <Button size="sm" asChild>
              <Link to="/signup">Sign Up</Link>
            </Button>
          </>
        )}
      </div>
    </nav>
  )
}
