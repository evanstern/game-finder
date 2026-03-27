import { Badge } from '@game-finder/ui/components/badge'
import { Button } from '@game-finder/ui/components/button'
import { Link, redirect, useSearchParams } from 'react-router'
import { ClientDate } from '../components/client-date.js'
import { MapBackground } from '../components/map-background.js'
import { createServerTRPC } from '../trpc/server.js'
import type { Route } from './+types/friends.activity.js'

export async function loader({ request, context }: Route.LoaderArgs) {
  const ctx = context as { cookie?: string }
  const trpc = createServerTRPC(ctx.cookie ?? '')

  const user = await trpc.auth.me.query().catch(() => null)
  if (!user) throw redirect('/login?returnTo=/friends/activity')

  const url = new URL(request.url)
  const page = Number(url.searchParams.get('page')) || 1

  const result = await trpc.gathering.friendActivity.query({
    page,
    pageSize: 20,
  })
  return { result }
}

export default function FriendActivity({ loaderData }: Route.ComponentProps) {
  const { result } = loaderData
  const [searchParams] = useSearchParams()
  const currentPage = Number(searchParams.get('page')) || 1

  return (
    <div className="relative min-h-[calc(100vh-65px)]">
      <MapBackground />

      <div className="relative z-10 mx-auto max-w-4xl px-6 py-10 space-y-8">
        <div className="animate-fade-in-up flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold tracking-[0.2em] text-primary uppercase">
              Social
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Friend Activity
            </h1>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/friends">Back to Friends</Link>
          </Button>
        </div>

        {result.gatherings.length === 0 ? (
          <div className="animate-fade-in-up animation-delay-100 rounded-lg border border-border bg-card/60 p-10 text-center backdrop-blur-sm">
            <p className="text-sm text-muted-foreground">
              Your friends aren&apos;t in any upcoming gatherings.
            </p>
            <Button className="mt-4" asChild>
              <Link to="/search">Find games to join</Link>
            </Button>
          </div>
        ) : (
          <div className="animate-fade-in-up animation-delay-100 space-y-3">
            {result.gatherings.map((gathering) => (
              <Link
                key={gathering.id}
                to={`/gatherings/${gathering.id}`}
                className="block rounded-lg border border-border bg-card/60 p-5 backdrop-blur-sm transition-all duration-200 hover:border-primary/20"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="text-base font-semibold tracking-tight text-foreground">
                      {gathering.title}
                    </h3>
                    {gathering.nextOccurrenceAt && (
                      <ClientDate
                        date={gathering.nextOccurrenceAt}
                        dateStyle="medium"
                        className="text-xs text-muted-foreground whitespace-nowrap"
                      />
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {gathering.friends.map((f) => (
                      <Badge
                        key={f.friendId}
                        variant="outline"
                        className="border-primary/30 text-primary text-[11px]"
                      >
                        {f.displayName} —{' '}
                        {f.role === 'host' ? 'hosting' : 'playing'}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {gathering.zipCode}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}

        {result.total > result.pageSize && (
          <div className="flex justify-center gap-2 pt-4">
            {currentPage > 1 && (
              <Button variant="outline" size="sm" asChild>
                <Link to={`/friends/activity?page=${currentPage - 1}`}>
                  Previous
                </Link>
              </Button>
            )}
            {currentPage * result.pageSize < result.total && (
              <Button variant="outline" size="sm" asChild>
                <Link to={`/friends/activity?page=${currentPage + 1}`}>
                  Next
                </Link>
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
