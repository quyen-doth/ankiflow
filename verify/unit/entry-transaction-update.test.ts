import type {
  DocumentData,
  DocumentReference,
  Firestore,
} from 'firebase-admin/firestore'
import { describe, expect, it } from 'vitest'
import { updateOwnedEntryWithQueryMetadata } from '@/lib/entries/updateEntry'

describe('Transactional Entry query metadata update', () => {
  it('transaction retry ごとに最新 snapshot から metadata を再計算する', async () => {
    const snapshots = [
      {
        user_id: 'uid-1',
        word: 'Old word',
        card_type_ids: ['old-card'],
      },
      {
        user_id: 'uid-1',
        word: 'Concurrent word',
        card_type_ids: ['old-card'],
      },
    ]
    const writes: Record<string, unknown>[] = []
    const entryRef = {} as DocumentReference<DocumentData>
    const db = {
      runTransaction: async (
        handler: (transaction: {
          get: () => Promise<{
            exists: boolean
            data: () => Record<string, unknown>
          }>
          update: (
            reference: DocumentReference<DocumentData>,
            data: Record<string, unknown>,
          ) => void
        }) => Promise<boolean>,
      ) => {
        let result = false
        for (const snapshot of snapshots) {
          result = await handler({
            get: async () => ({
              exists: true,
              data: () => ({ ...snapshot }),
            }),
            update: (reference, data) => {
              expect(reference).toBe(entryRef)
              writes.push(data)
            },
          })
        }
        return result
      },
    } as unknown as Firestore

    await expect(updateOwnedEntryWithQueryMetadata(
      db,
      entryRef,
      'uid-1',
      { card_type_ids: ['front', 'back'] },
    )).resolves.toBe(true)

    expect(writes).toHaveLength(2)
    expect(writes[0]).toMatchObject({
      _query_duplicate_key: 'old word',
      _query_card_count: 2,
    })
    expect(writes[1]).toMatchObject({
      _query_duplicate_key: 'concurrent word',
      _query_card_count: 2,
    })
  })

  it('transaction snapshot が他 user の場合は write せず false を返す', async () => {
    let wrote = false
    const entryRef = {} as DocumentReference<DocumentData>
    const db = {
      runTransaction: async (
        handler: (transaction: {
          get: () => Promise<{
            exists: boolean
            data: () => Record<string, unknown>
          }>
          update: () => void
        }) => Promise<boolean>,
      ) => handler({
        get: async () => ({
          exists: true,
          data: () => ({ user_id: 'uid-other', word: 'Hidden' }),
        }),
        update: () => {
          wrote = true
        },
      }),
    } as unknown as Firestore

    await expect(updateOwnedEntryWithQueryMetadata(
      db,
      entryRef,
      'uid-1',
      { word: 'Unsafe' },
    )).resolves.toBe(false)
    expect(wrote).toBe(false)
  })
})
