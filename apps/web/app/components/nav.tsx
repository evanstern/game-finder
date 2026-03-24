import { Button } from '@game-finder/ui/components/button'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router'
import { useTRPC } from '../trpc/provider.js'

function D20Icon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5" />
      <line x1="12" y1="2" x2="12" y2="22" />
      <line x1="2" y1="8.5" x2="22" y2="8.5" />
      <line x1="2" y1="15.5" x2="12" y2="2" />
      <line x1="22" y1="15.5" x2="12" y2="2" />
    </svg>
  )
}

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
    <nav className="border-b border-border bg-card/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link to="/" className="group flex items-center gap-2">
          <D20Icon className="h-4.5 w-4.5 text-primary transition-transform duration-300 group-hover:rotate-[60deg]" />
          <span className="font-display text-base tracking-wide text-foreground">
            Game Finder
          </span>
        </Link>
        <div className="flex items-center gap-5">
          {isLoading ? (
            <div className="h-3.5 w-20 animate-pulse rounded bg-muted" />
          ) : user ? (
            <>
              <span className="text-sm font-medium text-primary">
                {user.displayName}
              </span>
              <button
                type="button"
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isPending}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
              >
                Log Out
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="text-sm leading-none text-muted-foreground transition-colors hover:text-foreground"
              >
                Log In
              </Link>
              <Button size="default" asChild>
                <Link to="/signup">Sign Up</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
