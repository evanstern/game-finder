import { Badge } from '@game-finder/ui/components/badge'
import { Button } from '@game-finder/ui/components/button'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router'
import { MapBackground } from '../components/map-background.js'
import { useTRPC } from '../trpc/provider.js'

export default function Dashboard() {
  const navigate = useNavigate()
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const { data: currentUser, isLoading: authLoading } = useQuery(trpc.auth.me.queryOptions())
  const { data: gatherings = [], isLoading: gatheringsLoading } = useQuery(
    trpc.gathering.listByHost.queryOptions(),
  )

  useEffect(() => {
    if (!authLoading && !currentUser) navigate('/login')
  }, [currentUser, authLoading, navigate])

  const closeMutation = useMutation(
    trpc.gathering.close.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.gathering.listByHost.queryOptions())
      },
    }),
  )

  const deleteMutation = useMutation(
    trpc.gathering.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.gathering.listByHost.queryOptions())
      },
    }),
  )

  if (authLoading || !currentUser) return null

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

      {gatheringsLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : gatherings.length === 0 ? (
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
                    <span>
                      {gathering.nextOccurrenceAt
                        ? new Date(gathering.nextOccurrenceAt).toLocaleDateString([], { dateStyle: 'medium' })
                        : 'No upcoming session'}
                    </span>
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
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={closeMutation.isPending}
                      onClick={() => closeMutation.mutate({ id: gathering.id })}
                    >
                      Close
                    </Button>
                  ) : (
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={deleteMutation.isPending}
                      onClick={() => {
                        if (confirm(`Delete "${gathering.title}"? This cannot be undone.`)) {
                          deleteMutation.mutate({ id: gathering.id })
                        }
                      }}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
    </div>
  )
}
