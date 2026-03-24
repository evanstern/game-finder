import { TRPCError } from '@trpc/server'
import { gameTypeSchema } from '@game-finder/contracts/game'
import { z } from 'zod'
import { createRouter, publicProcedure } from './init.js'

export const gameRouter = createRouter({
  list: publicProcedure
    .input(z.object({ type: gameTypeSchema.optional() }))
    .query(async ({ input, ctx }) => {
      let query = ctx.db.selectFrom('game').selectAll().orderBy('name', 'asc')
      if (input.type) {
        query = query.where('type', '=', input.type)
      }
      const games = await query.execute()
      return games.map((g) => ({
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
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const game = await ctx.db
        .selectFrom('game')
        .selectAll()
        .where('id', '=', input.id)
        .executeTakeFirst()
      if (!game) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Game not found' })
      }
      return {
        id: game.id,
        name: game.name,
        type: game.type,
        description: game.description,
        minPlayers: game.min_players,
        maxPlayers: game.max_players,
        imageUrl: game.image_url,
        createdAt: game.created_at,
        updatedAt: game.updated_at,
      }
    }),
})
