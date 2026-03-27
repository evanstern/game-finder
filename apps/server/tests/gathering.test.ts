import { afterEach, describe, expect, it } from 'vitest'
import {
  cleanup,
  createAuthenticatedCaller,
  createTestCaller,
  createTestUser,
  seedGames,
} from './helpers.js'

afterEach(async () => {
  await cleanup()
})

const VALID_GATHERING_INPUT = {
  title: 'Friday Game Night',
  zipCode: '90210',
  scheduleType: 'weekly' as const,
  startsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  description: '## Come play games!\n\nBring snacks.',
}

describe('gathering.create', () => {
  it('creates a gathering with games', async () => {
    const user = await createTestUser()
    const games = await seedGames()
    const { caller } = await createAuthenticatedCaller(user.id)

    const result = await caller.gathering.create({
      ...VALID_GATHERING_INPUT,
      gameIds: [games[0].id, games[1].id],
    })

    expect(result.title).toBe('Friday Game Night')
    expect(result.games).toHaveLength(2)
    expect(result.nextOccurrenceAt).not.toBeNull()
  })

  it('rejects unauthenticated request', async () => {
    const games = await seedGames()
    const { caller } = await createTestCaller()

    await expect(
      caller.gathering.create({
        ...VALID_GATHERING_INPUT,
        gameIds: [games[0].id],
      }),
    ).rejects.toThrow(expect.objectContaining({ code: 'UNAUTHORIZED' }))
  })

  it('rejects invalid game IDs', async () => {
    const user = await createTestUser()
    const { caller } = await createAuthenticatedCaller(user.id)

    await expect(
      caller.gathering.create({
        ...VALID_GATHERING_INPUT,
        gameIds: ['00000000-0000-0000-0000-000000000000'],
      }),
    ).rejects.toThrow(expect.objectContaining({ code: 'BAD_REQUEST' }))
  })
})

describe('gathering.update', () => {
  it('updates gathering fields and games', async () => {
    const user = await createTestUser()
    const games = await seedGames()
    const { caller } = await createAuthenticatedCaller(user.id)

    const created = await caller.gathering.create({
      ...VALID_GATHERING_INPUT,
      gameIds: [games[0].id],
    })

    const updated = await caller.gathering.update({
      id: created.id,
      title: 'Saturday Game Night',
      gameIds: [games[1].id, games[2].id],
    })

    expect(updated.title).toBe('Saturday Game Night')
    expect(updated.games).toHaveLength(2)
  })

  it('rejects non-owner', async () => {
    const owner = await createTestUser({ email: 'owner@test.com' })
    const other = await createTestUser({ email: 'other@test.com' })
    const games = await seedGames()
    const { caller: ownerCaller } = await createAuthenticatedCaller(owner.id)

    const created = await ownerCaller.gathering.create({
      ...VALID_GATHERING_INPUT,
      gameIds: [games[0].id],
    })

    const { caller: otherCaller } = await createAuthenticatedCaller(other.id)
    await expect(
      otherCaller.gathering.update({ id: created.id, title: 'Hijacked' }),
    ).rejects.toThrow(expect.objectContaining({ code: 'FORBIDDEN' }))
  })
})

describe('gathering.delete', () => {
  it('deletes gathering and join rows', async () => {
    const user = await createTestUser()
    const games = await seedGames()
    const { caller } = await createAuthenticatedCaller(user.id)

    const created = await caller.gathering.create({
      ...VALID_GATHERING_INPUT,
      gameIds: [games[0].id],
    })

    const result = await caller.gathering.delete({ id: created.id })
    expect(result.success).toBe(true)

    await expect(caller.gathering.getById({ id: created.id })).rejects.toThrow(
      expect.objectContaining({ code: 'NOT_FOUND' }),
    )
  })

  it('rejects non-owner', async () => {
    const owner = await createTestUser({ email: 'owner@test.com' })
    const other = await createTestUser({ email: 'other@test.com' })
    const games = await seedGames()
    const { caller: ownerCaller } = await createAuthenticatedCaller(owner.id)

    const created = await ownerCaller.gathering.create({
      ...VALID_GATHERING_INPUT,
      gameIds: [games[0].id],
    })

    const { caller: otherCaller } = await createAuthenticatedCaller(other.id)
    await expect(
      otherCaller.gathering.delete({ id: created.id }),
    ).rejects.toThrow(expect.objectContaining({ code: 'FORBIDDEN' }))
  })
})

describe('gathering.close', () => {
  it('sets status to closed', async () => {
    const user = await createTestUser()
    const games = await seedGames()
    const { caller } = await createAuthenticatedCaller(user.id)

    const created = await caller.gathering.create({
      ...VALID_GATHERING_INPUT,
      gameIds: [games[0].id],
    })

    const closed = await caller.gathering.close({ id: created.id })
    expect(closed.status).toBe('closed')
  })
})

describe('gathering.getById', () => {
  it('returns gathering with games and host info', async () => {
    const user = await createTestUser({ displayName: 'GameHost' })
    const games = await seedGames()
    const { caller } = await createAuthenticatedCaller(user.id)

    const created = await caller.gathering.create({
      ...VALID_GATHERING_INPUT,
      gameIds: [games[0].id, games[1].id],
    })

    const { caller: publicCaller } = await createTestCaller()
    const detail = await publicCaller.gathering.getById({ id: created.id })

    expect(detail.title).toBe('Friday Game Night')
    expect(detail.host.displayName).toBe('GameHost')
    expect(detail.games).toHaveLength(2)
  })

  it('throws NOT_FOUND for missing gathering', async () => {
    const { caller } = await createTestCaller()
    await expect(
      caller.gathering.getById({ id: '00000000-0000-0000-0000-000000000000' }),
    ).rejects.toThrow(expect.objectContaining({ code: 'NOT_FOUND' }))
  })
})

describe('gathering.listByHost', () => {
  it('returns only the current user gatherings', async () => {
    const user1 = await createTestUser({ email: 'host1@test.com' })
    const user2 = await createTestUser({ email: 'host2@test.com' })
    const games = await seedGames()

    const { caller: caller1 } = await createAuthenticatedCaller(user1.id)
    await caller1.gathering.create({
      ...VALID_GATHERING_INPUT,
      gameIds: [games[0].id],
    })
    await caller1.gathering.create({
      ...VALID_GATHERING_INPUT,
      title: 'Second',
      gameIds: [games[1].id],
    })

    const { caller: caller2 } = await createAuthenticatedCaller(user2.id)
    await caller2.gathering.create({
      ...VALID_GATHERING_INPUT,
      title: 'Other Host',
      gameIds: [games[0].id],
    })

    const list = await caller1.gathering.listByHost()
    expect(list).toHaveLength(2)
    expect(list.every((g) => g.hostId === user1.id)).toBe(true)
  })
})
