import { describe, expect, it, vi } from 'vitest'
import type { Firestore } from 'firebase-admin/firestore'
import {
  buildOutputLanguageControlBackfillPlan,
  executeOutputLanguageControlBackfill,
  fetchOutputLanguageControlBackfillDocuments,
  parseOutputLanguageControlBackfillArgs,
  type OutputLanguageControlBackfillDocument,
} from '@/lib/output-language-control-backfill'
import {
  DEFAULT_CONTENT_TYPES,
  type ContentTypeSourceDocument,
} from '@/lib/contentTypes'
import {
  GLOBAL_CONTENT_TYPES_COLLECTION,
  USER_CONTENT_TYPES_COLLECTION,
} from '@/lib/constants'
import type { FormFieldConfig } from '@/types'

const OUTPUT_FIELD: FormFieldConfig = {
  field_key: 'explanation_locale',
  label: 'Explanation language',
  type: 'dropdown',
  is_required: true,
  is_session_persistent: false,
  sort_order: 1,
  data_source: 'output_languages',
  placeholder: null,
}

const CORE_FIELD: FormFieldConfig = {
  field_key: 'prompt',
  label: 'Prompt',
  type: 'text',
  is_required: true,
  is_session_persistent: false,
  sort_order: 1,
  data_source: null,
  placeholder: null,
}

function globalDocument(
  id: string,
  code: string,
  fields: FormFieldConfig[],
): OutputLanguageControlBackfillDocument {
  return { id, data: { code, fields: fields.map(field => ({ ...field })) } }
}

function userDocument(
  id: string,
  sourceContentTypeId: string | null,
  fields: FormFieldConfig[],
): OutputLanguageControlBackfillDocument {
  return {
    id,
    data: {
      user_id: 'user-a',
      ...(sourceContentTypeId ? { source_content_type_id: sourceContentTypeId } : {}),
      fields: fields.map(field => ({ ...field })),
    },
  }
}

function customDefaults(): ContentTypeSourceDocument[] {
  return [{
    id: 'custom-source',
    code: 'custom_learning',
    name: 'Custom',
    description: '',
    icon: 'BookOpen',
    fields: [OUTPUT_FIELD, CORE_FIELD].map(field => ({ ...field })),
    is_active: true,
    sort_order: 1,
    default_create_mode: 'single',
  }]
}

describe('parseOutputLanguageControlBackfillArgs', () => {
  it('default は全 user の dry-run、--uid と --apply は明示指定だけを受け付ける', () => {
    expect(parseOutputLanguageControlBackfillArgs([])).toEqual({ apply: false, help: false })
    expect(parseOutputLanguageControlBackfillArgs(['--uid', 'user-a'])).toEqual({
      apply: false,
      help: false,
      uid: 'user-a',
    })
    expect(parseOutputLanguageControlBackfillArgs(['--uid=user-a', '--apply'])).toEqual({
      apply: true,
      help: false,
      uid: 'user-a',
    })
  })

  it('不明・空・重複 UID 引数を拒否する', () => {
    expect(() => parseOutputLanguageControlBackfillArgs(['--all'])).toThrow('Unknown argument')
    expect(() => parseOutputLanguageControlBackfillArgs(['--uid'])).toThrow('--uid requires')
    expect(() => parseOutputLanguageControlBackfillArgs(['--uid=', '--apply'])).toThrow('--uid requires')
    expect(() => parseOutputLanguageControlBackfillArgs([
      '--uid=user-a',
      '--uid=user-b',
    ])).toThrow('--uid may only')
  })
})

