import { describe, expect, it, vi } from 'vitest'
import {
  backfillTargetUserIds,
  buildAdminDefaultSnapshot,
  buildTemplateSyncPlan,
  buildUserBackfillCandidates,
  buildUserBackfillPlanFromExisting,
  executeTemplateSyncPlan,
  executeUserBackfillPlan,
  listAllAuthUserIds,
  parseSyncAdminDefaultsArgs,
  templateIdFromAdminId,
  type AdminWorkspaceSnapshot,
  type DefaultTemplateSnapshot,
  type TemplateSyncPlan,
} from '@/lib/admin-default-sync'
import type { Firestore } from 'firebase-admin/firestore'
import type { Auth } from 'firebase-admin/auth'
import { DEFAULTS_OWNER_ID } from '@/lib/constants'
import { FormType } from '@/types'

const ADMIN_UID = 'admin-uid'

function emptySnapshot(): AdminWorkspaceSnapshot {
  return { categories: [], card_types: [], topics: [], decks: [] }
}

function validSnapshot(): AdminWorkspaceSnapshot {
  return {
    categories: [
      {
        id: `cat_daily__${ADMIN_UID}`,
        data: {
          user_id: ADMIN_UID,
          name: 'Admin Daily',
          form_type: FormType.GENERAL,
          sort_order: 7,
          is_active: false,
          created_at: 'source-created-at',
          ignored_field: 'must not leak',
        },
      },
    ],
    card_types: [
      {
        id: `ct_primary__${ADMIN_UID}`,
        data: {
          user_id: ADMIN_UID,
          code: 'admin_primary',
          name: 'Admin Primary',
          description: 'Customized description',
          form_type: FormType.GENERAL,
          language: null,
          is_default: true,
          is_active: false,
          sort_order: 3,
          template: { front: ['word'], back: ['meaning'] },
        },
      },
    ],
    topics: [
      {
        id: 'custom-topic-id',
        data: {
          user_id: ADMIN_UID,
          name: 'Custom Topic',
          form_type: FormType.IT,
          is_active: false,
          sort_order: 9,
        },
      },
    ],
    decks: [
      {
        id: `deck_primary__${ADMIN_UID}`,
        data: {
          user_id: ADMIN_UID,
          anki_deck_name: 'Admin::Primary',
          display_name: 'Admin Primary',
          form_type: FormType.GENERAL,
          language: null,
          default_card_type_ids: [`ct_primary__${ADMIN_UID}`],
          default_category_id: `cat_daily__${ADMIN_UID}`,
          is_active: false,
          sort_order: 4,
        },
      },
    ],
  }
}

function cloneTemplateSnapshot(snapshot: DefaultTemplateSnapshot): DefaultTemplateSnapshot {
  return {
    categories: snapshot.categories.map((document) => ({ id: document.id, data: { ...document.data } })),
    card_types: snapshot.card_types.map((document) => ({ id: document.id, data: { ...document.data } })),
    topics: snapshot.topics.map((document) => ({ id: document.id, data: { ...document.data } })),
    decks: snapshot.decks.map((document) => ({ id: document.id, data: { ...document.data } })),
  }
}

function makeFakeBatchDb(existingPaths: string[] = []) {
  const applied: Array<{ action: 'set' | 'create' | 'delete'; path: string; data?: Record<string, unknown> }> = []
  const existing = new Set(existingPaths)
  let commits = 0

  const db = {
    collection: (collection: string) => ({
      doc: (id: string) => ({ path: `${collection}/${id}` }),
    }),
    getAll: async (...refs: Array<{ path: string }>) => refs.map((ref) => ({ exists: existing.has(ref.path), ref })),
    batch: () => {
      const queued: typeof applied = []
      return {
        set: (ref: { path: string }, data: Record<string, unknown>) => {
          queued.push({ action: 'set', path: ref.path, data })
        },
        create: (ref: { path: string }, data: Record<string, unknown>) => {
          queued.push({ action: 'create', path: ref.path, data })
        },
        delete: (ref: { path: string }) => {
          queued.push({ action: 'delete', path: ref.path })
        },
        commit: async () => {
          commits += 1
          applied.push(...queued)
        },
      }
    },
  }

  return {
    db: db as unknown as Firestore,
    applied,
    commitCount: () => commits,
  }
}

