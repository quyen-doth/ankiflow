import { z } from 'zod'
import { NextResponse } from 'next/server'
import { formFieldConfigSchema } from '@/lib/contentTypes'
import { apiError } from './api-response'

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
