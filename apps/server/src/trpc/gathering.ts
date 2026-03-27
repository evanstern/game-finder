import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import {
  createGatheringSchema,
  updateGatheringSchema,
} from '@game-finder/contracts/gathering'
import {
  joinGatheringSchema,
  leaveGatheringSchema,
  listParticipantsSchema,
} from '@game-finder/contracts/participant'
import { friendActivityInputSchema } from '@game-finder/contracts/friendship'
import { searchGatheringsSchema } from '@game-finder/contracts/search'
import { sql } from '@game-finder/db'
import { serializeGame, serializeGathering, serializeParticipant } from '@game-finder/db/serializers'
import { computeNextOccurrence } from '../gathering/next-occurrence.js'
import { generateJoinCode } from '../gathering/join-code.js'
import { stripMarkdownPreview } from '../gathering/strip-markdown.js'
import type { Context } from './context.js'
import { createRouter, protectedProcedure, publicProcedure } from './init.js'

async function fetchGamesForGathering(ctx: { db: Context['db'] }, gatheringId: string) {
  const rows = await ctx.db
    .selectFrom('gathering_game')
    .innerJoin('game', 'game.id', 'gathering_game.game_id')
    .selectAll('game')
    .where('gathering_game.gathering_id', '=', gatheringId)
    .execute()

  return rows.map(serializeGame)
}

async function ensureGatheringOwner(
  db: Context['db'],
  gatheringId: string,
  userId: string,
) {
  const existing = await db
    .selectFrom('gathering')
    .select(['id', 'host_id'])
    .where('id', '=', gatheringId)
    .executeTakeFirst()

  if (!existing) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Gathering not found' })
  }

  if (existing.host_id !== userId) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Not the owner' })
  }

  return existing
}