describe('templateIdFromAdminId', () => {
  it('admin suffix を除去し、手動作成 ID は保持する', () => {
    expect(templateIdFromAdminId(`cat_daily__${ADMIN_UID}`, ADMIN_UID)).toBe('cat_daily')
    expect(templateIdFromAdminId('random-firestore-id', ADMIN_UID)).toBe('random-firestore-id')
  })

  it('suffix より前が空の場合は拒否する', () => {
    expect(() => templateIdFromAdminId(`__${ADMIN_UID}`, ADMIN_UID)).toThrow('has no base ID')
  })
})

describe('buildAdminDefaultSnapshot', () => {
  it('editable fields を保持し、owner と deck FK を template 用に変換する', () => {
    const result = buildAdminDefaultSnapshot(validSnapshot(), ADMIN_UID)

    expect(result.categories).toEqual([
      {
        id: 'cat_daily',
        data: {
          user_id: DEFAULTS_OWNER_ID,
          name: 'Admin Daily',
          form_type: FormType.GENERAL,
          sort_order: 7,
          is_active: false,
        },
      },
    ])
    expect(result.card_types[0]).toMatchObject({
      id: 'ct_primary',
      data: {
        user_id: DEFAULTS_OWNER_ID,
        description: 'Customized description',
        is_active: false,
        template: { front: ['word'], back: ['meaning'] },
      },
    })
    expect(result.topics[0].id).toBe('custom-topic-id')
    expect(result.decks[0]).toMatchObject({
      id: 'deck_primary',
      data: {
        user_id: DEFAULTS_OWNER_ID,
        default_card_type_ids: ['ct_primary'],
        default_category_id: 'cat_daily',
        is_active: false,
      },
    })
    expect(result.categories[0].data).not.toHaveProperty('created_at')
    expect(result.categories[0].data).not.toHaveProperty('ignored_field')
  })

  it('deck FK が既に template ID の場合も受け入れる', () => {
    const source = validSnapshot()
    source.decks[0].data.default_card_type_ids = ['ct_primary']
    source.decks[0].data.default_category_id = 'cat_daily'

    const result = buildAdminDefaultSnapshot(source, ADMIN_UID)
    expect(result.decks[0].data.default_card_type_ids).toEqual(['ct_primary'])
    expect(result.decks[0].data.default_category_id).toBe('cat_daily')
  })

  it('legacy card type に template がない場合は既知 code の default template を補完する', () => {
    const source = validSnapshot()
    source.card_types[0].data.code = 'front_to_back'
    delete source.card_types[0].data.template

    const result = buildAdminDefaultSnapshot(source, ADMIN_UID)
    expect(result.card_types[0].data.template).toEqual({
      front: ['word'],
      back: ['meaning', 'example', 'translation', 'audio'],
    })
  })

  it('template がなく fallback code も不明な card type は拒否する', () => {
    const source = validSnapshot()
    source.card_types[0].data.code = 'custom_without_template'
    delete source.card_types[0].data.template

    expect(() => buildAdminDefaultSnapshot(source, ADMIN_UID)).toThrow(
      'template is missing and code "custom_without_template" has no fallback',
    )
  })

  it('admin suffix 除去後に ID collision が発生する source を拒否する', () => {
    const source = validSnapshot()
    source.categories.push({
      id: 'cat_daily',
      data: {
        name: 'Duplicate',
        form_type: FormType.LANGUAGE,
        sort_order: 8,
        is_active: true,
      },
    })

    expect(() => buildAdminDefaultSnapshot(source, ADMIN_UID)).toThrow('both map to template ID "cat_daily"')
  })

  it('deck の dangling FK を write 前に拒否する', () => {
    const source = validSnapshot()
    source.decks[0].data.default_card_type_ids = ['missing-card-type']

    expect(() => buildAdminDefaultSnapshot(source, ADMIN_UID)).toThrow(
      'references missing card_types document "missing-card-type"',
    )
  })

  it('schema が不正な source document を collection/id 付きで拒否する', () => {
    const source = validSnapshot()
    source.categories[0].data.name = ''

    expect(() => buildAdminDefaultSnapshot(source, ADMIN_UID)).toThrow(
      `categories/cat_daily__${ADMIN_UID} is invalid`,
    )
  })

  it('workspace 全体が空の場合は empty template 作成を拒否する', () => {
    expect(() => buildAdminDefaultSnapshot(emptySnapshot(), ADMIN_UID)).toThrow('Admin workspace is empty')
  })
})

