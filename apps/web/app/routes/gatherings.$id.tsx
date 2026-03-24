import { Badge } from '@game-finder/ui/components/badge'
import { Button } from '@game-finder/ui/components/button'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router'
import ReactMarkdown from 'react-markdown'
import { MapBackground } from '../components/map-background.js'
import { useTRPC } from '../trpc/provider.js'
import type { Route } from './+types/gatherings.$id.js'

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

export default function GatheringDetails({ params }: Route.ComponentProps) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const { data: currentUser } = useQuery(trpc.auth.me.queryOptions())
  const { data: gathering, isLoading, error } = useQuery(
    trpc.gathering.getById.queryOptions({ id: params.id }),
  )

  const closeMutation = useMutation(
    trpc.gathering.close.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: trpc.gathering.getById.queryOptions({ id: params.id }).queryKey,
        })
      },
    }),
  )

  if (isLoading) {
    return (
      <div className="relative min-h-[calc(100vh-65px)]">
        <MapBackground />
        <div className="relative z-10 mx-auto max-w-4xl px-6 py-10">
          <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        </div>
      </div>
    )
  }

  if (error || !gathering) {
    return (
      <div className="relative min-h-[calc(100vh-65px)]">
        <MapBackground />
        <div className="relative z-10 mx-auto max-w-4xl px-6 py-10 text-center">
          <p className="text-lg text-muted-foreground">Gathering not found.</p>
        </div>
      </div>
    )
  }

  const isOwner = currentUser?.id === gathering.hostId

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
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={closeMutation.isPending}
                  onClick={() => closeMutation.mutate({ id: gathering.id })}
                >
                  Close
                </Button>
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
