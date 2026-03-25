import { z } from 'zod'
import { gatheringSchema } from './gathering.js'

export const friendshipStatusSchema = z.enum(['pending', 'accepted', 'declined'])

export const sendFriendRequestSchema = z.object({
  userId: z.string().uuid(),
})

export const friendshipActionSchema = z.object({
  friendshipId: z.string().uuid(),
})

export const friendshipSchema = z.object({
  id: z.string().uuid(),
  requesterId: z.string().uuid(),
  addresseeId: z.string().uuid(),
  status: friendshipStatusSchema,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export const friendSchema = z.object({
  friendshipId: z.string().uuid(),
  friendId: z.string().uuid(),
  displayName: z.string(),
  createdAt: z.coerce.date(),
})

export const incomingRequestSchema = friendshipSchema.extend({
  requesterDisplayName: z.string(),
})

export const outgoingRequestSchema = friendshipSchema.extend({
  addresseeDisplayName: z.string(),
})

export const friendActivityInputSchema = z.object({
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(50).default(20),
})

export const friendActivityGatheringSchema = gatheringSchema.extend({
  friends: z.array(z.object({
    friendId: z.string().uuid(),
    displayName: z.string(),
    role: z.enum(['host', 'participant']),
  })),
})

export const friendActivityOutputSchema = z.object({
  gatherings: z.array(friendActivityGatheringSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
})

export type FriendshipStatus = z.infer<typeof friendshipStatusSchema>
export type SendFriendRequestInput = z.infer<typeof sendFriendRequestSchema>
export type FriendshipActionInput = z.infer<typeof friendshipActionSchema>
export type FriendshipOutput = z.infer<typeof friendshipSchema>
export type FriendOutput = z.infer<typeof friendSchema>
export type FriendActivityInput = z.infer<typeof friendActivityInputSchema>
export type FriendActivityOutput = z.infer<typeof friendActivityOutputSchema>
