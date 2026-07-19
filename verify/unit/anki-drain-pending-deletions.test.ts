import { beforeEach, describe, expect, it, vi } from 'vitest'
import { drainPendingAnkiDeletions } from '@/lib/flashcard-service/client-ops'
import type { IFlashcardService } from '@/lib/flashcard-service/types'
import type { DocSeed } from '@/verify/core/types'

const firestoreHarness = globalThis as unknown as {
  __verifyFirestoreSeed: (data: Record<string, DocSeed[]>) => void
  __verifyFirestoreReset: () => void
  __verifyFirestoreStore: () => Map<string, DocSeed[]>
}

function makeClient(deleteNotes = vi.fn(async () => {})): IFlashcardService {
  return { deleteNotes } as unknown as IFlashcardService
}

beforeEach(() => {
  firestoreHarness.__verifyFirestoreReset()
})

describe('drainPendingAnkiDeletions', () => {
  it('settings document または queue がない場合は何もしない', async () => {
    const client = makeClient()

    expect(await drainPendingAnkiDeletions(client, 'missing-user')).toBe(0)
    expect(client.deleteNotes).not.toHaveBeenCalled()

    firestoreHarness.__verifyFirestoreSeed({ settings: [{ id: 'user-1' }] })
    expect(await drainPendingAnkiDeletions(client, 'user-1')).toBe(0)
    expect(client.deleteNotes).not.toHaveBeenCalled()
  })

  it('有効な ID を Anki から削除し、arrayRemove で queue から同じ ID だけを除く', async () => {
    firestoreHarness.__verifyFirestoreSeed({
      settings: [{
        id: 'user-1',
        pending_anki_note_deletions: [11, 'invalid', 12, 0, 11],
      }],
    })
    const client = makeClient()

    const drained = await drainPendingAnkiDeletions(client, 'user-1')

    expect(drained).toBe(2)
    expect(client.deleteNotes).toHaveBeenCalledWith([11, 12])
    const settings = firestoreHarness.__verifyFirestoreStore().get('settings')?.[0]
    expect(settings?.pending_anki_note_deletions).toEqual(['invalid', 0])
  })

  it('AnkiConnect が失敗した場合は 0 を返して queue を保持する', async () => {
    firestoreHarness.__verifyFirestoreSeed({
      settings: [{ id: 'user-1', pending_anki_note_deletions: [21, 22] }],
    })
    const client = makeClient(vi.fn(async () => { throw new Error('Anki offline') }))

    await expect(drainPendingAnkiDeletions(client, 'user-1')).resolves.toBe(0)
    expect(
      firestoreHarness.__verifyFirestoreStore().get('settings')?.[0]
        ?.pending_anki_note_deletions,
    ).toEqual([21, 22])
  })
})
