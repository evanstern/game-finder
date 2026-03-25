import { Button } from '@game-finder/ui/components/button'
import { Logo } from '@game-finder/ui/components/logo'
import { useState } from 'react'
import { Link, useFetcher } from 'react-router'

interface NavUser {
  id: string
  displayName: string
}

export function Nav({ user, friendRequestCount = 0 }: { user: NavUser | null; friendRequestCount?: number }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const fetcher = useFetcher()
  const isLoggingOut = fetcher.state !== 'idle'

  return (
    <nav className="border-b border-border bg-card/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center">
          <Logo size="sm" />
        </Link>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="md:hidden text-muted-foreground"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? '✕' : '☰'}
        </Button>
        <div className="hidden md:flex items-center gap-5">
          <Link to="/search" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Find Games
          </Link>
          <Link to="/gatherings/new" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Post a Game
          </Link>
          {user ? (
            <>
              <span className="text-sm font-medium text-primary">
                {user.displayName}
              </span>
              <Link
                to="/dashboard"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Dashboard
              </Link>
              <Link
                to="/friends"
                className="relative text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Friends
                {friendRequestCount > 0 && (
                  <span className="absolute -top-1.5 -right-3 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    {friendRequestCount}
                  </span>
                )}
              </Link>
              <fetcher.Form method="post" action="/logout">
                <Button
                  type="submit"
                  variant="ghost"
                  size="sm"
                  disabled={isLoggingOut}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Log Out
                </Button>
              </fetcher.Form>
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
          <Link to="/search" className="text-sm text-muted-foreground" onClick={() => setMobileMenuOpen(false)}>Find Games</Link>
          <Link to="/gatherings/new" className="text-sm text-muted-foreground" onClick={() => setMobileMenuOpen(false)}>Post a Game</Link>
          {user ? (
            <>
              <span className="text-sm font-medium text-primary">{user.displayName}</span>
              <Link to="/friends" className="text-sm text-muted-foreground" onClick={() => setMobileMenuOpen(false)}>
                Friends{friendRequestCount > 0 ? ` (${friendRequestCount})` : ''}
              </Link>
              <fetcher.Form method="post" action="/logout">
                <Button
                  type="submit"
                  variant="ghost"
                  size="sm"
                  disabled={isLoggingOut}
                  className="text-muted-foreground justify-start"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Log Out
                </Button>
              </fetcher.Form>
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
