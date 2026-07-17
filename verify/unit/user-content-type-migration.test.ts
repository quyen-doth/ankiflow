import { describe, expect, it, vi } from 'vitest'
import type { Auth } from 'firebase-admin/auth'
import type { Firestore } from 'firebase-admin/firestore'
import {
  buildUserContentTypeMigrationPlan,
  executeUserContentTypeMigration,
  fetchExistingUserContentTypes,
  fetchGlobalContentTypesForMigration,
  listAllMigrationUserIds,
  parseUserContentTypeMigrationArgs,
  type ExistingUserContentTypeDocument,
} from '@/lib/user-content-type-migration'
import {
  DEFAULT_CONTENT_TYPES,
  userContentTypeId,
  type ContentTypeSourceDocument,
} from '@/lib/contentTypes'
import { USER_CONTENT_TYPES_COLLECTION } from '@/lib/constants'

function sources(): ContentTypeSourceDocument[] {
  return DEFAULT_CONTENT_TYPES.slice(0, 2).map(({ id, ...config }) => ({
    id,
    ...config,
    fields: config.fields.map(field => ({ ...field })),
  }))
}

function existingDocument(
  id: string,
  userId: string,
  code: string,
): ExistingUserContentTypeDocument {
  return { id, data: { user_id: userId, code, name: 'Existing' } }
}

describe('parseUserContentTypeMigrationArgs', () => {
  it('default は dry-run で、--apply だけが write mode を有効化する', () => {
    expect(parseUserContentTypeMigrationArgs([])).toEqual({ apply: false, help: false })
    expect(parseUserContentTypeMigrationArgs(['--apply'])).toEqual({ apply: true, help: false })
    expect(parseUserContentTypeMigrationArgs(['--help'])).toEqual({ apply: false, help: true })
  })

  it('未知の引数を拒否する', () => {
    expect(() => parseUserContentTypeMigrationArgs(['--force'])).toThrow('Unknown argument(s): --force')
  })
})

describe('buildUserContentTypeMigrationPlan', () => {
  it('admin を含む全 user/default の create candidates を deterministic order で作る', () => {
    const inputSources = sources()
    const sortedSourceIds = inputSources.map(source => source.id).sort((left, right) => left.localeCompare(right))
    const plan = buildUserContentTypeMigrationPlan(inputSources, ['user-b', 'admin-uid', 'user-b'], [])

    expect(plan).toMatchObject({
      targetUserCount: 2,
      globalDefaultCount: 2,
      skippedById: 0,
      skippedByCode: 0,
    })
    expect(plan.creates).toHaveLength(4)
    expect(plan.creates.map(candidate => `${candidate.userId}/${candidate.sourceContentTypeId}`)).toEqual([
      `admin-uid/${sortedSourceIds[0]}`,
      `admin-uid/${sortedSourceIds[1]}`,
      `user-b/${sortedSourceIds[0]}`,
      `user-b/${sortedSourceIds[1]}`,
    ])
  })

  it('deterministic ID が存在する default を skip by ID にする', () => {
    const source = sources()[0]
    const existing = [existingDocument(
      userContentTypeId(source.id, 'user-a'),
      'user-a',
      source.code,
    )]

    const plan = buildUserContentTypeMigrationPlan([source], ['user-a'], existing)

    expect(plan.creates).toEqual([])
    expect(plan.skippedById).toBe(1)
    expect(plan.skippedByCode).toBe(0)
  })

  it('別 ID でも workspace に同じ code があれば skip by code にする', () => {
    const source = sources()[0]
    const existing = [existingDocument('custom-document-id', 'user-a', source.code.toUpperCase())]

    const plan = buildUserContentTypeMigrationPlan([source], ['user-a'], existing)

    expect(plan.creates).toEqual([])
    expect(plan.skippedById).toBe(0)
    expect(plan.skippedByCode).toBe(1)
    expect(existing[0].data.name).toBe('Existing')
  })

  it('一度作成した plan の結果を existing として渡すと zero-create になる', () => {
    const inputSources = sources()
    const first = buildUserContentTypeMigrationPlan(inputSources, ['user-a'], [])
    const existing = first.creates.map(candidate => ({ id: candidate.id, data: { ...candidate.data } }))

    const rerun = buildUserContentTypeMigrationPlan(inputSources, ['user-a'], existing)

    expect(rerun.creates).toEqual([])
    expect(rerun.skippedById).toBe(inputSources.length)
  })

  it('global input を mutation せず、create data の fields も独立させる', () => {
    const inputSources = sources()
    const before = JSON.stringify(inputSources)
    const plan = buildUserContentTypeMigrationPlan(inputSources, ['user-a'], [])

    ;(plan.creates[0].data.fields[0] as { label: string }).label = 'Changed candidate'

    expect(JSON.stringify(inputSources)).toBe(before)
  })

  it('同じ global code が複数ある場合も workspace に duplicate を作らない', () => {
    const inputSources = sources()
    inputSources[1].code = inputSources[0].code

    const plan = buildUserContentTypeMigrationPlan(inputSources, ['user-a'], [])

    expect(plan.creates).toHaveLength(1)
    expect(plan.skippedByCode).toBe(1)
  })
})

