import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { GatheringForm } from '../components/gathering-form.js'
import { useTRPC } from '../trpc/provider.js'
import type { Route } from './+types/gatherings.$id.edit.js'

function toDatetimeLocal(date: Date): string {
  const d = new Date(date)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function toDateInput(date: Date): string {
  const d = new Date(date)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export default function EditGathering({ params }: Route.ComponentProps) {
  const navigate = useNavigate()
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const { data: currentUser, isLoading: authLoading } = useQuery(trpc.auth.me.queryOptions())
  const { data: gathering, isLoading: gatheringLoading } = useQuery(
    trpc.gathering.getById.queryOptions({ id: params.id }),
  )

  useEffect(() => {
    if (!authLoading && !currentUser) navigate('/login')
  }, [currentUser, authLoading, navigate])

  useEffect(() => {
    if (!gatheringLoading && gathering && currentUser) {
      if (gathering.hostId !== currentUser.id) {
        navigate(`/gatherings/${params.id}`)
      }
    }
  }, [gathering, gatheringLoading, currentUser, navigate, params.id])

  const updateMutation = useMutation(trpc.gathering.update.mutationOptions())

  const isLoading = authLoading || gatheringLoading

  if (isLoading || !currentUser || !gathering) return null

  if (gathering.hostId !== currentUser.id) return null

  const initialData = {
    title: gathering.title,
    gameIds: gathering.games.map((g) => g.id),
    zipCode: gathering.zipCode,
    scheduleType: gathering.scheduleType,
    startsAt: toDatetimeLocal(new Date(gathering.startsAt)),
    endDate: gathering.endDate ? toDateInput(new Date(gathering.endDate)) : '',
    durationMinutes: gathering.durationMinutes != null ? String(gathering.durationMinutes) : '',
    maxPlayers: gathering.maxPlayers != null ? String(gathering.maxPlayers) : '',
    description: gathering.description,
  }

  return (
    <div className="relative min-h-[calc(100vh-65px)]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/3 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary opacity-[0.03] blur-[100px]" />
        <div className="absolute inset-0 bg-noise" />
      </div>

    <div className="relative mx-auto max-w-3xl px-4 py-10">
      <GatheringForm
        submitLabel="Save Changes"
        isPending={updateMutation.isPending}
        initialData={initialData}
        errors={updateMutation.error ? { form: updateMutation.error.message } : {}}
        onSubmit={(data) => {
          updateMutation.mutate(
            {
              id: params.id,
              title: data.title,
              gameIds: data.gameIds,
              zipCode: data.zipCode,
              scheduleType: data.scheduleType,
              startsAt: new Date(data.startsAt).toISOString(),
              endDate: data.endDate ? new Date(data.endDate).toISOString() : null,
              durationMinutes: data.durationMinutes ? parseInt(data.durationMinutes, 10) : null,
              maxPlayers: data.maxPlayers ? parseInt(data.maxPlayers, 10) : null,
              description: data.description,
            },
            {
              onSuccess: () => {
                queryClient.invalidateQueries(trpc.gathering.getById.queryOptions({ id: params.id }))
                navigate(`/gatherings/${params.id}`)
              },
            },
          )
        }}
      />
    </div>
    </div>
  )
}
