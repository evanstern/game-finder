import { Badge } from '@game-finder/ui/components/badge'
import { Button } from '@game-finder/ui/components/button'
import { Input } from '@game-finder/ui/components/input'
import { useState } from 'react'
import { data, Form, Link, redirect } from 'react-router'
import ReactMarkdown from 'react-markdown'
import { ClientDate, ScheduleLabel } from '../components/client-date.js'
import { MapBackground } from '../components/map-background.js'
import { createServerTRPC } from '../trpc/server.js'
import type { Route } from './+types/gatherings.$id.js'

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const ctx = context as { cookie?: string }
  const trpc = createServerTRPC(ctx.cookie ?? '')

  const [user, gathering, participants] = await Promise.all([
    trpc.auth.me.query().catch(() => null),
    trpc.gathering.getById.query({ id: params.id }).catch(() => null),
    trpc.gathering.listParticipants.query({ gatheringId: params.id }).catch(() => []),
  ])

  if (!gathering) {
    throw data('Gathering not found', { status: 404 })
  }

  const url = new URL(request.url)
  const joinCode = url.searchParams.get('code') ?? undefined

  let outgoingRequests: Array<{ addresseeId: string }> = []
  let incomingRequests: Array<{ requesterId: string }> = []
  let friends: Array<{ friendId: string }> = []
  if (user) {
    const [outgoing, incoming, friendList] = await Promise.all([
      trpc.friendship.listOutgoingRequests.query().catch(() => []),
      trpc.friendship.listIncomingRequests.query().catch(() => []),
      trpc.friendship.listFriends.query().catch(() => []),
    ])
    outgoingRequests = outgoing
    incomingRequests = incoming
    friends = friendList
  }

  return { gathering, user, participants, joinCode, outgoingRequests, incomingRequests, friends }
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const ctx = context as { cookie?: string }
  const trpc = createServerTRPC(ctx.cookie ?? '')
  const formData = await request.formData()
  const intent = String(formData.get('intent'))

  if (intent === 'close') {
    await trpc.gathering.close.mutate({ id: params.id })
  } else if (intent === 'join') {
    const joinCode = String(formData.get('joinCode') ?? '')
    await trpc.gathering.join.mutate({
      gatheringId: params.id,
      joinCode: joinCode || undefined,
    })
  } else if (intent === 'leave') {
    await trpc.gathering.leave.mutate({ gatheringId: params.id })
  } else if (intent === 'sendFriendRequest') {
    const targetUserId = String(formData.get('targetUserId'))
    await trpc.friendship.sendRequest.mutate({ userId: targetUserId })
  }

  return redirect(`/gatherings/${params.id}`)
}

function JoinForm({
  visibility,
  joinCode,
}: {
  visibility: string
  joinCode?: string
}) {
  const [code, setCode] = useState(joinCode ?? '')
  const needsCode = visibility === 'private' && !joinCode

  return (
    <Form method="post" className="flex items-center gap-2">
      <input type="hidden" name="intent" value="join" />
      {visibility === 'private' && (
        needsCode ? (
          <Input
            name="joinCode"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter join code"
            className="w-40 text-sm"
            required
          />
        ) : (
          <input type="hidden" name="joinCode" value={joinCode} />
        )
      )}
      <Button type="submit" size="sm">Join Game</Button>
    </Form>
  )
}

