import { authRouter } from './auth.js'
import { gameRouter } from './game.js'
import { createRouter, publicProcedure } from './init.js'

export const appRouter = createRouter({
  health: createRouter({
    check: publicProcedure.query(() => {
      return { status: 'ok' as const }
    }),
  }),
  auth: authRouter,
  game: gameRouter,
})

export type AppRouter = typeof appRouter
