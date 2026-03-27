import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { hashPassword, verifyPassword } from '../src/auth/password.js'
import {
  createSession,
  deleteSession,
  getSession,
} from '../src/auth/session.js'
import { db } from '../src/db.js'

beforeEach(async () => {
  await db.deleteFrom('session').execute()
})

afterAll(async () => {
  await db.deleteFrom('session').execute()
  await db.destroy()
})

describe('Session helpers', () => {
  it('createSession stores session and returns ID', async () => {
    const user = await db
      .insertInto('users')
      .values({
        email: 'session-test@example.com',
        password_hash: await hashPassword('pass'),
        display_name: 'Session Test',
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    const sessionId = await createSession(db, user.id)
    expect(sessionId).toBeTruthy()

    const row = await db
      .selectFrom('session')
      .selectAll()
      .where('id', '=', sessionId)
      .executeTakeFirst()
    expect(row).toBeTruthy()
    expect(row?.user_id).toBe(user.id)

    await db.deleteFrom('users').where('id', '=', user.id).execute()
  })

  it('getSession returns session data for valid ID', async () => {
    const user = await db
      .insertInto('users')
      .values({
        email: 'session-get@example.com',
        password_hash: await hashPassword('pass'),
        display_name: 'Get Test',
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    const sessionId = await createSession(db, user.id)
    const session = await getSession(db, sessionId)
    expect(session).toEqual({ userId: user.id })

    await db.deleteFrom('users').where('id', '=', user.id).execute()
  })

  it('getSession returns null for invalid ID', async () => {
    const session = await getSession(db, '00000000-0000-0000-0000-000000000000')
    expect(session).toBeNull()
  })

  it('deleteSession removes the session', async () => {
    const user = await db
      .insertInto('users')
      .values({
        email: 'session-del@example.com',
        password_hash: await hashPassword('pass'),
        display_name: 'Del Test',
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    const sessionId = await createSession(db, user.id)
    await deleteSession(db, sessionId)
    const session = await getSession(db, sessionId)
    expect(session).toBeNull()

    await db.deleteFrom('users').where('id', '=', user.id).execute()
  })

  it('getSession returns null for an expired session', async () => {
    const user = await db
      .insertInto('users')
      .values({
        email: 'session-expired@example.com',
        password_hash: await hashPassword('pass'),
        display_name: 'Expired Test',
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    const expiredSessionId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
    await db
      .insertInto('session')
      .values({
        id: expiredSessionId,
        user_id: user.id,
        expires_at: new Date(Date.now() - 1000),
      })
      .execute()

    const session = await getSession(db, expiredSessionId)
    expect(session).toBeNull()

    await db.deleteFrom('users').where('id', '=', user.id).execute()
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
