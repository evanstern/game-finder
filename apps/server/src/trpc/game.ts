import { gameTypeSchema } from '@game-finder/contracts/game'
import { serializeGame } from '@game-finder/db/serializers'
import { TRPCError } from '@trpc/server'
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
      return games.map(serializeGame)
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
      return serializeGame(game)
    }),
})
