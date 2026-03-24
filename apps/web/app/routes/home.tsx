import { Button } from '@game-finder/ui/components/button'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useTRPC } from '../trpc/provider.js'

export default function Home() {
  const trpc = useTRPC()
  const { data } = useSuspenseQuery(trpc.health.check.queryOptions())

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold">Game Finder</h1>
      <p className="text-muted-foreground">Server status: {data.status}</p>
      <Button>Get Started</Button>
    </div>
  )
}