describe('buildOutputLanguageControlBackfillPlan', () => {
  it('Content Type code を hardcode せず source の data_source から user patch を作る', () => {
    const globals = [globalDocument('custom-source', 'custom_learning', [OUTPUT_FIELD, CORE_FIELD])]
    const users = [userDocument('custom-source__user-a', 'custom-source', [CORE_FIELD])]

    const plan = buildOutputLanguageControlBackfillPlan(globals, users, customDefaults())

    expect(plan.candidates).toHaveLength(1)
    expect(plan.candidates[0]).toMatchObject({
      scope: 'user',
      path: `${USER_CONTENT_TYPES_COLLECTION}/custom-source__user-a`,
      sourceContentTypeId: 'custom-source',
      desiredField: {
        field_key: 'explanation_locale',
        data_source: 'output_languages',
      },
    })
    expect(plan.conflicts).toEqual([])
  })

  it('旧 global/user built-in の両方へ default control を merge-only で計画する', () => {
    const source = DEFAULT_CONTENT_TYPES.find(item => item.id === 'form_language')!
    const oldFields = source.fields
      .filter(field => field.data_source !== 'output_languages')
      .map(field => ({ ...field }))
    const globals = [globalDocument(source.id, source.code, oldFields)]
    const users = [userDocument(`${source.id}__user-a`, source.id, oldFields)]

    const plan = buildOutputLanguageControlBackfillPlan(globals, users)

    expect(plan.candidates.map(candidate => candidate.path)).toEqual([
      `${GLOBAL_CONTENT_TYPES_COLLECTION}/${source.id}`,
      `${USER_CONTENT_TYPES_COLLECTION}/${source.id}__user-a`,
    ])
    expect(plan.candidates.every(candidate => (
      candidate.desiredField.data_source === 'output_languages'
    ))).toBe(true)
  })

  it('設定済み control は skip し、入力 document を変更しない', () => {
    const globals = [globalDocument('custom-source', 'custom_learning', [OUTPUT_FIELD, CORE_FIELD])]
    const users = [userDocument('user-ct', 'custom-source', [OUTPUT_FIELD, CORE_FIELD])]
    const before = JSON.stringify({ globals, users })

    const plan = buildOutputLanguageControlBackfillPlan(globals, users, customDefaults())

    expect(plan.candidates).toEqual([])
    expect(plan.skippedConfigured).toBe(2)
    expect(JSON.stringify({ globals, users })).toBe(before)
  })

  it('同じ field key の customization を上書きせず conflict として報告する', () => {
    const collidingField = { ...CORE_FIELD, field_key: OUTPUT_FIELD.field_key }
    const globals = [globalDocument('custom-source', 'custom_learning', [OUTPUT_FIELD, CORE_FIELD])]
    const users = [userDocument('user-ct', 'custom-source', [collidingField])]

    const plan = buildOutputLanguageControlBackfillPlan(globals, users, customDefaults())

    expect(plan.candidates).toEqual([])
    expect(plan.conflicts).toEqual([{
      path: `${USER_CONTENT_TYPES_COLLECTION}/user-ct`,
      reason: 'field key "explanation_locale" already exists without the output_languages data source',
    }])
  })

  it('source link のない custom Content Type と control のない source を変更しない', () => {
    const globals = [globalDocument('no-output', 'plain_custom', [CORE_FIELD])]
    const users = [
      userDocument('unlinked', null, [CORE_FIELD]),
      userDocument('linked-no-output', 'no-output', [CORE_FIELD]),
    ]

    const plan = buildOutputLanguageControlBackfillPlan(globals, users, [])

    expect(plan.candidates).toEqual([])
    expect(plan.skippedUnlinked).toBe(1)
    expect(plan.skippedWithoutSourceControl).toBe(2)
  })
})

describe('fetchOutputLanguageControlBackfillDocuments', () => {
  it('global と UID-filtered user snapshots を並列で 1 query ずつ読む', async () => {
    const getGlobal = vi.fn().mockResolvedValue({ docs: [] })
    const getUser = vi.fn().mockResolvedValue({ docs: [] })
    const where = vi.fn().mockReturnValue({ get: getUser })
    const db = {
      collection: (name: string) => {
        if (name === GLOBAL_CONTENT_TYPES_COLLECTION) return { get: getGlobal }
        expect(name).toBe(USER_CONTENT_TYPES_COLLECTION)
        return { where, get: vi.fn() }
      },
    } as unknown as Firestore

    await expect(fetchOutputLanguageControlBackfillDocuments(db, 'user-a')).resolves.toEqual({
      globalDocuments: [],
      userDocuments: [],
    })
    expect(where).toHaveBeenCalledWith('user_id', '==', 'user-a')
    expect(getGlobal).toHaveBeenCalledOnce()
    expect(getUser).toHaveBeenCalledOnce()
  })
})

describe('executeOutputLanguageControlBackfill', () => {
  it('transaction re-read 後も不足時だけ update し、同時 customization は skip する', async () => {
    const globals = [globalDocument('custom-source', 'custom_learning', [OUTPUT_FIELD, CORE_FIELD])]
    const users = [
      userDocument('user-update', 'custom-source', [CORE_FIELD]),
      userDocument('user-configured', 'custom-source', [CORE_FIELD]),
      userDocument('user-conflict', 'custom-source', [CORE_FIELD]),
    ]
    const plan = buildOutputLanguageControlBackfillPlan(globals, users, customDefaults())
    const currentById = new Map(users.map(document => [document.id, document.data]))
    currentById.set('user-configured', userDocument(
      'user-configured',
      'custom-source',
      [OUTPUT_FIELD, CORE_FIELD],
    ).data)
    currentById.set('user-conflict', userDocument(
      'user-conflict',
      'different-source',
      [CORE_FIELD],
    ).data)
    const updates: Array<{ id: string; update: Record<string, unknown> }> = []
    const db = {
      collection: (name: string) => ({
        doc: (id: string) => ({ id, path: `${name}/${id}` }),
      }),
      runTransaction: async (
        callback: (transaction: {
          get: (ref: { id: string }) => Promise<{
            exists: boolean
            data: () => Record<string, unknown>
          }>
          update: (ref: { id: string }, update: Record<string, unknown>) => void
        }) => Promise<string>,
      ) => callback({
        get: async ref => ({
          exists: true,
          data: () => currentById.get(ref.id)!,
        }),
        update: (ref, update) => updates.push({ id: ref.id, update }),
      }),
    } as unknown as Firestore

    const result = await executeOutputLanguageControlBackfill(
      db,
      plan,
      new Date('2026-07-29T00:00:00.000Z'),
    )

    expect(result).toEqual({
      updated: 1,
      skippedConfigured: 1,
      skippedConflicting: 1,
      failed: [],
    })
    expect(updates).toHaveLength(1)
    expect(updates[0].id).toBe('user-update')
    expect(updates[0].update).toMatchObject({
      updated_at: new Date('2026-07-29T00:00:00.000Z'),
    })
    expect((updates[0].update.fields as FormFieldConfig[])[0]).toMatchObject({
      data_source: 'output_languages',
    })
  })
})
