import { Badge } from '@game-finder/ui/components/badge'
import { Button } from '@game-finder/ui/components/button'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import ReactMarkdown from 'react-markdown'
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

  const { data: currentUser } = useQuery(trpc.auth.me.queryOptions())
  const { data: gathering, isLoading, error } = useQuery(
    trpc.gathering.getById.queryOptions({ id: params.id }),
  )

  const closeMutation = useMutation(trpc.gathering.close.mutationOptions())

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      </div>
    )
  }

  if (error || !gathering) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-muted-foreground">Gathering not found.</p>
      </div>
    )
  }

  const isOwner = currentUser?.id === gathering.hostId

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
            {gathering.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            Hosted by {gathering.host.displayName}
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

      <div className="rounded-lg border border-border bg-card/80 p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="font-medium text-xs tracking-wide text-muted-foreground uppercase mb-1">Schedule</p>
            <p>{formatSchedule(gathering.scheduleType, new Date(gathering.startsAt))}</p>
          </div>
          {gathering.nextOccurrenceAt && (
            <div>
              <p className="font-medium text-xs tracking-wide text-muted-foreground uppercase mb-1">Next Session</p>
              <p>{new Date(gathering.nextOccurrenceAt).toLocaleDateString([], { dateStyle: 'medium' })}</p>
            </div>
          )}
          <div>
            <p className="font-medium text-xs tracking-wide text-muted-foreground uppercase mb-1">Location</p>
            <p>{gathering.zipCode}</p>
          </div>
          {gathering.maxPlayers && (
            <div>
              <p className="font-medium text-xs tracking-wide text-muted-foreground uppercase mb-1">Max Players</p>
              <p>{gathering.maxPlayers}</p>
            </div>
          )}
        </div>
      </div>

      {gathering.games.length > 0 && (
        <div className="space-y-2">
          <p className="font-medium text-xs tracking-wide text-muted-foreground uppercase">Games</p>
          <div className="flex flex-wrap gap-1.5">
            {gathering.games.map((game) => (
              <Badge key={game.id} variant="outline">{game.name}</Badge>
            ))}
          </div>
        </div>
      )}

      {gathering.description && (
        <div className="prose prose-sm prose-invert max-w-none">
          <ReactMarkdown>{gathering.description}</ReactMarkdown>
        </div>
      )}
    </div>
  )
}
