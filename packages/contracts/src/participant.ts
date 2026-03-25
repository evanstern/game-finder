import { z } from 'zod'
import { gatheringSchema, participantStatusSchema } from './gathering.js'

export const joinGatheringSchema = z.object({
  gatheringId: z.string().uuid(),
  joinCode: z.string().optional(),
})

export const leaveGatheringSchema = z.object({
  gatheringId: z.string().uuid(),
})

export const listParticipantsSchema = z.object({
  gatheringId: z.string().uuid(),
})

export const participantSchema = z.object({
  id: z.string().uuid(),
  gatheringId: z.string().uuid(),
  userId: z.string().uuid(),
  displayName: z.string(),
  status: participantStatusSchema,
  createdAt: z.coerce.date(),
})

export const joinedGatheringSchema = gatheringSchema.extend({
  participantStatus: participantStatusSchema,
})

export type JoinGatheringInput = z.infer<typeof joinGatheringSchema>
export type LeaveGatheringInput = z.infer<typeof leaveGatheringSchema>
export type ParticipantOutput = z.infer<typeof participantSchema>
export type JoinedGatheringOutput = z.infer<typeof joinedGatheringSchema>
