import { appRouter } from '../src/trpc/router.js'
import { createContext } from '../src/trpc/context.js'
import { db } from '../src/db.js'
import { redis } from '../src/redis.js'
import { hashPassword } from '../src/auth/password.js'
import { createSession } from '../src/auth/session.js'

export { db, redis }

export async function createTestCaller(cookie?: string) {
  const req = new Request('http://test.com', {
    headers: cookie ? { cookie } : {},
  })
  const resHeaders = new Headers()
  const ctx = await createContext({ req, resHeaders })
  const caller = appRouter.createCaller(ctx)
  return { caller, resHeaders }
}

export async function createTestUser(
  overrides?: {
    email?: string
    password?: string
    displayName?: string
  },
) {
  const email = overrides?.email ?? 'test@example.com'
  const password = overrides?.password ?? 'password123'
  const displayName = overrides?.displayName ?? 'Test User'
  const passwordHash = await hashPassword(password)

  return db
    .insertInto('users')
    .values({
      email,
      password_hash: passwordHash,
      display_name: displayName,
    })
    .returningAll()
    .executeTakeFirstOrThrow()
}

export async function createAuthenticatedCaller(userId: string) {
  const sessionId = await createSession(redis, userId)
  return createTestCaller(`session_id=${sessionId}`)
}

export async function cleanup() {
  await db.deleteFrom('users').execute()
  const keys = await redis.keys('session:*')
  if (keys.length > 0) await redis.del(...keys)
}