describe('migration reads', () => {
  it('Firebase Auth users を全 page から取得する', async () => {
    const listUsers = vi
      .fn()
      .mockResolvedValueOnce({ users: [{ uid: 'admin-uid' }], pageToken: 'next-page' })
      .mockResolvedValueOnce({ users: [{ uid: 'user-a' }], pageToken: undefined })
    const auth = { listUsers } as unknown as Auth

    await expect(listAllMigrationUserIds(auth)).resolves.toEqual(['admin-uid', 'user-a'])
    expect(listUsers).toHaveBeenNthCalledWith(1, 1000, undefined)
    expect(listUsers).toHaveBeenNthCalledWith(2, 1000, 'next-page')
  })

  it('user_content_types を 30 UID ごとの IN query で並列取得する', async () => {
    const requests: string[][] = []
    const db = {
      collection: (name: string) => {
        expect(name).toBe(USER_CONTENT_TYPES_COLLECTION)
        return {
          where: (_field: string, _operator: string, ids: string[]) => ({
            get: async () => {
              requests.push(ids)
              return { docs: [] }
            },
          }),
        }
      },
    } as unknown as Firestore
    const userIds = Array.from({ length: 61 }, (_, index) => `user-${index}`)

    await expect(fetchExistingUserContentTypes(db, userIds)).resolves.toEqual([])

    expect(requests.map(chunk => chunk.length).sort((a, b) => a - b)).toEqual([1, 30, 30])
  })

  it('不正な global default は document path 付きで拒否する', async () => {
    const db = {
      collection: () => ({
        get: async () => ({
          docs: [{ id: 'broken-default', data: () => ({ legacy_field: true }) }],
        }),
      }),
    } as unknown as Firestore

    await expect(fetchGlobalContentTypesForMigration(db))
      .rejects.toThrow('Invalid content_types/broken-default (fields: legacy_field)')
  })
})

describe('executeUserContentTypeMigration', () => {
  it('create-only で継続し、競合は skip、他の failure は path/code を報告する', async () => {
    const plan = buildUserContentTypeMigrationPlan(sources().slice(0, 1), ['user-a', 'user-b', 'user-c'], [])
    const existingPath = `${USER_CONTENT_TYPES_COLLECTION}/${plan.creates[1].id}`
    const failedPath = `${USER_CONTENT_TYPES_COLLECTION}/${plan.creates[2].id}`
    const writes: Array<{ path: string; data: Record<string, unknown> }> = []
    // 実 BulkWriter を再現: 成功 create() は close()/flush まで解決しない。
    // 旧実装 (await create → finally close) だとここで deadlock しテストが timeout する。
    const pendingFlushes: Array<() => void> = []
    const close = vi.fn().mockImplementation(async () => {
      for (const flush of pendingFlushes) flush()
      pendingFlushes.length = 0
    })
    const db = {
      collection: (collection: string) => ({
        doc: (id: string) => ({ path: `${collection}/${id}` }),
      }),
      bulkWriter: () => ({
        onWriteError: vi.fn(),
        create: (ref: { path: string }, data: Record<string, unknown>) => {
          if (ref.path === existingPath) {
            return Promise.reject(Object.assign(new Error('exists'), { code: 6 }))
          }
          if (ref.path === failedPath) {
            return Promise.reject(Object.assign(new Error('unavailable'), { code: 14 }))
          }
          return new Promise<void>(resolve => {
            pendingFlushes.push(() => {
              writes.push({ path: ref.path, data })
              resolve()
            })
          })
        },
        close,
      }),
    } as unknown as Firestore
    const now = new Date('2026-07-16T00:00:00.000Z')

    const result = await executeUserContentTypeMigration(db, plan, now)

    expect(result).toEqual({
      created: 1,
      skippedExisting: 1,
      failed: [{ path: failedPath, errorCode: 14 }],
    })
    expect(writes).toHaveLength(1)
    expect(writes[0]).toMatchObject({
      data: { user_id: 'user-a', created_at: now, updated_at: now },
    })
    expect(close).toHaveBeenCalledOnce()
  })
})
