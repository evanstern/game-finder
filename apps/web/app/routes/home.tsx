import { Button } from '@game-finder/ui/components/button'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { useTRPC } from '../trpc/provider.js'

export default function Home() {
  const trpc = useTRPC()
  const { data: user, isLoading } = useQuery(trpc.auth.me.queryOptions())

  if (isLoading) return null

  return (
    <div className="flex min-h-[calc(100vh-57px)] flex-col items-center justify-center gap-6 px-4">
      {user ? (
        <>
          <h1 className="text-4xl font-bold">Welcome back, {user.displayName}</h1>
          <p className="max-w-md text-center text-muted-foreground">
            Game listings are coming soon. Check back later to find local
            tabletop games to join.
          </p>
        </>
      ) : (
        <>
          <h1 className="text-4xl font-bold">Find Your Next Game</h1>
          <p className="max-w-md text-center text-muted-foreground">
            Discover local tabletop games — board games, D&D, and more. Search
            by zip code, browse listings, and connect with hosts in your area.
          </p>
          <div className="flex gap-3">
            <Button asChild>
              <Link to="/signup">Get Started</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/login">Log In</Link>
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