describe('buildTemplateSyncPlan', () => {
  it('timestamps を無視し、create/update/delete の exact diff を返す', () => {
    const desired = buildAdminDefaultSnapshot(validSnapshot(), ADMIN_UID)
    const current = cloneTemplateSnapshot(desired)
    current.categories[0].data.created_at = 'old-created-at'
    current.categories[0].data.updated_at = 'old-updated-at'
    current.card_types[0].data.name = 'Old card name'
    current.topics = [
      {
        id: 'legacy-topic',
        data: {
          user_id: DEFAULTS_OWNER_ID,
          name: 'Legacy',
          form_type: FormType.IT,
          is_active: true,
          sort_order: 1,
        },
      },
    ]

    const plan = buildTemplateSyncPlan(desired, current)

    expect(plan.creates.map(({ collection, id }) => `${collection}/${id}`)).toEqual(['topics/custom-topic-id'])
    expect(plan.updates.map(({ collection, id }) => `${collection}/${id}`)).toEqual(['card_types/ct_primary'])
    expect(plan.deletes).toEqual([{ collection: 'topics', id: 'legacy-topic' }])
    expect(plan.updates[0].data.name).toBe('Admin Primary')
  })

  it('data が同一なら no-op、予期しない stale field があれば overwrite update', () => {
    const desired = buildAdminDefaultSnapshot(validSnapshot(), ADMIN_UID)
    const current = cloneTemplateSnapshot(desired)

    expect(buildTemplateSyncPlan(desired, current)).toEqual({ creates: [], updates: [], deletes: [] })

    current.decks[0].data.stale_field = true
    expect(buildTemplateSyncPlan(desired, current).updates).toMatchObject([
      { collection: 'decks', id: 'deck_primary' },
    ])
  })
})

describe('parseSyncAdminDefaultsArgs', () => {
  it('default は dry-run、--apply だけが write mode を有効化', () => {
    expect(parseSyncAdminDefaultsArgs([])).toEqual({ apply: false, help: false })
    expect(parseSyncAdminDefaultsArgs(['--apply'])).toEqual({ apply: true, help: false })
    expect(parseSyncAdminDefaultsArgs(['--help'])).toEqual({ apply: false, help: true })
  })

  it('unknown argument を拒否する', () => {
    expect(() => parseSyncAdminDefaultsArgs(['--force'])).toThrow('Unknown argument(s): --force')
  })
})

describe('executeTemplateSyncPlan', () => {
  it('500 writes ごとに batch を分割し、upsert 完了後に delete batch を commit', async () => {
    const fake = makeFakeBatchDb()
    const now = new Date('2026-07-15T10:00:00.000Z')
    const creates = Array.from({ length: 501 }, (_, index) => ({
      collection: 'categories' as const,
      id: `category-${index}`,
      data: { user_id: DEFAULTS_OWNER_ID, name: `Category ${index}` },
    }))
    const plan: TemplateSyncPlan = {
      creates,
      updates: [],
      deletes: [{ collection: 'topics', id: 'legacy-topic' }],
    }

    await executeTemplateSyncPlan(fake.db, plan, now)

    expect(fake.commitCount()).toBe(3)
    expect(fake.applied).toHaveLength(502)
    expect(fake.applied[0]).toMatchObject({
      action: 'set',
      path: 'categories/category-0',
      data: { created_at: now, updated_at: now },
    })
    expect(fake.applied.at(-1)).toEqual({ action: 'delete', path: 'topics/legacy-topic' })
  })
})

