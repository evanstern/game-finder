import { redirect, useNavigation } from 'react-router'
import { GatheringForm } from '../components/gathering-form.js'
import { MapBackground } from '../components/map-background.js'
import { createServerTRPC } from '../trpc/server.js'
import type { Route } from './+types/gatherings.new.js'

export async function loader({ context }: Route.LoaderArgs) {
  const ctx = context as { cookie?: string }
  const trpc = createServerTRPC(ctx.cookie ?? '')
  const user = await trpc.auth.me.query().catch(() => null)
  if (!user) throw redirect('/login?returnTo=/gatherings/new')

  const games = await trpc.game.list.query({})
  return { games }
}

export async function action({ request, context }: Route.ActionArgs) {
  const ctx = context as { cookie?: string }
  const trpc = createServerTRPC(ctx.cookie ?? '')

  const user = await trpc.auth.me.query().catch(() => null)
  if (!user) throw redirect('/login?returnTo=/gatherings/new')

  const formData = await request.formData()

  try {
    const result = await trpc.gathering.create.mutate({
      title: String(formData.get('title') ?? ''),
      gameIds: formData.getAll('gameIds').map(String),
      zipCode: String(formData.get('zipCode') ?? ''),
      scheduleType: String(formData.get('scheduleType') ?? 'once') as 'once' | 'weekly' | 'biweekly' | 'monthly',
      startsAt: new Date(String(formData.get('startsAt'))).toISOString(),
      endDate: formData.get('endDate') ? new Date(String(formData.get('endDate'))).toISOString() : null,
      durationMinutes: formData.get('durationMinutes') ? parseInt(String(formData.get('durationMinutes')), 10) : null,
      maxPlayers: formData.get('maxPlayers') ? parseInt(String(formData.get('maxPlayers')), 10) : null,
      description: String(formData.get('description') ?? ''),
      visibility: String(formData.get('visibility') ?? 'public') as 'public' | 'private',
    })
    return redirect(`/gatherings/${result.id}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create gathering'
    return { errors: { form: message } }
  }
}

export default function NewGathering({ loaderData, actionData }: Route.ComponentProps) {
  const navigation = useNavigation()
  const isPending = navigation.state === 'submitting'

  return (
    <div className="relative min-h-[calc(100vh-65px)]">
      <MapBackground />
      <div className="relative z-10 mx-auto max-w-4xl px-6 py-10">
        <GatheringForm
          submitLabel="Create Gathering"
          isPending={isPending}
          games={loaderData.games}
          errors={actionData?.errors}
        />
      </div>
    </div>
  )
}
