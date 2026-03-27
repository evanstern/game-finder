import { TRPCError } from '@trpc/server'
import {
  loginInputSchema,
  registerInputSchema,
} from '@game-finder/contracts/auth'
import { serializeUser } from '@game-finder/db/serializers'
import {
  serializeClearSessionCookie,
  serializeSessionCookie,
} from '../auth/cookies.js'
import { hashPassword, verifyPassword } from '../auth/password.js'
import { createSession, deleteSession } from '../auth/session.js'
import { createRouter, protectedProcedure, publicProcedure } from './init.js'

export const authRouter = createRouter({
  register: publicProcedure
    .input(registerInputSchema)
    .mutation(async ({ input, ctx }) => {
      const existing = await ctx.db
        .selectFrom('users')
        .select('id')
        .where('email', '=', input.email)
        .executeTakeFirst()

      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Email already in use',
        })
      }

      const passwordHash = await hashPassword(input.password)

      const user = await ctx.db
        .insertInto('users')
        .values({
          email: input.email,
          password_hash: passwordHash,
          display_name: input.displayName,
        })
        .returningAll()
        .executeTakeFirstOrThrow()

      const sessionId = await createSession(ctx.db, user.id)
      ctx.resHeaders.append('set-cookie', serializeSessionCookie(sessionId))

      return { user: serializeUser(user) }
    }),

  login: publicProcedure
    .input(loginInputSchema)
    .mutation(async ({ input, ctx }) => {
      const user = await ctx.db
        .selectFrom('users')
        .selectAll()
        .where('email', '=', input.email)
        .executeTakeFirst()

      if (!user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid email or password',
        })
      }

      const valid = await verifyPassword(input.password, user.password_hash)
      if (!valid) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid email or password',
        })
      }

      const sessionId = await createSession(ctx.db, user.id)
      ctx.resHeaders.append('set-cookie', serializeSessionCookie(sessionId))

      return { user: serializeUser(user) }
    }),

  logout: protectedProcedure.mutation(async ({ ctx }) => {
    await deleteSession(ctx.db, ctx.sessionId)
    ctx.resHeaders.append('set-cookie', serializeClearSessionCookie())
    return { success: true }
  }),

  me: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.userId) return null

    const user = await ctx.db
      .selectFrom('users')
      .selectAll()
      .where('id', '=', ctx.userId)
      .executeTakeFirst()

    if (!user) return null

    return serializeUser(user)
  }),
})
