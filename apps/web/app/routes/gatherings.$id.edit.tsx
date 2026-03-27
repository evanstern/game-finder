import { redirect, useNavigation } from 'react-router'
import { toDateInput, toDatetimeLocal } from '../components/client-date.js'
import { GatheringForm } from '../components/gathering-form.js'
import { MapBackground } from '../components/map-background.js'
import { createServerTRPC } from '../trpc/server.js'
import { parseGatheringErrors } from '../utils/parse-gathering-errors.js'
import { parseGatheringFormData } from '../utils/parse-gathering-form-data.js'
import type { Route } from './+types/gatherings.$id.edit.js'

export async function loader({ params, context }: Route.LoaderArgs) {
  const ctx = context as { cookie?: string }
  const trpc = createServerTRPC(ctx.cookie ?? '')

  const user = await trpc.auth.me.query().catch(() => null)
  if (!user) throw redirect(`/login?returnTo=/gatherings/${params.id}/edit`)

  const gathering = await trpc.gathering.getById
    .query({ id: params.id })
    .catch(() => null)
  if (!gathering) throw redirect('/dashboard')
  if (gathering.hostId !== user.id) throw redirect(`/gatherings/${params.id}`)

  const games = await trpc.game.list.query({})

  return {
    gathering: {
      title: gathering.title,
      gameIds: gathering.games.map((g) => g.id),
      zipCode: gathering.zipCode,
      scheduleType: gathering.scheduleType,
      startsAt: toDatetimeLocal(new Date(gathering.startsAt)),
      endDate: gathering.endDate
        ? toDateInput(new Date(gathering.endDate))
        : '',
      durationMinutes:
        gathering.durationMinutes != null
          ? String(gathering.durationMinutes)
          : '',
      maxPlayers:
        gathering.maxPlayers != null ? String(gathering.maxPlayers) : '',
      description: gathering.description,
      visibility: gathering.visibility,
    },
    games,
  }
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const ctx = context as { cookie?: string }
  const trpc = createServerTRPC(ctx.cookie ?? '')

  const user = await trpc.auth.me.query().catch(() => null)
  if (!user) throw redirect(`/login?returnTo=/gatherings/${params.id}/edit`)

  const formData = await request.formData()

  try {
    await trpc.gathering.update.mutate({
      id: params.id,
      ...parseGatheringFormData(formData),
    })
    return redirect(`/gatherings/${params.id}`)
  } catch (error) {
    return { errors: parseGatheringErrors(error) }
  }
}

export default function EditGathering({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const navigation = useNavigation()
  const isPending = navigation.state === 'submitting'

  return (
    <div className="relative min-h-[calc(100vh-65px)]">
      <MapBackground />
      <div className="relative z-10 mx-auto max-w-4xl px-6 py-10">
        <GatheringForm
          submitLabel="Save Changes"
          isPending={isPending}
          initialData={loaderData.gathering}
          games={loaderData.games}
          errors={actionData?.errors}
        />
      </div>
    </div>
  )
}
