import { Badge } from '@game-finder/ui/components/badge'
import { Button } from '@game-finder/ui/components/button'
import { Form, Link, redirect, useNavigation } from 'react-router'
import { ClientDate } from '../components/client-date.js'
import { MapBackground } from '../components/map-background.js'
import { createServerTRPC } from '../trpc/server.js'
import type { Route } from './+types/dashboard.js'

export async function loader({ context }: Route.LoaderArgs) {
  const ctx = context as { cookie?: string }
  const trpc = createServerTRPC(ctx.cookie ?? '')

  const user = await trpc.auth.me.query().catch(() => null)
  if (!user) throw redirect('/login?returnTo=/dashboard')

  const [gatherings, joinedGatherings] = await Promise.all([
    trpc.gathering.listByHost.query(),
    trpc.gathering.listJoined.query(),
  ])

  const friendActivity = await trpc.gathering.friendActivity.query({ page: 1, pageSize: 1 }).catch(() => ({ total: 0 }))

  return { user, gatherings, joinedGatherings, friendActivityCount: friendActivity.total }
}

export async function action({ request, context }: Route.ActionArgs) {
  const ctx = context as { cookie?: string }
  const trpc = createServerTRPC(ctx.cookie ?? '')

  const formData = await request.formData()
  const intent = String(formData.get('intent'))
  const gatheringId = String(formData.get('gatheringId'))

  if (intent === 'close') {
    await trpc.gathering.close.mutate({ id: gatheringId })
  } else if (intent === 'delete') {
    await trpc.gathering.delete.mutate({ id: gatheringId })
  }

  return redirect('/dashboard')
}

export default function Dashboard({ loaderData }: Route.ComponentProps) {
  const { gatherings, joinedGatherings, friendActivityCount } = loaderData
  const navigation = useNavigation()
  const isPending = navigation.state !== 'idle'

  return (
    <div className="relative min-h-[calc(100vh-65px)]">
      <MapBackground />

    <div className="relative z-10 mx-auto max-w-4xl px-6 py-10 space-y-8">
      <div className="animate-fade-in-up flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold tracking-[0.2em] text-primary uppercase">
            Host command table
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Your Gatherings
          </h1>
        </div>
        <Button asChild>
          <Link to="/gatherings/new">+ New Gathering</Link>
        </Button>
      </div>

      {gatherings.length === 0 ? (
        <div className="animate-fade-in-up animation-delay-100 rounded-lg border border-border bg-card/60 p-10 text-center backdrop-blur-sm">
          <p className="text-sm text-muted-foreground">You have no gatherings yet.</p>
          <Button className="mt-4" asChild>
            <Link to="/gatherings/new">Create your first gathering</Link>
          </Button>
        </div>
      ) : (
        <div className="animate-fade-in-up animation-delay-100 space-y-3">
          {gatherings.map((gathering, index) => (
            <div
              key={gathering.id}
              className={`animate-fade-in-up ${index === 0 ? 'animation-delay-100' : index === 1 ? 'animation-delay-200' : 'animation-delay-300'} rounded-lg border border-border bg-card/60 p-5 backdrop-blur-sm transition-all duration-200 hover:border-primary/20`}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/gatherings/${gathering.id}`}
                    className="text-base font-semibold tracking-tight text-foreground transition-colors hover:text-primary"
                  >
                    {gathering.title}
                  </Link>
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                    <ClientDate date={gathering.nextOccurrenceAt} fallback="No upcoming session" dateStyle="medium" />
                    <Badge variant={gathering.status === 'active' ? 'default' : 'secondary'} className="text-[10px]">
                      {gathering.status === 'active' ? 'Active' : 'Closed'}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" asChild>
                    <Link to={`/gatherings/${gathering.id}/edit`}>Edit</Link>
                  </Button>
                  {gathering.status === 'active' ? (
                    <Form method="post">
                      <input type="hidden" name="intent" value="close" />
                      <input type="hidden" name="gatheringId" value={gathering.id} />
                      <Button type="submit" variant="outline" size="sm" disabled={isPending}>
                        Close
                      </Button>
                    </Form>
                  ) : (
                    <Form method="post" onSubmit={(e) => {
                      if (!confirm(`Delete "${gathering.title}"? This cannot be undone.`)) {
                        e.preventDefault()
                      }
                    }}>
                      <input type="hidden" name="intent" value="delete" />
                      <input type="hidden" name="gatheringId" value={gathering.id} />
                      <Button type="submit" variant="destructive" size="sm" disabled={isPending}>Delete</Button>
                    </Form>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* My Games Section */}
      <div className="animate-fade-in-up animation-delay-200 space-y-4 mt-10">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold tracking-[0.2em] text-primary uppercase">
            Adventure log
          </p>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Games You&apos;ve Joined
          </h2>
        </div>

        {joinedGatherings.length === 0 ? (
          <div className="rounded-lg border border-border bg-card/60 p-10 text-center backdrop-blur-sm">
            <p className="text-sm text-muted-foreground">You haven&apos;t joined any gatherings yet.</p>
            <Button className="mt-4" asChild>
              <Link to="/search">Find games to join</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {joinedGatherings.map((gathering) => (
              <div
                key={gathering.id}
                className="rounded-lg border border-border bg-card/60 p-5 backdrop-blur-sm transition-all duration-200 hover:border-primary/20"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/gatherings/${gathering.id}`}
                      className="text-base font-semibold tracking-tight text-foreground transition-colors hover:text-primary"
                    >
                      {gathering.title}
                    </Link>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <ClientDate date={gathering.nextOccurrenceAt} fallback="No upcoming session" dateStyle="medium" />
                      <Badge
                        variant={gathering.participantStatus === 'joined' ? 'default' : 'secondary'}
                        className="text-[10px]"
                      >
                        {gathering.participantStatus === 'joined' ? 'Joined' : 'Waitlisted'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Friend Activity Preview */}
      <div className="animate-fade-in-up animation-delay-300 rounded-lg border border-border bg-card/60 p-5 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.2em] text-primary uppercase">Social</p>
            <p className="text-sm text-foreground mt-1">
              {friendActivityCount > 0
                ? `${friendActivityCount} gathering${friendActivityCount !== 1 ? 's' : ''} your friends are in`
                : 'No friend activity yet'}
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/friends/activity">View Activity</Link>
          </Button>
        </div>
      </div>
    </div>
    </div>
  )
}
