import { z } from 'zod'

export const gameTypeSchema = z.enum(['board_game', 'ttrpg', 'card_game'])

export const gameSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: gameTypeSchema,
  description: z.string(),
  minPlayers: z.number(),
  maxPlayers: z.number(),
  imageUrl: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type GameType = z.infer<typeof gameTypeSchema>
export type GameOutput = z.infer<typeof gameSchema>
