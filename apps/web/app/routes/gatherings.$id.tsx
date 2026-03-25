import { Badge } from '@game-finder/ui/components/badge'
import { Button } from '@game-finder/ui/components/button'
import { data, Form, Link, redirect } from 'react-router'
import ReactMarkdown from 'react-markdown'
import { MapBackground } from '../components/map-background.js'
import { createServerTRPC } from '../trpc/server.js'
import type { Route } from './+types/gatherings.$id.js'

export async function loader({ params, context }: Route.LoaderArgs) {
  const ctx = context as { cookie?: string }
  const trpc = createServerTRPC(ctx.cookie ?? '')

  const [user, gathering] = await Promise.all([
    trpc.auth.me.query().catch(() => null),
    trpc.gathering.getById.query({ id: params.id }).catch(() => null),
  ])

  if (!gathering) {
    throw data('Gathering not found', { status: 404 })
  }

  return { gathering, user }
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const ctx = context as { cookie?: string }
  const trpc = createServerTRPC(ctx.cookie ?? '')
  const formData = await request.formData()
  const intent = String(formData.get('intent'))

  if (intent === 'close') {
    await trpc.gathering.close.mutate({ id: params.id })
  }

  return redirect(`/gatherings/${params.id}`)
}

function formatSchedule(scheduleType: string, startsAt: Date): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const day = days[new Date(startsAt).getDay()]
  const time = new Date(startsAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  switch (scheduleType) {
    case 'once': return `One-time — ${new Date(startsAt).toLocaleDateString()} at ${time}`
    case 'weekly': return `Weekly — ${day}s at ${time}`
    case 'biweekly': return `Every 2 weeks — ${day}s at ${time}`
    case 'monthly': return `Monthly — ${day}s at ${time}`
    default: return scheduleType
  }
}

export default function GatheringDetails({ loaderData }: Route.ComponentProps) {
  const { gathering, user } = loaderData
  const isOwner = user?.id === gathering.hostId

  return (
    <div className="relative min-h-[calc(100vh-65px)]">
      <MapBackground />

    <div className="relative z-10 mx-auto max-w-4xl px-6 py-10 space-y-8">
      <div className="animate-fade-in-up flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold tracking-[0.2em] text-primary uppercase">
            Gathering
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            {gathering.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            Hosted by <span className="font-medium text-primary">{gathering.host.displayName}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={gathering.status === 'active' ? 'default' : 'secondary'}>
            {gathering.status === 'active' ? 'Active' : 'Closed'}
          </Badge>
          {isOwner && (
            <>
              <Button variant="outline" size="sm" asChild>
                <Link to={`/gatherings/${gathering.id}/edit`}>Edit</Link>
              </Button>
              {gathering.status === 'active' && (
                <Form method="post">
                  <input type="hidden" name="intent" value="close" />
                  <Button type="submit" variant="destructive" size="sm">Close</Button>
                </Form>
              )}
            </>
          )}
        </div>
      </div>

      <div className="animate-fade-in-up animation-delay-100 rounded-lg border border-border bg-card/60 p-6 backdrop-blur-sm space-y-4">
        <div className="grid grid-cols-2 gap-5 text-sm">
          <div>
            <p className="font-semibold text-[11px] tracking-[0.15em] text-primary uppercase mb-1.5">Schedule</p>
            <p className="text-foreground">{formatSchedule(gathering.scheduleType, new Date(gathering.startsAt))}</p>
          </div>
          {gathering.nextOccurrenceAt && (
            <div>
              <p className="font-semibold text-[11px] tracking-[0.15em] text-primary uppercase mb-1.5">Next Session</p>
              <p className="text-foreground">{new Date(gathering.nextOccurrenceAt).toLocaleDateString([], { dateStyle: 'medium' })}</p>
            </div>
          )}
          <div>
            <p className="font-semibold text-[11px] tracking-[0.15em] text-primary uppercase mb-1.5">Location</p>
            <p className="text-foreground">{gathering.zipCode}</p>
          </div>
          {gathering.maxPlayers && (
            <div>
              <p className="font-semibold text-[11px] tracking-[0.15em] text-primary uppercase mb-1.5">Max Players</p>
              <p className="text-foreground">{gathering.maxPlayers}</p>
            </div>
          )}
        </div>
      </div>

      {gathering.games.length > 0 && (
        <div className="animate-fade-in-up animation-delay-200 space-y-3">
          <p className="font-semibold text-[11px] tracking-[0.15em] text-primary uppercase">Games</p>
          <div className="flex flex-wrap gap-2">
            {gathering.games.map((game) => (
              <Badge key={game.id} variant="outline" className="border-primary/30 text-primary">{game.name}</Badge>
            ))}
          </div>
        </div>
      )}

      {gathering.description && (
        <div className="animate-fade-in-up animation-delay-300 rounded-lg border border-border bg-card/40 p-6 backdrop-blur-sm prose-themed">
          <ReactMarkdown>{gathering.description}</ReactMarkdown>
        </div>
      )}
    </div>
    </div>
  )
}
