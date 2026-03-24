import { z } from 'zod'

export const registerInputSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(8),
  displayName: z.string().min(1).max(100).trim(),
})

export const loginInputSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1),
})

export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string(),
  displayName: z.string(),
  createdAt: z.coerce.date(),
})

export type RegisterInput = z.infer<typeof registerInputSchema>
export type LoginInput = z.infer<typeof loginInputSchema>
export type UserOutput = z.infer<typeof userSchema>
