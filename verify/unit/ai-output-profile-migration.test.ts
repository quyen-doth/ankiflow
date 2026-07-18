import { describe, expect, it } from 'vitest'
import type { Firestore } from 'firebase-admin/firestore'
import {
  buildAiOutputProfileMigrationPlan,
  executeAiOutputProfileMigration,
  fetchAiOutputProfileMigrationDocuments,
  parseAiOutputProfileMigrationArgs,
  type AiOutputProfileMigrationDocument,
} from '@/lib/ai-output-profile-migration'
import { createGenericAiOutputProfiles } from '@/lib/ai-agent/outputProfiles'

function document(
  id: string,
  scope: 'global' | 'user',
  code: string,
  extra: Record<string, unknown> = {},
): AiOutputProfileMigrationDocument {
  return { id, scope, data: { code, ...extra } }
}

describe('AI output profile migration args', () => {
  it('default は read-only dry-run で --apply だけが write mode を有効にする', () => {
    expect(parseAiOutputProfileMigrationArgs([])).toEqual({ apply: false, help: false })
    expect(parseAiOutputProfileMigrationArgs(['--apply'])).toEqual({ apply: true, help: false })
    expect(parseAiOutputProfileMigrationArgs(['-h'])).toEqual({ apply: false, help: true })
    expect(() => parseAiOutputProfileMigrationArgs(['--force'])).toThrow('Unknown argument(s): --force')
  })
})

describe('buildAiOutputProfileMigrationPlan', () => {
  it('global/user built-in missing field だけを候補にし、configured/custom/General を上書きしない', () => {
    const configured = createGenericAiOutputProfiles('term')
    const documents = [
      document('global-language', 'global', 'language'),
      document('user-it', 'user', 'form_it'),
      document('configured', 'user', 'it', { ai_output_profiles: configured }),
      document('empty-customization', 'user', 'language', { ai_output_profiles: [] }),
      document('general', 'global', 'general'),
      document('custom', 'user', 'medical_terms'),
    ]
    const before = JSON.stringify(documents)

    const plan = buildAiOutputProfileMigrationPlan(documents)

    expect(plan).toMatchObject({
      scannedGlobal: 2,
      scannedUser: 4,
      skippedConfigured: 2,
      skippedUnsupported: 2,
    })
    expect(plan.candidates.map(candidate => candidate.path)).toEqual([
      'content_types/global-language',
      'user_content_types/user-it',
    ])
    plan.candidates[0].profiles[0].fields[0].instruction = 'Changed candidate'
    expect(JSON.stringify(documents)).toBe(before)
  })
})

describe('AI output profile migration Firestore operations', () => {
  it('global/user collections を built-in code filter 付きで並列取得する', async () => {
    const reads: Array<{ collection: string; field: string; operator: string; codes: string[] }> = []
    const db = {
      collection: (name: string) => ({
        where: (field: string, operator: string, codes: string[]) => ({
          get: async () => {
            reads.push({ collection: name, field, operator, codes })
            return { docs: [{ id: `${name}-1`, data: () => ({ code: 'language' }) }] }
          },
        }),
      }),
    } as unknown as Firestore

    const documents = await fetchAiOutputProfileMigrationDocuments(db)

    expect(reads.map(read => read.collection).sort()).toEqual(['content_types', 'user_content_types'])
    expect(reads.every(read => read.field === 'code' && read.operator === 'in')).toBe(true)
    expect(reads.every(read => read.codes.join(',') === 'language,form_language,it,form_it')).toBe(true)
    expect(documents.map(item => item.scope).sort()).toEqual(['global', 'user'])
  })

  it('apply 時も transaction で field absence を再確認して concurrent customization を skip する', async () => {
    const plan = buildAiOutputProfileMigrationPlan([
      document('language', 'global', 'language'),
      document('it-user', 'user', 'it'),
    ])
    const stored = new Map<string, Record<string, unknown>>([
      ['content_types/language', { code: 'language' }],
      ['user_content_types/it-user', { code: 'it', ai_output_profiles: [] }],
    ])
    const updates: Array<{ path: string; data: Record<string, unknown> }> = []
    const db = {
      collection: (name: string) => ({
        doc: (id: string) => ({ path: `${name}/${id}` }),
      }),
      runTransaction: async (callback: (transaction: {
        get: (ref: { path: string }) => Promise<{ exists: boolean; data: () => Record<string, unknown> }>
        update: (ref: { path: string }, data: Record<string, unknown>) => void
      }) => Promise<unknown>) => callback({
        get: async ref => ({
          exists: stored.has(ref.path),
          data: () => stored.get(ref.path)!,
        }),
        update: (ref, data) => {
          updates.push({ path: ref.path, data })
          stored.set(ref.path, { ...stored.get(ref.path), ...data })
        },
      }),
    } as unknown as Firestore
    const now = new Date('2026-07-18T00:00:00.000Z')

    const result = await executeAiOutputProfileMigration(db, plan, now)

    expect(result).toEqual({ updated: 1, skippedConfigured: 1, failed: [] })
    expect(updates).toHaveLength(1)
    expect(updates[0]).toMatchObject({
      path: 'content_types/language',
      data: { updated_at: now },
    })
    expect(updates[0].data.ai_output_profiles).toBeDefined()
  })
})
