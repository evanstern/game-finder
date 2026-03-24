import Redis from 'ioredis'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import {
  createSession,
  deleteSession,
  getSession,
} from '../src/auth/session.js'
import { hashPassword, verifyPassword } from '../src/auth/password.js'

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT),
})

beforeEach(async () => {
  const keys = await redis.keys('session:*')
  if (keys.length > 0) await redis.del(...keys)
})

afterAll(() => {
  redis.disconnect()
})

describe('Session helpers', () => {
  it('createSession stores session and returns ID', async () => {
    const sessionId = await createSession(redis, 'user-123')
    expect(sessionId).toBeTruthy()

    const data = await redis.get(`session:${sessionId}`)
    expect(data).toBeTruthy()

    const parsed = JSON.parse(data!) as { userId: string }
    expect(parsed.userId).toBe('user-123')
  })

  it('getSession returns session data for valid ID', async () => {
    const sessionId = await createSession(redis, 'user-456')
    const session = await getSession(redis, sessionId)
    expect(session).toEqual({ userId: 'user-456' })
  })

  it('getSession returns null for invalid ID', async () => {
    const session = await getSession(redis, 'nonexistent')
    expect(session).toBeNull()
  })

  it('deleteSession removes the session', async () => {
    const sessionId = await createSession(redis, 'user-789')
    await deleteSession(redis, sessionId)
    const session = await getSession(redis, sessionId)
    expect(session).toBeNull()
  })
})

describe('Password helpers', () => {
  it('hashPassword returns a bcrypt hash', async () => {
    const hash = await hashPassword('mysecretpassword')
    expect(hash).toBeTruthy()
    expect(hash).not.toBe('mysecretpassword')
    expect(hash.startsWith('$2')).toBe(true)
  })

  it('verifyPassword returns true for correct password', async () => {
    const hash = await hashPassword('correctpassword')
    const result = await verifyPassword('correctpassword', hash)
    expect(result).toBe(true)
  })

  it('verifyPassword returns false for wrong password', async () => {
    const hash = await hashPassword('correctpassword')
    const result = await verifyPassword('wrongpassword', hash)
    expect(result).toBe(false)
  })
})
