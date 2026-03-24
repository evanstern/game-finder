import { authRouter } from './auth.js'
import { gameRouter } from './game.js'
import { gatheringRouter } from './gathering.js'
import { createRouter, publicProcedure } from './init.js'

export const appRouter = createRouter({
  health: createRouter({
    check: publicProcedure.query(() => {
      return { status: 'ok' as const }
    }),
  }),
  auth: authRouter,
  game: gameRouter,
  gathering: gatheringRouter,
})

export type AppRouter = typeof appRouter
