import { Logo } from '@game-finder/ui/components/logo'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useTRPC } from '../trpc/provider.js'

export function Nav() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

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
        <Link to="/" className="flex items-center">
          <Logo size="sm" />
        </Link>
        <button
          type="button"
          className="md:hidden text-muted-foreground"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? '✕' : '☰'}
        </button>
        <div className="hidden md:flex items-center gap-5">
          <Link to="#" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Browse
          </Link>
          <Link to="#" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Post a Game
          </Link>
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
              <Link
                to="/signup"
                className="text-sm font-semibold text-primary"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border bg-card/95 backdrop-blur-md px-6 py-4 flex flex-col gap-3">
          <Link to="#" className="text-sm text-muted-foreground" onClick={() => setMobileMenuOpen(false)}>Browse</Link>
          <Link to="#" className="text-sm text-muted-foreground" onClick={() => setMobileMenuOpen(false)}>Post a Game</Link>
          {user ? (
            <>
              <span className="text-sm font-medium text-primary">{user.displayName}</span>
              <button
                type="button"
                onClick={() => { logoutMutation.mutate(); setMobileMenuOpen(false) }}
                className="text-sm text-muted-foreground text-left"
              >
                Log Out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-sm text-muted-foreground" onClick={() => setMobileMenuOpen(false)}>Log In</Link>
              <Link to="/signup" className="text-sm text-primary font-semibold" onClick={() => setMobileMenuOpen(false)}>Sign Up</Link>
            </>
          )}
        </div>
      )}
    </nav>
  )
}