export default function GatheringDetails({ loaderData }: Route.ComponentProps) {
  const { gathering, user, participants, joinCode, outgoingRequests, incomingRequests, friends } = loaderData
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
          <div className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
            <span>Hosted by <span className="font-medium text-primary">{gathering.host.displayName}</span></span>
            {user && !isOwner && (() => {
              const hostIsFriend = friends.some((f) => f.friendId === gathering.hostId)
              const hostIsPending = outgoingRequests.some((r) => r.addresseeId === gathering.hostId) || incomingRequests.some((r) => r.requesterId === gathering.hostId)
              if (hostIsFriend) return <span className="text-[10px] text-primary">Friend</span>
              if (hostIsPending) return <span className="text-[10px] text-muted-foreground">Request Pending</span>
              return (
                <Form method="post" className="inline">
                  <input type="hidden" name="intent" value="sendFriendRequest" />
                  <input type="hidden" name="targetUserId" value={gathering.hostId} />
                  <Button type="submit" variant="ghost" size="sm" className="h-5 px-1.5 text-[10px] text-muted-foreground">
                    + Add Friend
                  </Button>
                </Form>
              )
            })()}
          </div>
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
                <Form
                  method="post"
                  onSubmit={(e) => {
                    if (!window.confirm('Are you sure you want to close this gathering? This cannot be undone.')) {
                      e.preventDefault()
                    }
                  }}
                >
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
            <ScheduleLabel scheduleType={gathering.scheduleType} startsAt={gathering.startsAt} className="text-foreground" />
          </div>
          {gathering.nextOccurrenceAt && (
            <div>
              <p className="font-semibold text-[11px] tracking-[0.15em] text-primary uppercase mb-1.5">Next Session</p>
              <ClientDate date={gathering.nextOccurrenceAt} dateStyle="medium" className="text-foreground" />
            </div>
          )}
          <div>
            <p className="font-semibold text-[11px] tracking-[0.15em] text-primary uppercase mb-1.5">Location</p>
            <p className="text-foreground">{gathering.locationLabel}</p>
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

      {/* Participants Section */}
      <div className="animate-fade-in-up animation-delay-200 space-y-3">
        <div className="flex items-center gap-3">
          <p className="font-semibold text-[11px] tracking-[0.15em] text-primary uppercase">Players</p>
          <span className="text-sm text-muted-foreground">
            {gathering.participantCount}{gathering.maxPlayers ? `/${gathering.maxPlayers}` : ''} joined
          </span>
        </div>

        {participants.length > 0 && (
          <div className="space-y-2">
            {participants.map((p) => {
              const isSelf = user?.id === p.userId
              const isFriend = friends.some((f) => f.friendId === p.userId)
              const isPending = outgoingRequests.some((r) => r.addresseeId === p.userId) || incomingRequests.some((r) => r.requesterId === p.userId)

              return (
                <div key={p.id} className="flex items-center gap-2">
                  <Badge
                    variant={p.status === 'joined' ? 'outline' : 'secondary'}
                    className={p.status === 'joined' ? 'border-primary/30 text-primary' : ''}
                  >
                    {p.displayName}
                    {p.status === 'waitlisted' && ' (waitlisted)'}
                  </Badge>
                  {user && !isSelf && !isFriend && !isPending && (
                    <Form method="post" className="inline">
                      <input type="hidden" name="intent" value="sendFriendRequest" />
                      <input type="hidden" name="targetUserId" value={p.userId} />
                      <Button type="submit" variant="ghost" size="sm" className="h-6 px-2 text-[11px] text-muted-foreground">
                        + Add Friend
                      </Button>
                    </Form>
                  )}
                  {isPending && (
                    <span className="text-[11px] text-muted-foreground">Pending</span>
                  )}
                  {isFriend && (
                    <span className="text-[11px] text-primary">Friend</span>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {user && !isOwner && gathering.status === 'active' && (
          <div>
            {gathering.currentUserStatus === null ? (
              <JoinForm
                visibility={gathering.visibility}
                joinCode={joinCode}
              />
            ) : (
              <div className="flex items-center gap-3">
                {gathering.currentUserStatus === 'waitlisted' && (
                  <span className="text-sm text-muted-foreground">
                    You&apos;re #{participants.filter((p) => p.status === 'waitlisted').findIndex((p) => p.userId === user.id) + 1} on the waitlist
                  </span>
                )}
                <Form method="post">
                  <input type="hidden" name="intent" value="leave" />
                  <Button type="submit" variant="outline" size="sm">
                    {gathering.currentUserStatus === 'waitlisted' ? 'Leave Waitlist' : 'Leave Game'}
                  </Button>
                </Form>
              </div>
            )}
          </div>
        )}
      </div>

      {isOwner && gathering.visibility === 'private' && gathering.joinCode && (
        <div className="animate-fade-in-up animation-delay-200 rounded-lg border border-border bg-card/60 p-4 backdrop-blur-sm space-y-2">
          <p className="font-semibold text-[11px] tracking-[0.15em] text-primary uppercase">Invite Link</p>
          <div className="flex items-center gap-2">
            <Input
              readOnly
              value={`${typeof window !== 'undefined' ? window.location.origin : ''}/gatherings/${gathering.id}?code=${gathering.joinCode}`}
              className="text-xs"
            />
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(
                  `${window.location.origin}/gatherings/${gathering.id}?code=${gathering.joinCode}`,
                )
              }}
            >
              Copy
            </Button>
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
