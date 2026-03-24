import { Badge } from '@game-finder/ui/components/badge'
import { Button } from '@game-finder/ui/components/button'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router'
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
    <div className="mx-auto max-w-3xl px-4 py-10 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          Your Gatherings
        </h1>
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
        <div className="rounded-lg border border-border bg-card/80 p-10 text-center">
          <p className="text-muted-foreground">You have no gatherings yet.</p>
          <Button className="mt-4" asChild>
            <Link to="/gatherings/new">Create your first gathering</Link>
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Title</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Next Session</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {gatherings.map((gathering) => (
                <tr key={gathering.id} className="bg-card/40">
                  <td className="px-4 py-3">
                    <Link
                      to={`/gatherings/${gathering.id}`}
                      className="font-medium text-foreground hover:text-primary transition-colors"
                    >
                      {gathering.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {gathering.nextOccurrenceAt
                      ? new Date(gathering.nextOccurrenceAt).toLocaleDateString([], { dateStyle: 'medium' })
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={gathering.status === 'active' ? 'default' : 'secondary'}>
                      {gathering.status === 'active' ? 'Active' : 'Closed'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
