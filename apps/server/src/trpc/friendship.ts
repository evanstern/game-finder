import { TRPCError } from '@trpc/server'
import { sql } from '@game-finder/db'
import {
  sendFriendRequestSchema,
  friendshipActionSchema,
} from '@game-finder/contracts/friendship'
import { serializeFriendship } from '@game-finder/db/serializers'
import { createRouter, protectedProcedure } from './init.js'

export const friendshipRouter = createRouter({
  sendRequest: protectedProcedure
    .input(sendFriendRequestSchema)
    .mutation(async ({ input, ctx }) => {
      if (input.userId === ctx.userId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot send a friend request to yourself' })
      }

      // Check for existing row in either direction (any status)
      const existing = await ctx.db
        .selectFrom('friendship')
        .select(['id', 'status', 'requester_id'])
        .where((eb) =>
          eb.or([
            eb.and([
              eb('requester_id', '=', ctx.userId),
              eb('addressee_id', '=', input.userId),
            ]),
            eb.and([
              eb('requester_id', '=', input.userId),
              eb('addressee_id', '=', ctx.userId),
            ]),
          ]),
        )
        .executeTakeFirst()

      if (existing) {
        if (existing.status === 'pending' || existing.status === 'accepted') {
          throw new TRPCError({ code: 'CONFLICT', message: 'A friendship already exists between these users' })
        }
        // Declined row exists — clean it up so a fresh request can be created
        await ctx.db.deleteFrom('friendship').where('id', '=', existing.id).execute()
      }

      // Validate target user exists
      const targetUser = await ctx.db
        .selectFrom('users')
        .select('id')
        .where('id', '=', input.userId)
        .executeTakeFirst()

      if (!targetUser) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' })
      }

      // Validate shared gathering (either as host or participant)
      const sharedGathering = await ctx.db
        .selectFrom('gathering')
        .select('gathering.id')
        .where((eb) =>
          eb.or([
            // Current user is host, target is participant
            eb.and([
              eb('gathering.host_id', '=', ctx.userId),
              eb.exists(
                eb.selectFrom('gathering_participant')
                  .select(sql.lit(1).as('one'))
                  .where('user_id', '=', input.userId)
                  .whereRef('gathering_id', '=', 'gathering.id'),
              ),
            ]),
            // Current user is participant, target is host
            eb.and([
              eb('gathering.host_id', '=', input.userId),
              eb.exists(
                eb.selectFrom('gathering_participant')
                  .select(sql.lit(1).as('one'))
                  .where('user_id', '=', ctx.userId)
                  .whereRef('gathering_id', '=', 'gathering.id'),
              ),
            ]),
            // Both are participants in the same gathering
            eb.and([
              eb.exists(
                eb.selectFrom('gathering_participant')
                  .select(sql.lit(1).as('one'))
                  .where('user_id', '=', ctx.userId)
                  .whereRef('gathering_id', '=', 'gathering.id'),
              ),
              eb.exists(
                eb.selectFrom('gathering_participant')
                  .select(sql.lit(1).as('one'))
                  .where('user_id', '=', input.userId)
                  .whereRef('gathering_id', '=', 'gathering.id'),
              ),
            ]),
          ]),
        )
        .limit(1)
        .executeTakeFirst()

      if (!sharedGathering) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You can only send friend requests to people you share a gathering with' })
      }

      const friendship = await ctx.db
        .insertInto('friendship')
        .values({
          requester_id: ctx.userId,
          addressee_id: input.userId,
        })
        .returningAll()
        .executeTakeFirstOrThrow()

      return serializeFriendship(friendship)
    }),

  acceptRequest: protectedProcedure
    .input(friendshipActionSchema)
    .mutation(async ({ input, ctx }) => {
      const friendship = await ctx.db
        .selectFrom('friendship')
        .selectAll()
        .where('id', '=', input.friendshipId)
        .executeTakeFirst()

      if (!friendship || friendship.status !== 'pending') {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Pending friend request not found' })
      }

      if (friendship.addressee_id !== ctx.userId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only the addressee can accept a friend request' })
      }

      const updated = await ctx.db
        .updateTable('friendship')
        .set({ status: 'accepted', updated_at: new Date() })
        .where('id', '=', input.friendshipId)
        .returningAll()
        .executeTakeFirstOrThrow()

      return serializeFriendship(updated)
    }),

  declineRequest: protectedProcedure
    .input(friendshipActionSchema)
    .mutation(async ({ input, ctx }) => {
      const friendship = await ctx.db
        .selectFrom('friendship')
        .selectAll()
        .where('id', '=', input.friendshipId)
        .executeTakeFirst()

      if (!friendship || friendship.status !== 'pending') {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Pending friend request not found' })
      }

      if (friendship.addressee_id !== ctx.userId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only the addressee can decline a friend request' })
      }

      const updated = await ctx.db
        .updateTable('friendship')
        .set({ status: 'declined', updated_at: new Date() })
        .where('id', '=', input.friendshipId)
        .returningAll()
        .executeTakeFirstOrThrow()

      return serializeFriendship(updated)
    }),

  remove: protectedProcedure
    .input(friendshipActionSchema)
    .mutation(async ({ input, ctx }) => {
      const friendship = await ctx.db
        .selectFrom('friendship')
        .select(['id', 'requester_id', 'addressee_id'])
        .where('id', '=', input.friendshipId)
        .executeTakeFirst()

      if (!friendship) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Friendship not found' })
      }

      if (friendship.requester_id !== ctx.userId && friendship.addressee_id !== ctx.userId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You are not part of this friendship' })
      }

      await ctx.db
        .deleteFrom('friendship')
        .where('id', '=', input.friendshipId)
        .execute()

      return { success: true }
    }),

  listFriends: protectedProcedure
    .query(async ({ ctx }) => {
      const rows = await ctx.db
        .selectFrom('friendship')
        .innerJoin('users as requester', 'requester.id', 'friendship.requester_id')
        .innerJoin('users as addressee', 'addressee.id', 'friendship.addressee_id')
        .select([
          'friendship.id as friendship_id',
          'friendship.requester_id',
          'friendship.addressee_id',
          'friendship.created_at',
          'requester.display_name as requester_display_name',
          'addressee.display_name as addressee_display_name',
        ])
        .where('friendship.status', '=', 'accepted')
        .where((eb) =>
          eb.or([
            eb('friendship.requester_id', '=', ctx.userId),
            eb('friendship.addressee_id', '=', ctx.userId),
          ]),
        )
        .execute()

      return rows.map((row) => {
        const iAmRequester = row.requester_id === ctx.userId
        return {
          friendshipId: row.friendship_id,
          friendId: iAmRequester ? row.addressee_id : row.requester_id,
          displayName: iAmRequester ? row.addressee_display_name : row.requester_display_name,
          createdAt: row.created_at,
        }
      })
    }),

  listIncomingRequests: protectedProcedure
    .query(async ({ ctx }) => {
      const rows = await ctx.db
        .selectFrom('friendship')
        .innerJoin('users', 'users.id', 'friendship.requester_id')
        .selectAll('friendship')
        .select('users.display_name as requester_display_name')
        .where('friendship.addressee_id', '=', ctx.userId)
        .where('friendship.status', '=', 'pending')
        .orderBy('friendship.created_at', 'desc')
        .execute()

      return rows.map((row) => ({
        ...serializeFriendship(row),
        requesterDisplayName: row.requester_display_name,
      }))
    }),

  listOutgoingRequests: protectedProcedure
    .query(async ({ ctx }) => {
      const rows = await ctx.db
        .selectFrom('friendship')
        .innerJoin('users', 'users.id', 'friendship.addressee_id')
        .selectAll('friendship')
        .select('users.display_name as addressee_display_name')
        .where('friendship.requester_id', '=', ctx.userId)
        .where('friendship.status', '=', 'pending')
        .orderBy('friendship.created_at', 'desc')
        .execute()

      return rows.map((row) => ({
        ...serializeFriendship(row),
        addresseeDisplayName: row.addressee_display_name,
      }))
    }),
})
