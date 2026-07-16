import { z } from 'zod'
import { NextResponse } from 'next/server'
import { FormType } from '@/types'
import { formFieldConfigSchema } from '@/lib/contentTypes'
import { apiError } from './api-response'

const formTypeEnum = z.nativeEnum(FormType)

// ─── Card Types ───────────────────────────────────────────────────────────────

export const CardTypePostSchema = z.object({
  name: z.string().min(1, 'name is required'),
  form_type: formTypeEnum,
  description: z.string().optional(),
  sort_order: z.number().int().optional(),
  language: z.string().optional(),
  is_active: z.boolean().optional(),
})

export const CardTypePutSchema = CardTypePostSchema.partial().extend({
  id: z.string().min(1, 'id is required'),
})

// ─── Categories ───────────────────────────────────────────────────────────────

export const CategoryPostSchema = z.object({
  name: z.string().min(1, 'name is required'),
  form_type: formTypeEnum,
  description: z.string().optional(),
  sort_order: z.number().int().optional(),
  is_active: z.boolean().optional(),
})

export const CategoryPutSchema = CategoryPostSchema.partial().extend({
  id: z.string().min(1, 'id is required'),
})

// ─── Decks ────────────────────────────────────────────────────────────────────

export const DeckPostSchema = z.object({
  name: z.string().min(1, 'name is required'),
  form_type: formTypeEnum.optional(),
  description: z.string().optional(),
  sort_order: z.number().int().optional(),
  is_active: z.boolean().optional(),
})

export const DeckPutSchema = DeckPostSchema.partial().extend({
  id: z.string().min(1, 'id is required'),
})

// ─── Topics ───────────────────────────────────────────────────────────────────

export const TopicPostSchema = z.object({
  name: z.string().min(1, 'name is required'),
  description: z.string().optional(),
  is_active: z.boolean().optional(),
})

export const TopicPutSchema = TopicPostSchema.partial().extend({
  id: z.string().min(1, 'id is required'),
})

// ─── Content Types ────────────────────────────────────────────────────────────

export const ContentTypePutSchema = z.object({
  id: z.string().min(1, 'id is required'),
  fields: z.array(formFieldConfigSchema).min(1),
})

// ─── Helper ───────────────────────────────────────────────────────────────────

type ParseOk<T> = { ok: true; data: T }
type ParseFail = { ok: false; response: NextResponse }
type ParseResult<T> = ParseOk<T> | ParseFail

export function parseBody<T>(schema: z.ZodType<T>, body: unknown): ParseResult<T> {
  const result = schema.safeParse(body)
  if (!result.success) {
    const message = result.error.issues
      .map(e => (e.path.length ? `${e.path.join('.')}: ${e.message}` : e.message))
      .join(', ')
    return { ok: false, response: apiError(message, 400) }
  }
  return { ok: true, data: result.data }
}
