import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { GatheringForm } from '../components/gathering-form.js'
import { MapBackground } from '../components/map-background.js'
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
      <MapBackground />

    <div className="relative z-10 mx-auto max-w-4xl px-6 py-10">
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
