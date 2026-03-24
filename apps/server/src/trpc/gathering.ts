import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import {
  createGatheringSchema,
  updateGatheringSchema,
} from '@game-finder/contracts/gathering'
import { computeNextOccurrence } from '../gathering/next-occurrence.js'
import { createRouter, protectedProcedure, publicProcedure } from './init.js'
interface GatheringRow {
  id: string
  host_id: string
  title: string
  description: string
  zip_code: string
  schedule_type: 'once' | 'weekly' | 'biweekly' | 'monthly'
  starts_at: Date
  end_date: Date | null
  duration_minutes: number | null
  max_players: number | null
  status: 'active' | 'closed'
  next_occurrence_at: Date | null
  created_at: Date
  updated_at: Date
}

function serializeGathering(row: GatheringRow) {
  return {
    id: row.id,
    hostId: row.host_id,
    title: row.title,
    description: row.description,
    zipCode: row.zip_code,
    scheduleType: row.schedule_type,
    startsAt: row.starts_at,
    endDate: row.end_date,
    durationMinutes: row.duration_minutes,
    maxPlayers: row.max_players,
    status: row.status,
    nextOccurrenceAt: row.next_occurrence_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

async function fetchGamesForGathering(db: unknown, gatheringId: string) {
  const typedDb = db as import('kysely').Kysely<import('@game-finder/db').Database>
  const rows = await typedDb
    .selectFrom('gathering_game')
    .innerJoin('game', 'game.id', 'gathering_game.game_id')
    .selectAll('game')
    .where('gathering_game.gathering_id', '=', gatheringId)
    .execute()

  return rows.map((g) => ({
    id: g.id,
    name: g.name,
    type: g.type,
    description: g.description,
    minPlayers: g.min_players,
    maxPlayers: g.max_players,
    imageUrl: g.image_url,
    createdAt: g.created_at,
    updatedAt: g.updated_at,
  }))
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

      const games = await fetchGamesForGathering(ctx.db, gathering.id)

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

      const updateValues: Record<string, unknown> = {}
      if (fields.title !== undefined) updateValues.title = fields.title
      if (fields.description !== undefined) updateValues.description = fields.description
      if (fields.zipCode !== undefined) updateValues.zip_code = fields.zipCode
      if (fields.scheduleType !== undefined) updateValues.schedule_type = fields.scheduleType
      if (fields.startsAt !== undefined) updateValues.starts_at = new Date(fields.startsAt)
      if (fields.endDate !== undefined) updateValues.end_date = fields.endDate ? new Date(fields.endDate) : null
      if (fields.durationMinutes !== undefined) updateValues.duration_minutes = fields.durationMinutes
      if (fields.maxPlayers !== undefined) updateValues.max_players = fields.maxPlayers

      const scheduleType = fields.scheduleType ?? existing.schedule_type
      const startsAt = fields.startsAt ? new Date(fields.startsAt) : existing.starts_at
      const endDate = fields.endDate !== undefined
        ? (fields.endDate ? new Date(fields.endDate) : null)
        : existing.end_date

      const nextOccurrenceAt = computeNextOccurrence(scheduleType, startsAt, endDate)
      updateValues.next_occurrence_at = nextOccurrenceAt
      updateValues.updated_at = new Date()

      const updated = await ctx.db
        .updateTable('gathering')
        .set(updateValues)
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

      const games = await fetchGamesForGathering(ctx.db, id)

      return {
        ...serializeGathering(updated),
        games,
      }
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const existing = await ctx.db
        .selectFrom('gathering')
        .select(['id', 'host_id'])
        .where('id', '=', input.id)
        .executeTakeFirst()

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Gathering not found' })
      }

      if (existing.host_id !== ctx.userId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Not the owner' })
      }

      await ctx.db
        .deleteFrom('gathering')
        .where('id', '=', input.id)
        .execute()

      return { success: true }
    }),

  close: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
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
        .select([
          'gathering.id',
          'gathering.host_id',
          'gathering.title',
          'gathering.description',
          'gathering.zip_code',
          'gathering.schedule_type',
          'gathering.starts_at',
          'gathering.end_date',
          'gathering.duration_minutes',
          'gathering.max_players',
          'gathering.status',
          'gathering.next_occurrence_at',
          'gathering.created_at',
          'gathering.updated_at',
          'users.display_name as host_display_name',
        ])
        .where('gathering.id', '=', input.id)
        .executeTakeFirst()

      if (!row) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Gathering not found' })
      }

      const games = await fetchGamesForGathering(ctx.db, row.id)

      return {
        ...serializeGathering(row as unknown as GatheringRow),
        host: {
          displayName: (row as Record<string, unknown>).host_display_name as string,
        },
        games,
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

      return rows.map((row) => serializeGathering(row))
    }),
})
