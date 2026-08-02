import type { Firestore } from 'firebase-admin/firestore'
import { describe, expect, it } from 'vitest'
import { fetchCardTypesByIds } from '@/lib/firestore-helpers'

interface FakeCardTypeDocument {
  id: string
  data: Record<string, unknown>
}

function makeFakeDb(documents: FakeCardTypeDocument[]) {
  const store = new Map(documents.map(document => [document.id, document.data]))
  const requestedIds: string[] = []
  let collectionCalls = 0

  const db = {
    collection: (name: string) => {
      collectionCalls += 1
      if (name !== 'card_types') throw new Error(`Unexpected collection: ${name}`)
      return {
        doc: (id: string) => ({
          get: async () => {
            requestedIds.push(id)
            return {
              id,
              exists: store.has(id),
              data: () => store.get(id),
            }
          },
        }),
      }
    },
  } as unknown as Firestore

  return {
    db,
    requestedIds,
    collectionCalls: () => collectionCalls,
  }
}

const DOCUMENTS: FakeCardTypeDocument[] = [
  {
    id: 'ct-mine',
    data: {
      user_id: 'uid-1',
      name: 'Mine',
      code: 'mine',
      template: { front: ['word'], back: ['meaning'] },
    },
  },
  {
    id: 'ct-theirs',
    data: {
      user_id: 'uid-2',
      name: 'Theirs',
      code: 'theirs',
      template: { front: ['word'], back: ['custom:their_secret'] },
    },
  },
  {
    id: 'ct-default',
    data: {
      user_id: '__defaults__',
      name: 'Template default',
      code: 'default',
      template: { front: ['word'], back: ['custom:default_secret'] },
    },
  },
]

describe('fetchCardTypesByIds ownership filter', () => {
  it('呼び出し user が所有する card type を返す', async () => {
    const { db } = makeFakeDb(DOCUMENTS)

    await expect(fetchCardTypesByIds(db, 'uid-1', ['ct-mine'])).resolves.toEqual([
      {
        id: 'ct-mine',
        name: 'Mine',
        code: 'mine',
        template: { front: ['word'], back: ['meaning'] },
      },
    ])
  })

  it('明示的に要求されても別 user の card type を返さない', async () => {
    const { db, requestedIds } = makeFakeDb(DOCUMENTS)

    await expect(fetchCardTypesByIds(db, 'uid-1', ['ct-theirs'])).resolves.toEqual([])
    expect(requestedIds).toEqual(['ct-theirs'])
  })

  it('__defaults__ template を runtime user に返さない', async () => {
    const { db } = makeFakeDb(DOCUMENTS)

    await expect(fetchCardTypesByIds(db, 'uid-1', ['ct-default'])).resolves.toEqual([])
  })

  it('所有・別 user・default・不存在を混在させても所有 document だけを返す', async () => {
    const { db, requestedIds } = makeFakeDb(DOCUMENTS)

    const result = await fetchCardTypesByIds(db, 'uid-1', [
      'ct-mine',
      'ct-theirs',
      'ct-default',
      'ct-missing',
      'ct-mine',
    ])

    expect(result.map(cardType => cardType.id)).toEqual(['ct-mine'])
    expect(requestedIds).toEqual(['ct-mine', 'ct-theirs', 'ct-default', 'ct-missing'])
  })

  it('空配列では Firestore を呼ばない', async () => {
    const { db, collectionCalls } = makeFakeDb(DOCUMENTS)

    await expect(fetchCardTypesByIds(db, 'uid-1', [])).resolves.toEqual([])
    expect(collectionCalls()).toBe(0)
  })
})
