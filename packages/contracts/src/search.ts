import { z } from 'zod'
import { gameTypeSchema } from './game.js'

export const searchGatheringsSchema = z.object({
  zipCode: z.string().regex(/^\d{5}$/, 'Must be a 5-digit ZIP code'),
  radius: z.number().positive(),
  query: z.string().trim().optional(),
  gameTypes: z.array(gameTypeSchema).optional(),
  sortBy: z.enum(['distance', 'next_session']).default('distance'),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(50).default(20),
})

export const searchResultSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  zipCode: z.string(),
  distanceMiles: z.number(),
  scheduleType: z.enum(['once', 'weekly', 'biweekly', 'monthly']),
  startsAt: z.coerce.date(),
  nextOccurrenceAt: z.coerce.date().nullable(),
  maxPlayers: z.number().nullable(),
  status: z.enum(['active', 'closed']),
  hostDisplayName: z.string(),
  games: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      type: gameTypeSchema,
    }),
  ),
  locationLabel: z.string(),
})

export const searchGatheringsOutputSchema = z.object({
  gatherings: z.array(searchResultSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
  searchLocation: z.object({
    city: z.string(),
    state: z.string(),
  }),
})

export type SearchGatheringsInput = z.infer<typeof searchGatheringsSchema>
export type SearchResult = z.infer<typeof searchResultSchema>
export type SearchGatheringsOutput = z.infer<typeof searchGatheringsOutputSchema>
