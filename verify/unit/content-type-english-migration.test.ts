import { describe, expect, it } from 'vitest'
import type { Firestore } from 'firebase-admin/firestore'
import {
  buildContentTypeEnglishMigrationPlan,
  buildContentTypeEnglishPatch,
  executeContentTypeEnglishMigration,
  fetchContentTypeEnglishMigrationDocuments,
  parseContentTypeEnglishMigrationArgs,
  type ContentTypeEnglishMigrationDocument,
} from '@/lib/content-type-english-migration'
import { DEFAULT_CONTENT_TYPES } from '@/lib/contentTypes'
import { FormType } from '@/types'

function defaultData(formType: FormType): Record<string, unknown> {
  const definition = DEFAULT_CONTENT_TYPES.find(item => item.id === formType)
  if (!definition) throw new Error(`Missing default for ${formType}`)
  return {
    code: definition.code,
    name: definition.name,
    description: definition.description,
    fields: definition.fields.map(field => ({
      ...field,
      ...(field.options ? { options: [...field.options] } : {}),
    })),
  }
}

function legacyData(formType: FormType): Record<string, unknown> {
  const data = defaultData(formType)
  const fields = (data.fields as Array<Record<string, unknown>>).map(field => ({ ...field }))
  const byKey = (key: string) => {
    const field = fields.find(item => item.field_key === key)
    if (!field) throw new Error(`Missing field ${key}`)
    return field
  }

  if (formType === FormType.LANGUAGE) {
    data.name = 'Ngôn ngữ'
    data.description = 'Từ vựng tiếng Anh, Trung, Nhật'
    byKey('language').label = 'Ngôn ngữ'
    byKey('tags').placeholder = 'Thêm tag...'
    Object.assign(byKey('word'), { label: 'Từ vựng', placeholder: 'Nhập từ vựng...' })
    Object.assign(byKey('note'), { label: 'Ghi chú', placeholder: 'Ghi chú cá nhân (optional)' })
    byKey('card_type_ids').label = 'Loại card'
  }
  if (formType === FormType.IT) {
    data.description = 'Thuật ngữ lập trình, công nghệ'
    byKey('topic_ids').label = 'Chủ đề'
    byKey('difficulty').label = 'Độ khó'
    Object.assign(byKey('term'), { label: 'Thuật ngữ', placeholder: 'Ví dụ: REST API, Docker...' })
    Object.assign(byKey('definition'), {
      label: 'Định nghĩa ngắn',
      placeholder: 'Mô tả ngắn gọn bằng tiếng Việt...',
    })
    byKey('keywords').placeholder = 'Thêm keyword liên quan...'
    byKey('card_type_ids').label = 'Loại card'
  }
  if (formType === FormType.GENERAL) {
    data.name = 'Kiến thức chung'
    data.description = 'Bất kỳ nội dung nào khác'
    Object.assign(byKey('title'), { label: 'Tiêu đề / Khái niệm', placeholder: 'Nhập tiêu đề...' })
    Object.assign(byKey('content'), { label: 'Nội dung', placeholder: 'Nội dung chi tiết...' })
    byKey('tags').placeholder = 'Thêm tag...'
  }
  data.fields = fields
  return data
}

function document(
  id: string,
  scope: 'global' | 'user',
  data: Record<string, unknown>,
): ContentTypeEnglishMigrationDocument {
  return { id, scope, data }
}

describe('Content Type English migration args', () => {
  it('default は dry-run で --apply だけが write mode を有効にする', () => {
    expect(parseContentTypeEnglishMigrationArgs([])).toEqual({ apply: false, help: false })
    expect(parseContentTypeEnglishMigrationArgs(['--apply'])).toEqual({ apply: true, help: false })
    expect(parseContentTypeEnglishMigrationArgs(['-h'])).toEqual({ apply: false, help: true })
    expect(() => parseContentTypeEnglishMigrationArgs(['--force']))
      .toThrow('Unknown argument(s): --force')
  })
})

