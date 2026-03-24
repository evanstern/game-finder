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

export async function seedGames() {
  const games = [
    { name: 'Catan', type: 'board_game' as const, description: 'Trade and build.', min_players: 3, max_players: 4 },
    { name: 'D&D 5e', type: 'ttrpg' as const, description: 'Classic TTRPG.', min_players: 3, max_players: 6 },
    { name: 'Magic: The Gathering', type: 'card_game' as const, description: 'Card battler.', min_players: 2, max_players: 4 },
  ]
  return db.insertInto('game').values(games).returningAll().execute()
}

export async function seedZipCodes() {
  const zips = [
    { zip_code: '10001', city: 'New York', state: 'NY', latitude: 40.7484, longitude: -73.9967 },
    { zip_code: '10002', city: 'New York', state: 'NY', latitude: 40.7157, longitude: -73.9863 },
    { zip_code: '11201', city: 'Brooklyn', state: 'NY', latitude: 40.6892, longitude: -73.9857 },
    { zip_code: '90210', city: 'Beverly Hills', state: 'CA', latitude: 34.0901, longitude: -118.4065 },
    { zip_code: '60601', city: 'Chicago', state: 'IL', latitude: 41.8819, longitude: -87.6278 },
  ]
  await db.insertInto('zip_code_location').values(zips).execute()
  return zips
}

export async function createTestGathering(
  hostId: string,
  gameIds: string[],
  overrides?: {
    title?: string
    description?: string
    zipCode?: string
    scheduleType?: 'once' | 'weekly' | 'biweekly' | 'monthly'
    startsAt?: Date
    nextOccurrenceAt?: Date | null
    status?: 'active' | 'closed'
    maxPlayers?: number | null
  },
) {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)

  const gathering = await db
    .insertInto('gathering')
    .values({
      host_id: hostId,
      title: overrides?.title ?? 'Test Gathering',
      description: overrides?.description ?? 'A test gathering description.',
      zip_code: overrides?.zipCode ?? '10001',
      schedule_type: overrides?.scheduleType ?? 'weekly',
      starts_at: overrides?.startsAt ?? tomorrow,
      next_occurrence_at: overrides?.nextOccurrenceAt !== undefined
        ? overrides.nextOccurrenceAt
        : tomorrow,
      status: overrides?.status ?? 'active',
      max_players: overrides?.maxPlayers ?? 6,
    })
    .returningAll()
    .executeTakeFirstOrThrow()

  if (gameIds.length > 0) {
    await db
      .insertInto('gathering_game')
      .values(gameIds.map((gameId) => ({
        gathering_id: gathering.id,
        game_id: gameId,
      })))
      .execute()
  }

  return gathering
}

export async function cleanup() {
  await db.deleteFrom('gathering_game').execute()
  await db.deleteFrom('gathering').execute()
  await db.deleteFrom('game').execute()
  await db.deleteFrom('users').execute()
  await db.deleteFrom('zip_code_location').execute()
  const keys = await redis.keys('session:*')
  if (keys.length > 0) await redis.del(...keys)
}
