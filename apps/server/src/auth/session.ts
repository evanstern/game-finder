import type Redis from 'ioredis'

const SESSION_PREFIX = 'session:'
const SESSION_TTL = 60 * 60 * 24 * 7

export async function createSession(
  redis: Redis,
  userId: string,
): Promise<string> {
  const sessionId = crypto.randomUUID()
  await redis.set(
    `${SESSION_PREFIX}${sessionId}`,
    JSON.stringify({ userId, createdAt: Date.now() }),
    'EX',
    SESSION_TTL,
  )
  return sessionId
}

export async function getSession(
  redis: Redis,
  sessionId: string,
): Promise<{ userId: string } | null> {
  const data = await redis.get(`${SESSION_PREFIX}${sessionId}`)
  if (!data) return null
  const parsed = JSON.parse(data) as { userId: string }
  return { userId: parsed.userId }
}

export async function deleteSession(
  redis: Redis,
  sessionId: string,
): Promise<void> {
  await redis.del(`${SESSION_PREFIX}${sessionId}`)
}
