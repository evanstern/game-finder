import { sql } from 'kysely'
import { createDb } from './client.js'

const GAMES = [
  // Board games
  { name: 'Catan', type: 'board_game' as const, description: 'Trade, build, and settle the island of Catan in this classic strategy game.', min_players: 3, max_players: 4 },
  { name: 'Ticket to Ride', type: 'board_game' as const, description: 'Collect cards and claim railway routes across the map.', min_players: 2, max_players: 5 },
  { name: 'Pandemic', type: 'board_game' as const, description: 'Work together to stop global disease outbreaks before time runs out.', min_players: 2, max_players: 4 },
  { name: 'Civilization', type: 'board_game' as const, description: 'Guide your civilization from ancient times to the modern age.', min_players: 2, max_players: 4 },
  { name: 'Azul', type: 'board_game' as const, description: 'Draft colorful tiles and arrange them on your board for points.', min_players: 2, max_players: 4 },
  { name: 'Wingspan', type: 'board_game' as const, description: 'Attract birds to your wildlife preserves in this engine-building game.', min_players: 1, max_players: 5 },
  { name: 'Terraforming Mars', type: 'board_game' as const, description: 'Compete to transform Mars into a habitable planet.', min_players: 1, max_players: 5 },
  { name: 'Spirit Island', type: 'board_game' as const, description: 'Play as spirits of the land defending your island from colonizers.', min_players: 1, max_players: 4 },
  { name: 'Gloomhaven', type: 'board_game' as const, description: 'A tactical combat game in a persistent world of shifting motives.', min_players: 1, max_players: 4 },
  { name: 'Codenames', type: 'board_game' as const, description: 'Give one-word clues to help your team guess the right words.', min_players: 4, max_players: 8 },
  // TTRPGs
  { name: 'Dungeons & Dragons 5e', type: 'ttrpg' as const, description: 'The world\'s most popular tabletop roleplaying game.', min_players: 3, max_players: 6 },
  { name: 'Pathfinder 2e', type: 'ttrpg' as const, description: 'A rich, deep tabletop RPG with highly customizable characters.', min_players: 3, max_players: 6 },
  { name: 'Call of Cthulhu', type: 'ttrpg' as const, description: 'Investigate cosmic horrors in this Lovecraftian RPG.', min_players: 2, max_players: 6 },
  { name: 'Blades in the Dark', type: 'ttrpg' as const, description: 'Play as scoundrels in a haunted industrial-fantasy city.', min_players: 3, max_players: 5 },
  { name: 'Fate Core', type: 'ttrpg' as const, description: 'A flexible narrative RPG system for any genre.', min_players: 2, max_players: 6 },
  // Card games
  { name: 'Magic: The Gathering', type: 'card_game' as const, description: 'The original collectible card game of strategy and spellcasting.', min_players: 2, max_players: 4 },
  { name: 'Pokemon TCG', type: 'card_game' as const, description: 'Battle with your favorite Pokemon in this trading card game.', min_players: 2, max_players: 2 },
  { name: 'Arkham Horror LCG', type: 'card_game' as const, description: 'A cooperative living card game of Lovecraftian mystery.', min_players: 1, max_players: 4 },
  { name: 'Dominion', type: 'card_game' as const, description: 'The original deck-building game — expand your kingdom card by card.', min_players: 2, max_players: 4 },
  { name: 'Exploding Kittens', type: 'card_game' as const, description: 'A fast-paced card game of strategy, luck, and exploding cats.', min_players: 2, max_players: 5 },
]

const USERS = [
  { id: 'aaaaaaaa-0000-0000-0000-000000000001', email: 'host1@test.com', display_name: 'DungeonMaster42' },
  { id: 'aaaaaaaa-0000-0000-0000-000000000002', email: 'host2@test.com', display_name: 'BoardGameBaron' },
  { id: 'aaaaaaaa-0000-0000-0000-000000000003', email: 'host3@test.com', display_name: 'CardSharkKelly' },
]

