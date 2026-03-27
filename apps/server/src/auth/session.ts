import type { db as DbType } from '../db.js'

const SESSION_TTL_DAYS = 7

type Db = typeof DbType

export async function createSession(db: Db, userId: string): Promise<string> {
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + SESSION_TTL_DAYS)

  const session = await db
    .insertInto('session')
    .values({ user_id: userId, expires_at: expiresAt })
    .returning('id')
    .executeTakeFirstOrThrow()

  return session.id
}

export async function getSession(
  db: Db,
  sessionId: string,
): Promise<{ userId: string } | null> {
  const session = await db
    .selectFrom('session')
    .select('user_id')
    .where('id', '=', sessionId)
    .where('expires_at', '>', new Date())
    .executeTakeFirst()

  if (!session) return null
  return { userId: session.user_id }
}

export async function deleteSession(db: Db, sessionId: string): Promise<void> {
  await db.deleteFrom('session').where('id', '=', sessionId).execute()
}