describe('buildContentTypeEnglishPatch', () => {
  it.each([
    [FormType.LANGUAGE, 'Language', 'English, Chinese, and Japanese vocabulary'],
    [FormType.IT, 'IT Vocabulary', 'Programming and technology terms'],
    [FormType.GENERAL, 'General Knowledge', 'Any other content'],
  ])('%s の既知の旧デフォルトだけを英語へ置換する', (formType, name, description) => {
    const input = legacyData(formType)
    const patch = buildContentTypeEnglishPatch(input)

    expect(patch?.formType).toBe(formType)
    expect({ ...input, ...patch?.update }).toMatchObject({ name, description })
    expect(patch?.changes.length).toBeGreaterThan(0)
  })

  it('customized value と custom field を保持し、入力との参照も共有しない', () => {
    const input = legacyData(FormType.LANGUAGE)
    const fields = input.fields as Array<Record<string, unknown>>
    const note = fields.find(field => field.field_key === 'note')!
    note.label = 'Personal context'
    note.options = ['first']
    fields.push({ field_key: 'custom_prompt', label: 'My prompt', options: ['custom'] })
    const before = JSON.stringify(input)

    const patch = buildContentTypeEnglishPatch(input)
    const nextFields = patch?.update.fields as Array<Record<string, unknown>>
    const nextNote = nextFields.find(field => field.field_key === 'note')!
    const nextCustom = nextFields.find(field => field.field_key === 'custom_prompt')!

    expect(nextNote).toMatchObject({
      label: 'Personal context',
      placeholder: 'Personal note (optional)',
    })
    expect(nextCustom).toMatchObject({ label: 'My prompt', options: ['custom'] })
    ;(nextNote.options as string[])[0] = 'changed'
    expect(note.options).toEqual(['first'])
    expect(JSON.stringify(input)).toBe(before)
  })

  it('already-English または arbitrary customization だけの document は patch しない', () => {
    expect(buildContentTypeEnglishPatch(defaultData(FormType.LANGUAGE))).toBeNull()
    expect(buildContentTypeEnglishPatch({
      ...defaultData(FormType.LANGUAGE),
      name: 'My Languages',
    })).toBeNull()
  })
})

describe('buildContentTypeEnglishMigrationPlan', () => {
  it('candidate、already-English、customized、unsupported を分けて deterministic に並べる', () => {
    const customized = defaultData(FormType.GENERAL)
    customized.name = 'My Knowledge'
    const documents = [
      document('user-legacy', 'user', legacyData(FormType.IT)),
      document('global-legacy', 'global', legacyData(FormType.LANGUAGE)),
      document('already-english', 'user', defaultData(FormType.GENERAL)),
      document('customized', 'user', customized),
      document('custom-code', 'user', { code: 'medical_terms' }),
    ]
    const before = JSON.stringify(documents)

    const plan = buildContentTypeEnglishMigrationPlan(documents)

    expect(plan).toMatchObject({
      scannedGlobal: 1,
      scannedUser: 4,
      skippedAlreadyEnglish: 1,
      skippedCustomized: 1,
      skippedUnsupported: 1,
      skippedCustomizedPaths: ['user_content_types/customized'],
      skippedUnsupportedPaths: ['user_content_types/custom-code'],
    })
    expect(plan.candidates.map(candidate => candidate.path)).toEqual([
      'content_types/global-legacy',
      'user_content_types/user-legacy',
    ])
    expect(JSON.stringify(documents)).toBe(before)
  })
})

describe('Content Type English migration Firestore operations', () => {
  it('global/user collection を six built-in aliases の code filter で並列取得する', async () => {
    const reads: Array<{ collection: string; field: string; operator: string; codes: string[] }> = []
    const db = {
      collection: (name: string) => ({
        where: (field: string, operator: string, codes: string[]) => ({
          get: async () => {
            reads.push({ collection: name, field, operator, codes })
            return { docs: [{ id: `${name}-1`, data: () => legacyData(FormType.LANGUAGE) }] }
          },
        }),
      }),
    } as unknown as Firestore

    const documents = await fetchContentTypeEnglishMigrationDocuments(db)

    expect(reads.map(read => read.collection).sort()).toEqual(['content_types', 'user_content_types'])
    expect(reads.every(read => read.field === 'code' && read.operator === 'in')).toBe(true)
    expect(reads.every(read => read.codes.join(',') === (
      'language,form_language,it,form_it,general,form_general'
    ))).toBe(true)
    expect(documents.map(item => item.scope).sort()).toEqual(['global', 'user'])
  })

  it('apply 時に再読込して exact legacy matches だけを更新し、concurrent customization を skip する', async () => {
    const plan = buildContentTypeEnglishMigrationPlan([
      document('language', 'global', legacyData(FormType.LANGUAGE)),
      document('general-user', 'user', legacyData(FormType.GENERAL)),
    ])
    const stored = new Map<string, Record<string, unknown>>([
      ['content_types/language', legacyData(FormType.LANGUAGE)],
      ['user_content_types/general-user', {
        ...defaultData(FormType.GENERAL),
        name: 'My Knowledge',
      }],
    ])
    const updates: Array<{ path: string; data: Record<string, unknown> }> = []
    const db = {
      collection: (name: string) => ({
        doc: (id: string) => ({ path: `${name}/${id}` }),
      }),
      runTransaction: async (callback: (transaction: {
        get: (ref: { path: string }) => Promise<{
          exists: boolean
          data: () => Record<string, unknown>
        }>
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
    const now = new Date('2026-07-19T00:00:00.000Z')

    const result = await executeContentTypeEnglishMigration(db, plan, now)

    expect(result).toEqual({ updated: 1, skippedAfterReread: 1, failed: [] })
    expect(updates).toHaveLength(1)
    expect(updates[0]).toMatchObject({
      path: 'content_types/language',
      data: { name: 'Language', updated_at: now },
    })
    expect(stored.get('user_content_types/general-user')?.name).toBe('My Knowledge')
  })
})