const GATHERINGS = [
  { host: 'host1@test.com', title: 'Friday Night Catan', description: 'Friendly Catan night. All skill levels welcome. Snacks provided!', zip_code: '44333', schedule_type: 'weekly' as const, starts_at: '2026-03-27T19:00:00-04:00', duration_minutes: 180, max_players: 4, games: ['Catan'] },
  { host: 'host1@test.com', title: 'D&D Campaign: Curse of Strahd', description: 'Ongoing campaign, currently level 5. Looking for 1 more player to fill a healer role.', zip_code: '44333', schedule_type: 'weekly' as const, starts_at: '2026-03-28T18:00:00-04:00', duration_minutes: 240, max_players: 6, games: ['Dungeons & Dragons 5e'] },
  { host: 'host2@test.com', title: 'Board Game Brunch', description: 'Casual board games over brunch. We rotate games each week — Wingspan, Azul, Ticket to Ride, etc.', zip_code: '44333', schedule_type: 'biweekly' as const, starts_at: '2026-03-29T11:00:00-04:00', duration_minutes: 180, max_players: 8, games: ['Wingspan', 'Azul', 'Ticket to Ride'] },
  { host: 'host2@test.com', title: 'MTG Commander Night', description: 'Bring your Commander decks! We play at the back table of Brewed Awakenings cafe.', zip_code: '44333', schedule_type: 'weekly' as const, starts_at: '2026-03-26T19:30:00-04:00', duration_minutes: 180, max_players: 4, games: ['Magic: The Gathering'] },
  { host: 'host3@test.com', title: 'Gloomhaven Ongoing Campaign', description: 'We are about 20 scenarios in. Committed group, looking for a reliable 4th.', zip_code: '44333', schedule_type: 'weekly' as const, starts_at: '2026-03-29T14:00:00-04:00', duration_minutes: 240, max_players: 4, games: ['Gloomhaven'] },
  { host: 'host1@test.com', title: 'Pathfinder 2e One-Shot', description: 'Running a one-shot adventure for new and experienced players. Pre-gen characters available.', zip_code: '44333', schedule_type: 'once' as const, starts_at: '2026-04-05T13:00:00-04:00', duration_minutes: 300, max_players: 5, games: ['Pathfinder 2e'] },
  { host: 'host3@test.com', title: 'Pokemon TCG League', description: 'Casual Pokemon TCG play and trading. Kids and adults welcome.', zip_code: '44333', schedule_type: 'weekly' as const, starts_at: '2026-03-27T16:00:00-04:00', duration_minutes: 120, max_players: 12, games: ['Pokemon TCG'] },
  { host: 'host2@test.com', title: 'Pandemic Legacy Night', description: 'Starting Season 2 from scratch. Need a committed group of 4.', zip_code: '44333', schedule_type: 'biweekly' as const, starts_at: '2026-04-01T19:00:00-04:00', duration_minutes: 180, max_players: 4, games: ['Pandemic'] },
  { host: 'host1@test.com', title: 'Call of Cthulhu: Horror on the Orient Express', description: 'Longform campaign. We play monthly. Dark themes, mature players only.', zip_code: '44333', schedule_type: 'monthly' as const, starts_at: '2026-04-12T18:00:00-04:00', duration_minutes: 300, max_players: 5, games: ['Call of Cthulhu'] },
  { host: 'host3@test.com', title: 'Exploding Kittens & Party Games', description: 'Light party games — Exploding Kittens, Codenames, etc. Great for newcomers!', zip_code: '44333', schedule_type: 'weekly' as const, starts_at: '2026-03-28T20:00:00-04:00', duration_minutes: 120, max_players: 10, games: ['Exploding Kittens', 'Codenames'] },
  { host: 'host2@test.com', title: 'Spirit Island Co-op', description: 'Experienced Spirit Island players. We try different spirits and adversaries each session.', zip_code: '44333', schedule_type: 'biweekly' as const, starts_at: '2026-04-02T19:00:00-04:00', duration_minutes: 180, max_players: 4, games: ['Spirit Island'] },
  { host: 'host1@test.com', title: 'Terraforming Mars Tournament', description: 'Single-elimination tournament. Entry is free. Prizes for top 3!', zip_code: '44333', schedule_type: 'once' as const, starts_at: '2026-04-19T10:00:00-04:00', duration_minutes: 360, max_players: 16, games: ['Terraforming Mars'] },
]

// Dummy bcrypt hash (password: "password123")
const DUMMY_HASH = '$2a$10$abcdefghijklmnopqrstuuKxYzAbCdEfGhIjKlMnOpQrStUvWxYz'

async function seed() {
  const db = createDb()

  // Seed games
  const existingGame = await db.selectFrom('game').select('id').executeTakeFirst()
  if (existingGame) {
    console.log('Games already seeded, skipping.')
  } else {
    await db.insertInto('game').values(GAMES).execute()
    console.log(`Seeded ${GAMES.length} games.`)
  }

  // Seed test users
  const existingUser = await db.selectFrom('users').select('id').executeTakeFirst()
  if (existingUser) {
    console.log('Users already seeded, skipping.')
  } else {
    await db.insertInto('users')
      .values(USERS.map((u) => ({ ...u, password_hash: DUMMY_HASH })))
      .execute()
    console.log(`Seeded ${USERS.length} test users.`)
  }

  // Seed gatherings
  const existingGathering = await db.selectFrom('gathering').select('id').executeTakeFirst()
  if (existingGathering) {
    console.log('Gatherings already seeded, skipping.')
  } else {
    const users = await db.selectFrom('users').select(['id', 'email']).execute()
    const games = await db.selectFrom('game').select(['id', 'name']).execute()
    const userByEmail = new Map(users.map((u) => [u.email, u.id]))
    const gameByName = new Map(games.map((g) => [g.name, g.id]))

    for (const g of GATHERINGS) {
      const hostId = userByEmail.get(g.host)
      if (!hostId) throw new Error(`Host not found: ${g.host}`)

      const result = await db.insertInto('gathering')
        .values({
          host_id: hostId,
          title: g.title,
          description: g.description,
          zip_code: g.zip_code,
          schedule_type: sql.raw(`'${g.schedule_type}'::schedule_type`),
          starts_at: new Date(g.starts_at),
          duration_minutes: g.duration_minutes,
          max_players: g.max_players,
          status: sql.raw(`'active'::gathering_status`),
          next_occurrence_at: new Date(g.starts_at),
        } as never)
        .returning('id')
        .executeTakeFirstOrThrow()

      const gameLinks = g.games
        .map((name) => gameByName.get(name))
        .filter((id): id is string => !!id)
        .map((gameId) => ({ gathering_id: result.id, game_id: gameId }))

      if (gameLinks.length > 0) {
        await db.insertInto('gathering_game').values(gameLinks).execute()
      }
    }
    console.log(`Seeded ${GATHERINGS.length} gatherings with game links.`)
  }

  await db.destroy()
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
