import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, createTestCaller, seedGames } from './helpers.js'

afterEach(async () => {
  await cleanup()
})

describe('game.list', () => {
  it('returns all seeded games', async () => {
    await seedGames()
    const { caller } = await createTestCaller()
    const games = await caller.game.list({})
    expect(games.length).toBeGreaterThan(0)
  })

  it('filters by game type', async () => {
    await seedGames()
    const { caller } = await createTestCaller()
    const ttrpgs = await caller.game.list({ type: 'ttrpg' })
    expect(ttrpgs.length).toBeGreaterThan(0)
    expect(ttrpgs.every((g) => g.type === 'ttrpg')).toBe(true)
  })
})

describe('game.getById', () => {
  it('returns a game by id', async () => {
    await seedGames()
    const { caller } = await createTestCaller()
    const games = await caller.game.list({})
    const game = await caller.game.getById({ id: games[0].id })
    expect(game.name).toBe(games[0].name)
  })

  it('throws NOT_FOUND for invalid id', async () => {
    const { caller } = await createTestCaller()
    await expect(
      caller.game.getById({ id: '00000000-0000-0000-0000-000000000000' }),
    ).rejects.toThrow(
      expect.objectContaining({ code: 'NOT_FOUND' }),
    )
  })
})
