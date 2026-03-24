import { TRPCError, initTRPC } from '@trpc/server'
import type { Context } from './context.js'

const t = initTRPC.context<Context>().create()

const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.userId || !ctx.sessionId) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' })
  }
  return next({ ctx: { ...ctx, userId: ctx.userId, sessionId: ctx.sessionId } })
})

export const createRouter = t.router
export const publicProcedure = t.procedure
export const protectedProcedure = t.procedure.use(isAuthed)
