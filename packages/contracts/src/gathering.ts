import { z } from 'zod'

export const scheduleTypeSchema = z.enum(['once', 'weekly', 'biweekly', 'monthly'])

export const gatheringStatusSchema = z.enum(['active', 'closed'])

export const createGatheringSchema = z.object({
  title: z.string().min(1).max(255).trim(),
  gameIds: z.array(z.string().uuid()).min(1),
  zipCode: z.string().min(5).max(10),
  scheduleType: scheduleTypeSchema,
  startsAt: z.coerce.date(),
  endDate: z.coerce.date().nullable().optional(),
  durationMinutes: z.number().int().positive().nullable().optional(),
  maxPlayers: z.number().int().positive().nullable().optional(),
  description: z.string().min(1),
})

export const updateGatheringSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(255).trim().optional(),
  gameIds: z.array(z.string().uuid()).min(1).optional(),
  zipCode: z.string().min(5).max(10).optional(),
  scheduleType: scheduleTypeSchema.optional(),
  startsAt: z.coerce.date().optional(),
  endDate: z.coerce.date().nullable().optional(),
  durationMinutes: z.number().int().positive().nullable().optional(),
  maxPlayers: z.number().int().positive().nullable().optional(),
  description: z.string().min(1).optional(),
})

export const gatheringSchema = z.object({
  id: z.string().uuid(),
  hostId: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  zipCode: z.string(),
  scheduleType: scheduleTypeSchema,
  startsAt: z.coerce.date(),
  endDate: z.coerce.date().nullable(),
  durationMinutes: z.number().nullable(),
  maxPlayers: z.number().nullable(),
  status: gatheringStatusSchema,
  nextOccurrenceAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type ScheduleType = z.infer<typeof scheduleTypeSchema>
export type GatheringStatus = z.infer<typeof gatheringStatusSchema>
export type CreateGatheringInput = z.infer<typeof createGatheringSchema>
export type UpdateGatheringInput = z.infer<typeof updateGatheringSchema>
export type GatheringOutput = z.infer<typeof gatheringSchema>
