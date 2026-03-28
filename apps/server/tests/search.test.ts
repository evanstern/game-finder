import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  cleanup,
  createTestCaller,
  createTestGathering,
  createTestUser,
  db,
  seedGames,
  seedZipCodes,
} from './helpers.js'

let caller: Awaited<ReturnType<typeof createTestCaller>>['caller']

beforeEach(async () => {
  const result = await createTestCaller()
  caller = result.caller
  await seedZipCodes()
})

afterEach(async () => {
  await cleanup()
})

afterAll(async () => {
  await db.destroy()
})

describe('gathering.search', () => {
  it('returns gatherings within the search radius sorted by distance', async () => {
    const user = await createTestUser()
    const games = await seedGames()

    // Create gatherings at different ZIPs
    await createTestGathering(user.id, [games[0].id], {
      title: 'Near Gathering',
      zipCode: '10002', // ~2 miles from 10001
    })
    await createTestGathering(user.id, [games[0].id], {
      title: 'Far Gathering',
      zipCode: '60601', // Chicago, ~700 miles
    })

    const result = await caller.gathering.search({
      location: { type: 'zip', zipCode: '10001' },
      radius: 25,
    })

    expect(result.gatherings).toHaveLength(1)
    expect(result.gatherings[0].title).toBe('Near Gathering')
    expect(result.gatherings[0].distanceMiles).toBeGreaterThan(0)
    expect(result.gatherings[0].distanceMiles).toBeLessThan(25)
    expect(result.searchLocation.city).toBe('New York')
    expect(result.searchLocation.state).toBe('NY')
  })

  it('returns distance in miles for each result', async () => {
    const user = await createTestUser()
    const games = await seedGames()

    await createTestGathering(user.id, [games[0].id], {
      title: 'Brooklyn Gathering',
      zipCode: '11201', // ~4 miles from 10001
    })

    const result = await caller.gathering.search({
      location: { type: 'zip', zipCode: '10001' },
      radius: 25,
    })

    expect(result.gatherings).toHaveLength(1)
    expect(result.gatherings[0].distanceMiles).toBeGreaterThan(2)
    expect(result.gatherings[0].distanceMiles).toBeLessThan(10)
  })

  it('filters by keyword matching gathering title', async () => {
    const user = await createTestUser()
    const games = await seedGames()

    await createTestGathering(user.id, [games[0].id], {
      title: 'Friday Board Game Night',
      zipCode: '10001',
    })
    await createTestGathering(user.id, [games[1].id], {
      title: 'Saturday D&D Session',
      zipCode: '10002',
    })

    const result = await caller.gathering.search({
      location: { type: 'zip', zipCode: '10001' },
      radius: 25,
      query: 'Board Game',
    })

    expect(result.gatherings).toHaveLength(1)
    expect(result.gatherings[0].title).toBe('Friday Board Game Night')
  })

  it('filters by keyword matching linked game name', async () => {
    const user = await createTestUser()
    const games = await seedGames()

    await createTestGathering(user.id, [games[0].id], {
      title: 'Friday Night',
      zipCode: '10001',
    }) // linked to Catan
    await createTestGathering(user.id, [games[1].id], {
      title: 'Saturday Night',
      zipCode: '10002',
    }) // linked to D&D

    const result = await caller.gathering.search({
      location: { type: 'zip', zipCode: '10001' },
      radius: 25,
      query: 'Catan',
    })

    expect(result.gatherings).toHaveLength(1)
    expect(result.gatherings[0].title).toBe('Friday Night')
  })

  it('filters by game type', async () => {
    const user = await createTestUser()
    const games = await seedGames()

    await createTestGathering(user.id, [games[0].id], {
      title: 'Board Game Night',
      zipCode: '10001',
    }) // board_game
    await createTestGathering(user.id, [games[1].id], {
      title: 'D&D Night',
      zipCode: '10002',
    }) // ttrpg

    const result = await caller.gathering.search({
      location: { type: 'zip', zipCode: '10001' },
      radius: 25,
      gameTypes: ['ttrpg'],
    })

    expect(result.gatherings).toHaveLength(1)
    expect(result.gatherings[0].title).toBe('D&D Night')
  })

  it('combines keyword and game type filters', async () => {
    const user = await createTestUser()
    const games = await seedGames()

    await createTestGathering(user.id, [games[0].id], {
      title: 'Catan Night',
      zipCode: '10001',
    })
    await createTestGathering(user.id, [games[1].id], {
      title: 'D&D Night',
      zipCode: '10002',
    })
    await createTestGathering(user.id, [games[2].id], {
      title: 'Magic Night',
      zipCode: '10001',
    })

    const result = await caller.gathering.search({
      location: { type: 'zip', zipCode: '10001' },
      radius: 25,
      query: 'Night',
      gameTypes: ['board_game'],
    })

    expect(result.gatherings).toHaveLength(1)
    expect(result.gatherings[0].title).toBe('Catan Night')
  })

  it('paginates results correctly', async () => {
    const user = await createTestUser()
    const games = await seedGames()

    // Create 3 gatherings
    await createTestGathering(user.id, [games[0].id], {
      title: 'G1',
      zipCode: '10001',
    })
    await createTestGathering(user.id, [games[0].id], {
      title: 'G2',
      zipCode: '10001',
    })
    await createTestGathering(user.id, [games[0].id], {
      title: 'G3',
      zipCode: '10002',
    })

    const page1 = await caller.gathering.search({
      location: { type: 'zip', zipCode: '10001' },
      radius: 25,
      pageSize: 2,
      page: 1,
    })

    expect(page1.gatherings).toHaveLength(2)
    expect(page1.total).toBe(3)
    expect(page1.page).toBe(1)
    expect(page1.pageSize).toBe(2)

    const page2 = await caller.gathering.search({
      location: { type: 'zip', zipCode: '10001' },
      radius: 25,
      pageSize: 2,
      page: 2,
    })

    expect(page2.gatherings).toHaveLength(1)
    expect(page2.total).toBe(3)
    expect(page2.page).toBe(2)
  })

  it('returns empty results when no gatherings match', async () => {
    const result = await caller.gathering.search({
      location: { type: 'zip', zipCode: '10001' },
      radius: 5,
    })

    expect(result.gatherings).toHaveLength(0)
    expect(result.total).toBe(0)
  })

  it('excludes closed gatherings', async () => {
    const user = await createTestUser()
    const games = await seedGames()

    await createTestGathering(user.id, [games[0].id], {
      title: 'Active Gathering',
      zipCode: '10001',
      status: 'active',
    })
    await createTestGathering(user.id, [games[0].id], {
      title: 'Closed Gathering',
      zipCode: '10001',
      status: 'closed',
    })

    const result = await caller.gathering.search({
      location: { type: 'zip', zipCode: '10001' },
      radius: 25,
    })

    expect(result.gatherings).toHaveLength(1)
    expect(result.gatherings[0].title).toBe('Active Gathering')
  })

  it('excludes gatherings with null next_occurrence_at', async () => {
    const user = await createTestUser()
    const games = await seedGames()

    await createTestGathering(user.id, [games[0].id], {
      title: 'Upcoming Gathering',
      zipCode: '10001',
      nextOccurrenceAt: new Date(Date.now() + 86400000),
    })
    await createTestGathering(user.id, [games[0].id], {
      title: 'Past Gathering',
      zipCode: '10001',
      nextOccurrenceAt: null,
    })

    const result = await caller.gathering.search({
      location: { type: 'zip', zipCode: '10001' },
      radius: 25,
    })

    expect(result.gatherings).toHaveLength(1)
    expect(result.gatherings[0].title).toBe('Upcoming Gathering')
  })

  it('throws BAD_REQUEST for an invalid ZIP code', async () => {
    await expect(
      caller.gathering.search({
        location: { type: 'zip', zipCode: '00000' },
        radius: 25,
      }),
    ).rejects.toThrow('Invalid ZIP code')
  })

  it('sorts by next_session when requested', async () => {
    const user = await createTestUser()
    const games = await seedGames()

    const soon = new Date()
    soon.setDate(soon.getDate() + 1)
    const later = new Date()
    later.setDate(later.getDate() + 10)

    await createTestGathering(user.id, [games[0].id], {
      title: 'Later Gathering',
      zipCode: '10001',
      nextOccurrenceAt: later,
    })
    await createTestGathering(user.id, [games[0].id], {
      title: 'Sooner Gathering',
      zipCode: '10002',
      nextOccurrenceAt: soon,
    })

    const result = await caller.gathering.search({
      location: { type: 'zip', zipCode: '10001' },
      radius: 25,
      sortBy: 'next_session',
    })

    expect(result.gatherings).toHaveLength(2)
    expect(result.gatherings[0].title).toBe('Sooner Gathering')
    expect(result.gatherings[1].title).toBe('Later Gathering')
  })

  it('includes games and host info in results', async () => {
    const user = await createTestUser({ displayName: 'GameHost' })
    const games = await seedGames()

    await createTestGathering(user.id, [games[0].id, games[2].id], {
      title: 'Multi Game Night',
      zipCode: '10001',
    })

    const result = await caller.gathering.search({
      location: { type: 'zip', zipCode: '10001' },
      radius: 25,
    })

    expect(result.gatherings).toHaveLength(1)
    expect(result.gatherings[0].hostDisplayName).toBe('GameHost')
    expect(result.gatherings[0].games).toHaveLength(2)
    expect(result.gatherings[0].games.map((g) => g.name).sort()).toEqual(
      ['Catan', 'Magic: The Gathering'].sort(),
    )
    expect(result.gatherings[0].locationLabel).toBe('New York, NY')
  })
})
