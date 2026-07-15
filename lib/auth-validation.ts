import { z } from 'zod'

export const emailSchema = z.email('Please enter a valid email address')

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least 1 uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least 1 number')

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
})