describe('existing-user backfill', () => {
  it('admin を除外し、UID を重複排除して deterministic order にする', () => {
    expect(backfillTargetUserIds(['user-b', ADMIN_UID, 'user-a', 'user-b'], ADMIN_UID)).toEqual([
      'user-a',
      'user-b',
    ])
  })

  it('Auth users を全 page から取得する', async () => {
    const listUsers = vi
      .fn()
      .mockResolvedValueOnce({ users: [{ uid: 'user-a' }], pageToken: 'next-page' })
      .mockResolvedValueOnce({ users: [{ uid: 'user-b' }], pageToken: undefined })
    const auth = { listUsers } as unknown as Auth

    await expect(listAllAuthUserIds(auth)).resolves.toEqual(['user-a', 'user-b'])
    expect(listUsers).toHaveBeenNthCalledWith(1, 1000, undefined)
    expect(listUsers).toHaveBeenNthCalledWith(2, 1000, 'next-page')
  })

  it('template ID/owner と deck FK を user-scoped 値へ展開する', () => {
    const templates = buildAdminDefaultSnapshot(validSnapshot(), ADMIN_UID)
    const candidates = buildUserBackfillCandidates(templates, ['user-a'])
    const category = candidates.find((operation) => operation.collection === 'categories')!
    const deck = candidates.find((operation) => operation.collection === 'decks')!

    expect(category).toMatchObject({
      userId: 'user-a',
      id: 'cat_daily__user-a',
      data: { user_id: 'user-a', name: 'Admin Daily' },
    })
    expect(deck).toMatchObject({
      id: 'deck_primary__user-a',
      data: {
        user_id: 'user-a',
        default_card_type_ids: ['ct_primary__user-a'],
        default_category_id: 'cat_daily__user-a',
      },
    })
  })

  it('既存 doc を除外し、missing documents だけを plan に含める', () => {
    const templates = buildAdminDefaultSnapshot(validSnapshot(), ADMIN_UID)
    const existing = emptySnapshot()
    existing.categories.push({
      id: 'cat_daily__user-a',
      data: { user_id: 'user-a', name: 'Customized name', form_type: FormType.GENERAL },
    })

    const plan = buildUserBackfillPlanFromExisting(templates, ['user-a'], existing)

    expect(plan.targetUserCount).toBe(1)
    expect(plan.creates).toHaveLength(3)
    expect(plan.creates.map((operation) => `${operation.collection}/${operation.id}`)).not.toContain(
      'categories/cat_daily__user-a',
    )
  })

  it('logical identity が同じ既存 doc を再利用し、deck FK を既存 ID に remap して duplicate を避ける', () => {
    const templates = buildAdminDefaultSnapshot(validSnapshot(), ADMIN_UID)
    const existing = emptySnapshot()
    existing.categories.push({
      id: 'existing-category-id',
      data: {
        user_id: 'user-a',
        name: 'Admin Daily',
        form_type: FormType.GENERAL,
      },
    })
    existing.card_types.push({
      id: 'existing-card-type-id',
      data: { user_id: 'user-a', code: 'admin_primary' },
    })
    existing.topics.push({
      id: 'existing-topic-id',
      data: { user_id: 'user-a', name: 'Custom Topic', form_type: FormType.IT },
    })

    const plan = buildUserBackfillPlanFromExisting(templates, ['user-a'], existing)

    expect(plan.creates).toHaveLength(1)
    expect(plan.creates[0]).toMatchObject({
      collection: 'decks',
      data: {
        default_card_type_ids: ['existing-card-type-id'],
        default_category_id: 'existing-category-id',
      },
    })

    existing.decks.push({
      id: 'legacy-deck-id',
      data: { user_id: 'user-a', anki_deck_name: 'Admin::Primary' },
    })
    expect(buildUserBackfillPlanFromExisting(templates, ['user-a'], existing).creates).toEqual([])
  })

  it('create-only batch で user data を追加し、set/delete は使わない', async () => {
    const templates = buildAdminDefaultSnapshot(validSnapshot(), ADMIN_UID)
    const creates = buildUserBackfillCandidates(templates, ['user-a'])
    const fake = makeFakeBatchDb()
    const now = new Date('2026-07-15T10:30:00.000Z')

    await executeUserBackfillPlan(fake.db, { targetUserCount: 1, creates }, now)

    expect(fake.commitCount()).toBe(1)
    expect(fake.applied).toHaveLength(4)
    expect(fake.applied.every((operation) => operation.action === 'create')).toBe(true)
    expect(fake.applied[0].data).toMatchObject({ created_at: now, updated_at: now })
  })
})
