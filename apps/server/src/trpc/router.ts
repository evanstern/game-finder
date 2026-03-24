import { authRouter } from './auth.js'
import { createRouter, publicProcedure } from './init.js'

export const appRouter = createRouter({
  health: createRouter({
    check: publicProcedure.query(() => {
      return { status: 'ok' as const }
    }),
  }),
  auth: authRouter,
})

export type AppRouter = typeof appRouter