export const gatheringRouter = createRouter({
  create: protectedProcedure
    .input(createGatheringSchema)
    .mutation(async ({ input, ctx }) => {
      const existingGames = await ctx.db
        .selectFrom('game')
        .select('id')
        .where('id', 'in', input.gameIds)
        .execute()

      if (existingGames.length !== input.gameIds.length) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'One or more game IDs are invalid',
        })
      }

      const nextOccurrenceAt = computeNextOccurrence(
        input.scheduleType,
        new Date(input.startsAt),
        input.endDate ? new Date(input.endDate) : null,
      )

      const gathering = await ctx.db
        .insertInto('gathering')
        .values({
          host_id: ctx.userId,
          title: input.title,
          description: input.description,
          zip_code: input.zipCode,
          schedule_type: input.scheduleType,
          starts_at: new Date(input.startsAt),
          end_date: input.endDate ? new Date(input.endDate) : null,
          duration_minutes: input.durationMinutes ?? null,
          max_players: input.maxPlayers ?? null,
          next_occurrence_at: nextOccurrenceAt,
          visibility: input.visibility ?? 'public',
          join_code: (input.visibility ?? 'public') === 'private' ? generateJoinCode() : null,
        })
        .returningAll()
        .executeTakeFirstOrThrow()

      await ctx.db
        .insertInto('gathering_game')
        .values(input.gameIds.map((gameId) => ({
          gathering_id: gathering.id,
          game_id: gameId,
        })))
        .execute()

      const games = await fetchGamesForGathering(ctx, gathering.id)

      return {
        ...serializeGathering(gathering),
        games,
      }
    }),

  update: protectedProcedure
    .input(updateGatheringSchema)
    .mutation(async ({ input, ctx }) => {
      const existing = await ctx.db
        .selectFrom('gathering')
        .selectAll()
        .where('id', '=', input.id)
        .executeTakeFirst()

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Gathering not found' })
      }

      if (existing.host_id !== ctx.userId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Not the owner' })
      }

      const { id, gameIds, ...fields } = input

      const scheduleType = fields.scheduleType ?? existing.schedule_type
      const startsAt = fields.startsAt ? new Date(fields.startsAt) : existing.starts_at
      const endDate = fields.endDate !== undefined
        ? (fields.endDate ? new Date(fields.endDate) : null)
        : existing.end_date
      const nextOccurrenceAt = computeNextOccurrence(scheduleType, startsAt, endDate)

      let query = ctx.db
        .updateTable('gathering')
        .set({
          next_occurrence_at: nextOccurrenceAt,
          updated_at: new Date(),
        })

      if (fields.title !== undefined) query = query.set({ title: fields.title })
      if (fields.description !== undefined) query = query.set({ description: fields.description })
      if (fields.zipCode !== undefined) query = query.set({ zip_code: fields.zipCode })
      if (fields.scheduleType !== undefined) query = query.set({ schedule_type: fields.scheduleType })
      if (fields.startsAt !== undefined) query = query.set({ starts_at: new Date(fields.startsAt) })
      if (fields.endDate !== undefined) query = query.set({ end_date: fields.endDate ? new Date(fields.endDate) : null })
      if (fields.durationMinutes !== undefined) query = query.set({ duration_minutes: fields.durationMinutes })
      if (fields.maxPlayers !== undefined) query = query.set({ max_players: fields.maxPlayers })

      if (fields.visibility !== undefined) {
        query = query.set({ visibility: fields.visibility })
        if (fields.visibility === 'private' && !existing.join_code) {
          query = query.set({ join_code: generateJoinCode() })
        } else if (fields.visibility === 'public') {
          query = query.set({ join_code: null })
        }
      }

      const updated = await query
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirstOrThrow()

      if (gameIds) {
        await ctx.db
          .deleteFrom('gathering_game')
          .where('gathering_id', '=', id)
          .execute()

        await ctx.db
          .insertInto('gathering_game')
          .values(gameIds.map((gameId) => ({
            gathering_id: id,
            game_id: gameId,
          })))
          .execute()
      }

      const games = await fetchGamesForGathering(ctx, id)

      return {
        ...serializeGathering(updated),
        games,
      }
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      await ensureGatheringOwner(ctx.db, input.id, ctx.userId)

      await ctx.db
        .deleteFrom('gathering')
        .where('id', '=', input.id)
        .execute()

      return { success: true }
    }),

  close: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      await ensureGatheringOwner(ctx.db, input.id, ctx.userId)

      const updated = await ctx.db
        .updateTable('gathering')
        .set({ status: 'closed', updated_at: new Date() })
        .where('id', '=', input.id)
        .returningAll()
        .executeTakeFirstOrThrow()

      return serializeGathering(updated)
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const row = await ctx.db
        .selectFrom('gathering')
        .innerJoin('users', 'users.id', 'gathering.host_id')
        .leftJoin('zip_code_location as z', 'z.zip_code', 'gathering.zip_code')
        .selectAll('gathering')
        .select('users.display_name as host_display_name')
        .select('z.city as location_city')
        .select('z.state as location_state')
        .where('gathering.id', '=', input.id)
        .executeTakeFirst()

      if (!row) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Gathering not found' })
      }

      const games = await fetchGamesForGathering(ctx, row.id)

      const countResult = await ctx.db
        .selectFrom('gathering_participant')
        .select(sql<number>`count(*)`.as('count'))
        .where('gathering_id', '=', row.id)
        .where('status', '=', 'joined')
        .executeTakeFirstOrThrow()

      let currentUserStatus: 'joined' | 'waitlisted' | null = null
      if (ctx.userId) {
        const participant = await ctx.db
          .selectFrom('gathering_participant')
          .select('status')
          .where('gathering_id', '=', row.id)
          .where('user_id', '=', ctx.userId)
          .executeTakeFirst()
        currentUserStatus = participant?.status ?? null
      }

      const locationLabel = row.location_city && row.location_state
        ? `${row.location_city}, ${row.location_state}`
        : row.zip_code

      return {
        ...serializeGathering(row),
        host: { displayName: row.host_display_name },
        games,
        participantCount: Number(countResult.count),
        currentUserStatus,
        locationLabel,
        // Only expose joinCode to the host
        joinCode: ctx.userId === row.host_id ? row.join_code : null,
      }
    }),

  listByHost: protectedProcedure
    .query(async ({ ctx }) => {
      const rows = await ctx.db
        .selectFrom('gathering')
        .selectAll()
        .where('host_id', '=', ctx.userId)
        .orderBy('created_at', 'desc')
        .execute()

      return rows.map(serializeGathering)
    }),

  join: protectedProcedure
    .input(joinGatheringSchema)
    .mutation(async ({ input, ctx }) => {
      // Row-level lock to prevent race conditions on max_players check
      const gathering = await ctx.db
        .selectFrom('gathering')
        .selectAll()
        .where('id', '=', input.gatheringId)
        .forUpdate()
        .executeTakeFirst()

      if (!gathering) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Gathering not found' })
      }

      if (gathering.status !== 'active') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Gathering is not active' })
      }

      if (gathering.host_id === ctx.userId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Host cannot join their own gathering' })
      }

      if (gathering.visibility === 'private') {
        if (!input.joinCode || input.joinCode !== gathering.join_code) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Invalid join code' })
        }
      }

      const existing = await ctx.db
        .selectFrom('gathering_participant')
        .select('id')
        .where('gathering_id', '=', input.gatheringId)
        .where('user_id', '=', ctx.userId)
        .executeTakeFirst()

      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Already a participant' })
      }

      let status: 'joined' | 'waitlisted' = 'joined'
      if (gathering.max_players !== null) {
        const countResult = await ctx.db
          .selectFrom('gathering_participant')
          .select(sql<number>`count(*)`.as('count'))
          .where('gathering_id', '=', input.gatheringId)
          .where('status', '=', 'joined')
          .executeTakeFirstOrThrow()

        if (Number(countResult.count) >= gathering.max_players) {
          status = 'waitlisted'
        }
      }

      const participant = await ctx.db
        .insertInto('gathering_participant')
        .values({
          gathering_id: input.gatheringId,
          user_id: ctx.userId,
          status,
        })
        .returningAll()
        .executeTakeFirstOrThrow()

      const user = await ctx.db
        .selectFrom('users')
        .select('display_name')
        .where('id', '=', ctx.userId)
        .executeTakeFirstOrThrow()

      return serializeParticipant({ ...participant, display_name: user.display_name })
    }),

  leave: protectedProcedure
    .input(leaveGatheringSchema)
    .mutation(async ({ input, ctx }) => {
      const gathering = await ctx.db
        .selectFrom('gathering')
        .select(['id', 'host_id', 'max_players'])
        .where('id', '=', input.gatheringId)
        .forUpdate()
        .executeTakeFirst()

      if (!gathering) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Gathering not found' })
      }

      if (gathering.host_id === ctx.userId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Host cannot leave — close the gathering instead' })
      }

      const participant = await ctx.db
        .selectFrom('gathering_participant')
        .select(['id', 'status'])
        .where('gathering_id', '=', input.gatheringId)
        .where('user_id', '=', ctx.userId)
        .executeTakeFirst()

      if (!participant) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Not a participant' })
      }

      await ctx.db
        .deleteFrom('gathering_participant')
        .where('id', '=', participant.id)
        .execute()

      // Auto-promote oldest waitlisted participant if a joined member left
      if (participant.status === 'joined' && gathering.max_players !== null) {
        const nextWaitlisted = await ctx.db
          .selectFrom('gathering_participant')
          .select('id')
          .where('gathering_id', '=', input.gatheringId)
          .where('status', '=', 'waitlisted')
          .orderBy('created_at', 'asc')
          .limit(1)
          .executeTakeFirst()

        if (nextWaitlisted) {
          await ctx.db
            .updateTable('gathering_participant')
            .set({ status: 'joined' })
            .where('id', '=', nextWaitlisted.id)
            .execute()
        }
      }

      return { success: true }
    }),

  listParticipants: publicProcedure
    .input(listParticipantsSchema)
    .query(async ({ input, ctx }) => {
      const rows = await ctx.db
        .selectFrom('gathering_participant')
        .innerJoin('users', 'users.id', 'gathering_participant.user_id')
        .selectAll('gathering_participant')
        .select('users.display_name')
        .where('gathering_participant.gathering_id', '=', input.gatheringId)
        .orderBy('gathering_participant.created_at', 'asc')
        .execute()

      return rows.map(serializeParticipant)
    }),

  listJoined: protectedProcedure
    .query(async ({ ctx }) => {
      const rows = await ctx.db
        .selectFrom('gathering_participant')
        .innerJoin('gathering', 'gathering.id', 'gathering_participant.gathering_id')
        .selectAll('gathering')
        .select('gathering_participant.status as participant_status')
        .where('gathering_participant.user_id', '=', ctx.userId)
        .where('gathering.status', '=', 'active')
        .orderBy('gathering.next_occurrence_at', 'asc')
        .execute()

      return rows.map((row) => ({
        ...serializeGathering(row),
        participantStatus: row.participant_status,
      }))
    }),

  friendActivity: protectedProcedure
    .input(friendActivityInputSchema)
    .query(async ({ input, ctx }) => {
      const { page, pageSize } = input

      // Get accepted friend IDs
      const friendRows = await ctx.db
        .selectFrom('friendship')
        .select(['requester_id', 'addressee_id'])
        .where('status', '=', 'accepted')
        .where((eb) =>
          eb.or([
            eb('requester_id', '=', ctx.userId),
            eb('addressee_id', '=', ctx.userId),
          ]),
        )
        .execute()

      const friendIds = friendRows.map((r) =>
        r.requester_id === ctx.userId ? r.addressee_id : r.requester_id,
      )

      if (friendIds.length === 0) {
        return { gatherings: [], total: 0, page, pageSize }
      }

      // Base query: public, active gatherings with next_occurrence_at
      // where a friend is host OR a joined participant
      // excluding gatherings the current user is involved in
      let baseQuery = ctx.db
        .selectFrom('gathering')
        .where('gathering.visibility', '=', 'public')
        .where('gathering.status', '=', 'active')
        .where('gathering.next_occurrence_at', 'is not', null)
        .where('gathering.host_id', '!=', ctx.userId)
        .where((eb) =>
          eb.not(
            eb.exists(
              eb.selectFrom('gathering_participant')
                .select(sql.lit(1).as('one'))
                .where('user_id', '=', ctx.userId)
                .whereRef('gathering_id', '=', 'gathering.id'),
            ),
          ),
        )
        .where((eb) =>
          eb.or([
            eb('gathering.host_id', 'in', friendIds),
            eb.exists(
              eb.selectFrom('gathering_participant')
                .select(sql.lit(1).as('one'))
                .where('user_id', 'in', friendIds)
                .where('status', '=', 'joined')
                .whereRef('gathering_id', '=', 'gathering.id'),
            ),
          ]),
        )

      // Count total
      const countResult = await baseQuery
        .select(sql<number>`count(*)`.as('count'))
        .executeTakeFirstOrThrow()
      const total = Number(countResult.count)

      // Fetch paginated results
      const rows = await baseQuery
        .selectAll('gathering')
        .orderBy('gathering.next_occurrence_at', 'asc')
        .limit(pageSize)
        .offset((page - 1) * pageSize)
        .execute()

      // For each gathering, determine which friends are involved and their role
      const gatheringIds = rows.map((r) => r.id)
      const friendsMap = new Map<string, Array<{ friendId: string; displayName: string; role: 'host' | 'participant' }>>()

      if (gatheringIds.length > 0) {
        // Friends who are hosts
        const hostFriendIds = rows
          .filter((r) => friendIds.includes(r.host_id))
          .map((r) => r.host_id)

        if (hostFriendIds.length > 0) {
          const hostUsers = await ctx.db
            .selectFrom('users')
            .select(['id', 'display_name'])
            .where('id', 'in', hostFriendIds)
            .execute()

          const hostNameMap = new Map(hostUsers.map((u) => [u.id, u.display_name]))

          for (const row of rows) {
            if (friendIds.includes(row.host_id)) {
              const existing = friendsMap.get(row.id) ?? []
              existing.push({
                friendId: row.host_id,
                displayName: hostNameMap.get(row.host_id) ?? 'Unknown',
                role: 'host',
              })
              friendsMap.set(row.id, existing)
            }
          }
        }

        // Friends who are participants
        const participantRows = await ctx.db
          .selectFrom('gathering_participant')
          .innerJoin('users', 'users.id', 'gathering_participant.user_id')
          .select([
            'gathering_participant.gathering_id',
            'gathering_participant.user_id',
            'users.display_name',
          ])
          .where('gathering_participant.gathering_id', 'in', gatheringIds)
          .where('gathering_participant.user_id', 'in', friendIds)
          .where('gathering_participant.status', '=', 'joined')
          .execute()

        for (const row of participantRows) {
          const existing = friendsMap.get(row.gathering_id) ?? []
          existing.push({ friendId: row.user_id, displayName: row.display_name, role: 'participant' })
          friendsMap.set(row.gathering_id, existing)
        }
      }

      const gatherings = rows.map((row) => ({
        ...serializeGathering(row),
        friends: friendsMap.get(row.id) ?? [],
      }))

      return { gatherings, total, page, pageSize }
    }),

  search: publicProcedure
    .input(searchGatheringsSchema)
    .query(async ({ input, ctx }) => {
      const { zipCode, radius, query, gameTypes, sortBy, page, pageSize } = input

      const searchZip = await ctx.db
        .selectFrom('zip_code_location')
        .selectAll()
        .where('zip_code', '=', zipCode)
        .executeTakeFirst()

      if (!searchZip) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid ZIP code' })
      }

      const lat = Number(searchZip.latitude)
      const lng = Number(searchZip.longitude)

      const distanceExpr = sql<number>`(
        3959 * acos(
          cos(radians(${lat})) * cos(radians(cast(${sql.ref('z.latitude')} as double precision))) *
          cos(radians(cast(${sql.ref('z.longitude')} as double precision)) - radians(${lng})) +
          sin(radians(${lat})) * sin(radians(cast(${sql.ref('z.latitude')} as double precision)))
        )
      )`

      let baseQuery = ctx.db
        .selectFrom('gathering')
        .innerJoin('zip_code_location as z', 'z.zip_code', 'gathering.zip_code')
        .innerJoin('users', 'users.id', 'gathering.host_id')
        .where('gathering.status', '=', 'active')
        .where('gathering.visibility', '=', 'public')
        .where('gathering.next_occurrence_at', 'is not', null)

      if (query) {
        const pattern = `%${query}%`
        baseQuery = baseQuery.where((eb) =>
          eb.or([
            eb('gathering.title', 'ilike', pattern),
            eb.exists(
              eb
                .selectFrom('gathering_game')
                .innerJoin('game', 'game.id', 'gathering_game.game_id')
                .whereRef('gathering_game.gathering_id', '=', 'gathering.id')
                .where('game.name', 'ilike', pattern)
                .select(sql.lit(1).as('one')),
            ),
          ]),
        )
      }

      if (gameTypes && gameTypes.length > 0) {
        baseQuery = baseQuery.where((eb) =>
          eb.exists(
            eb
              .selectFrom('gathering_game')
              .innerJoin('game', 'game.id', 'gathering_game.game_id')
              .whereRef('gathering_game.gathering_id', '=', 'gathering.id')
              .where('game.type', 'in', gameTypes)
              .select(sql.lit(1).as('one')),
          ),
        )
      }

      baseQuery = baseQuery.where(distanceExpr, '<=', radius)

      const countResult = await baseQuery
        .select(sql<number>`count(*)`.as('count'))
        .executeTakeFirstOrThrow()
      const total = Number(countResult.count)

      let resultsQuery = baseQuery
        .select([
          'gathering.id',
          'gathering.title',
          'gathering.description',
          'gathering.zip_code',
          'gathering.schedule_type',
          'gathering.starts_at',
          'gathering.next_occurrence_at',
          'gathering.max_players',
          'gathering.status',
          'users.display_name as host_display_name',
          'z.city as location_city',
          'z.state as location_state',
          distanceExpr.as('distance_miles'),
        ])
        .limit(pageSize)
        .offset((page - 1) * pageSize)

      if (sortBy === 'next_session') {
        resultsQuery = resultsQuery.orderBy('gathering.next_occurrence_at', 'asc')
      } else {
        resultsQuery = resultsQuery.orderBy(sql`distance_miles`, 'asc')
      }

      const rows = await resultsQuery.execute()

      const gatheringIds = rows.map((r) => r.id)
      const gamesMap: Map<string, Array<{ id: string; name: string; type: string }>> = new Map()

      if (gatheringIds.length > 0) {
        const gameRows = await ctx.db
          .selectFrom('gathering_game')
          .innerJoin('game', 'game.id', 'gathering_game.game_id')
          .select([
            'gathering_game.gathering_id',
            'game.id',
            'game.name',
            'game.type',
          ])
          .where('gathering_game.gathering_id', 'in', gatheringIds)
          .execute()

        for (const row of gameRows) {
          const existing = gamesMap.get(row.gathering_id) ?? []
          existing.push({ id: row.id, name: row.name, type: row.type })
          gamesMap.set(row.gathering_id, existing)
        }
      }

      const gatherings = rows.map((row) => ({
        id: row.id,
        title: row.title,
        description: stripMarkdownPreview(row.description),
        zipCode: row.zip_code,
        distanceMiles: Math.round(Number(row.distance_miles) * 10) / 10,
        scheduleType: row.schedule_type,
        startsAt: row.starts_at,
        nextOccurrenceAt: row.next_occurrence_at,
        maxPlayers: row.max_players,
        status: row.status,
        hostDisplayName: row.host_display_name,
        games: gamesMap.get(row.id) ?? [],
        locationLabel: `${row.location_city}, ${row.location_state}`,
      }))

      return {
        gatherings,
        total,
        page,
        pageSize,
        searchLocation: {
          city: searchZip.city,
          state: searchZip.state,
        },
      }
    }),
})
