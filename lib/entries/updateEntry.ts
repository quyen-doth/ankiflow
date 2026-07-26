import type {
  DocumentData,
  DocumentReference,
  Firestore,
} from 'firebase-admin/firestore'
import { deriveEntryQueryMetadata } from '@/lib/entries/queryMetadata'

/**
 * Entry の ownership 確認、partial update の merge、query metadata の再計算を
 * 同一 transaction 内で行う。Firestore の retry 時も最新 snapshot から再計算される。
 */
export async function updateOwnedEntryWithQueryMetadata(
  db: Firestore,
  entryRef: DocumentReference<DocumentData>,
  uid: string,
  updates: Record<string, unknown>,
): Promise<boolean> {
  return db.runTransaction(async transaction => {
    const snapshot = await transaction.get(entryRef)
    const current = snapshot.data()
    if (!snapshot.exists || current?.user_id !== uid) return false

    const safeUpdates = { ...updates }
    delete safeUpdates.user_id
    const mergedEntry = { ...current, ...safeUpdates }
    transaction.update(entryRef, {
      ...safeUpdates,
      ...deriveEntryQueryMetadata(mergedEntry),
      updated_at: new Date(),
    })
    return true
  })
}
