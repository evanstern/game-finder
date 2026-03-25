import { Button } from '@game-finder/ui/components/button'
import { Form, Link, redirect } from 'react-router'
import { MapBackground } from '../components/map-background.js'
import { createServerTRPC } from '../trpc/server.js'
import type { Route } from './+types/friends.js'

export async function loader({ context }: Route.LoaderArgs) {
  const ctx = context as { cookie?: string }
  const trpc = createServerTRPC(ctx.cookie ?? '')

  const user = await trpc.auth.me.query().catch(() => null)
  if (!user) throw redirect('/login?returnTo=/friends')

  const [friends, incomingRequests] = await Promise.all([
    trpc.friendship.listFriends.query(),
    trpc.friendship.listIncomingRequests.query(),
  ])

  return { friends, incomingRequests }
}

export async function action({ request, context }: Route.ActionArgs) {
  const ctx = context as { cookie?: string }
  const trpc = createServerTRPC(ctx.cookie ?? '')

  const formData = await request.formData()
  const intent = String(formData.get('intent'))
  const friendshipId = String(formData.get('friendshipId'))

  if (intent === 'accept') {
    await trpc.friendship.acceptRequest.mutate({ friendshipId })
  } else if (intent === 'decline') {
    await trpc.friendship.declineRequest.mutate({ friendshipId })
  } else if (intent === 'remove') {
    await trpc.friendship.remove.mutate({ friendshipId })
  }

  return redirect('/friends')
}

export default function Friends({ loaderData }: Route.ComponentProps) {
  const { friends, incomingRequests } = loaderData

  return (
    <div className="relative min-h-[calc(100vh-65px)]">
      <MapBackground />

    <div className="relative z-10 mx-auto max-w-4xl px-6 py-10 space-y-10">
      {/* Friend Requests */}
      <div className="animate-fade-in-up space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold tracking-[0.2em] text-primary uppercase">
              Incoming
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Friend Requests
            </h1>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/friends/activity">Friend Activity</Link>
          </Button>
        </div>

        {incomingRequests.length === 0 ? (
          <div className="rounded-lg border border-border bg-card/60 p-8 text-center backdrop-blur-sm">
            <p className="text-sm text-muted-foreground">No pending requests.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {incomingRequests.map((req) => (
              <div
                key={req.id}
                className="rounded-lg border border-border bg-card/60 p-4 backdrop-blur-sm flex items-center justify-between gap-4"
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">{req.requesterDisplayName}</p>
                  <p className="text-xs text-muted-foreground">wants to be your friend</p>
                </div>
                <div className="flex items-center gap-2">
                  <Form method="post">
                    <input type="hidden" name="intent" value="accept" />
                    <input type="hidden" name="friendshipId" value={req.id} />
                    <Button type="submit" size="sm">Accept</Button>
                  </Form>
                  <Form method="post">
                    <input type="hidden" name="intent" value="decline" />
                    <input type="hidden" name="friendshipId" value={req.id} />
                    <Button type="submit" variant="outline" size="sm">Decline</Button>
                  </Form>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Friends List */}
      <div className="animate-fade-in-up animation-delay-100 space-y-4">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold tracking-[0.2em] text-primary uppercase">
            Your party
          </p>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            My Friends
          </h2>
        </div>

        {friends.length === 0 ? (
          <div className="rounded-lg border border-border bg-card/60 p-8 text-center backdrop-blur-sm">
            <p className="text-sm text-muted-foreground">No friends yet. Join a gathering to meet people!</p>
            <Button className="mt-4" asChild>
              <Link to="/search">Find games</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {friends.map((friend) => (
              <div
                key={friend.friendshipId}
                className="rounded-lg border border-border bg-card/60 p-4 backdrop-blur-sm flex items-center justify-between gap-4"
              >
                <p className="text-sm font-semibold text-foreground">{friend.displayName}</p>
                <Form
                  method="post"
                  onSubmit={(e) => {
                    if (!confirm(`Remove ${friend.displayName} as a friend?`)) {
                      e.preventDefault()
                    }
                  }}
                >
                  <input type="hidden" name="intent" value="remove" />
                  <input type="hidden" name="friendshipId" value={friend.friendshipId} />
                  <Button type="submit" variant="ghost" size="sm" className="text-muted-foreground">
                    Remove
                  </Button>
                </Form>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    </div>
  )
}
