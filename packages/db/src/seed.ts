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

async function seed() {
  const db = createDb()

  const existing = await db.selectFrom('game').select('id').executeTakeFirst()
  if (existing) {
    console.log('Games already seeded, skipping.')
    await db.destroy()
    return
  }

  await db.insertInto('game').values(GAMES).execute()
  console.log(`Seeded ${GAMES.length} games.`)
  await db.destroy()
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
