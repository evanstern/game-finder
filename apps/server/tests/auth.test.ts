import { afterEach, describe, expect, it } from 'vitest'
import {
  cleanup,
  createAuthenticatedCaller,
  createTestCaller,
  createTestUser,
} from './helpers.js'

afterEach(async () => {
  await cleanup()
})

describe('auth.register', () => {
  it('creates a user and sets session cookie', async () => {
    const { caller, resHeaders } = await createTestCaller()
    const result = await caller.auth.register({
      email: 'new@example.com',
      password: 'password123',
      displayName: 'New User',
    })

    expect(result.user.email).toBe('new@example.com')
    expect(result.user.displayName).toBe('New User')
    expect(result.user.id).toBeTruthy()
    expect(resHeaders.get('set-cookie')).toContain('session_id=')
  })

  it('lowercases and trims email', async () => {
    const { caller } = await createTestCaller()
    const result = await caller.auth.register({
      email: '  Test@Example.COM  ',
      password: 'password123',
      displayName: 'Test',
    })

    expect(result.user.email).toBe('test@example.com')
  })

  it('rejects duplicate email', async () => {
    await createTestUser({ email: 'taken@example.com' })
    const { caller } = await createTestCaller()

    await expect(
      caller.auth.register({
        email: 'taken@example.com',
        password: 'password123',
        displayName: 'Another User',
      }),
    ).rejects.toThrow(
      expect.objectContaining({
        code: 'CONFLICT',
      }),
    )
  })

  it('rejects password shorter than 8 characters', async () => {
    const { caller } = await createTestCaller()

    await expect(
      caller.auth.register({
        email: 'test@example.com',
        password: 'short',
        displayName: 'Test',
      }),
    ).rejects.toThrow()
  })
})

describe('auth.login', () => {
  it('logs in with correct credentials and sets session cookie', async () => {
    await createTestUser({
      email: 'user@example.com',
      password: 'password123',
    })
    const { caller, resHeaders } = await createTestCaller()

    const result = await caller.auth.login({
      email: 'user@example.com',
      password: 'password123',
    })

    expect(result.user.email).toBe('user@example.com')
    expect(resHeaders.get('set-cookie')).toContain('session_id=')
  })

  it('rejects wrong password', async () => {
    await createTestUser({
      email: 'user@example.com',
      password: 'password123',
    })
    const { caller } = await createTestCaller()

    await expect(
      caller.auth.login({
        email: 'user@example.com',
        password: 'wrongpassword',
      }),
    ).rejects.toThrow(
      expect.objectContaining({
        code: 'UNAUTHORIZED',
      }),
    )
  })

  it('rejects nonexistent email', async () => {
    const { caller } = await createTestCaller()

    await expect(
      caller.auth.login({
        email: 'nobody@example.com',
        password: 'password123',
      }),
    ).rejects.toThrow(
      expect.objectContaining({
        code: 'UNAUTHORIZED',
      }),
    )
  })
})

describe('auth.logout', () => {
  it('clears session and cookie', async () => {
    const user = await createTestUser()
    const { caller, resHeaders } = await createAuthenticatedCaller(user.id)

    const result = await caller.auth.logout()

    expect(result.success).toBe(true)
    expect(resHeaders.get('set-cookie')).toContain('Max-Age=0')
  })

  it('rejects unauthenticated request', async () => {
    const { caller } = await createTestCaller()

    await expect(caller.auth.logout()).rejects.toThrow(
      expect.objectContaining({
        code: 'UNAUTHORIZED',
      }),
    )
  })
})

describe('auth.me', () => {
  it('returns user when authenticated', async () => {
    const user = await createTestUser({
      email: 'me@example.com',
      displayName: 'Me User',
    })
    const { caller } = await createAuthenticatedCaller(user.id)

    const result = await caller.auth.me()

    expect(result).not.toBeNull()
    expect(result?.email).toBe('me@example.com')
    expect(result?.displayName).toBe('Me User')
  })

  it('returns null when not authenticated', async () => {
    const { caller } = await createTestCaller()

    const result = await caller.auth.me()

    expect(result).toBeNull()
  })
})
