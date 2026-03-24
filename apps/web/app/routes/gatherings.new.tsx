import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { GatheringForm } from '../components/gathering-form.js'
import { useTRPC } from '../trpc/provider.js'

export default function NewGathering() {
  const navigate = useNavigate()
  const trpc = useTRPC()
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  const { data: currentUser, isLoading } = useQuery(trpc.auth.me.queryOptions())

  useEffect(() => {
    if (!isLoading && !currentUser) navigate('/login')
  }, [currentUser, isLoading, navigate])

  const createMutation = useMutation(trpc.gathering.create.mutationOptions())

  if (isLoading || !currentUser) return null

  return (
    <div className="relative min-h-[calc(100vh-65px)]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/3 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary opacity-[0.03] blur-[100px]" />
        <div className="absolute inset-0 bg-noise" />
      </div>

    <div className="relative mx-auto max-w-3xl px-4 py-10">
      <GatheringForm
        submitLabel="Create Gathering"
        isPending={createMutation.isPending}
        errors={formErrors}
        onSubmit={(data) => {
          setFormErrors({})
          createMutation.mutate(
            {
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
              onSuccess: (result) => {
                navigate(`/gatherings/${result.id}`)
              },
              onError: (error) => {
                setFormErrors({ form: error.message })
              },
            },
          )
        }}
      />
    </div>
    </div>
  )
}
