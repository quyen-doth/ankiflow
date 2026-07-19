import { FieldValue } from 'firebase-admin/firestore'
import { z } from 'zod'
import { withAuth } from '@/lib/auth-guard'
import { getAdminDb } from '@/lib/firebase-admin'
import { apiError, apiSuccess, catchError } from '@/lib/api-response'

const bulkDeleteSchema = z.object({
  ids: z.array(z.string().trim().min(1)).min(1).max(100),
  anki_cleaned: z.boolean(),
})

export const POST = withAuth(async (request, _context, uid) => {
  const parsed = bulkDeleteSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return apiError('Invalid request body', 400)
  }

  try {
    const db = getAdminDb()
    const ids = [...new Set(parsed.data.ids)]
    const entryRefs = ids.map(id => db.collection('entries').doc(id))
    const snapshots = await Promise.all(entryRefs.map(ref => ref.get()))
    const ownedEntries = snapshots.flatMap((snapshot, index) => {
      const data = snapshot.data()
      return snapshot.exists && data?.user_id === uid
        ? [{ ref: entryRefs[index], data }]
        : []
    })

    const noteIds: number[] = [...new Set(ownedEntries.flatMap(({ data }) => {
      const rawIds: unknown = data.anki_note_ids
      if (!Array.isArray(rawIds)) return []
      return rawIds.filter(
        (value: unknown): value is number => (
          typeof value === 'number' && Number.isSafeInteger(value) && value > 0
        ),
      )
    }))]

    const batch = db.batch()
    ownedEntries.forEach(({ ref }) => batch.delete(ref))

    const shouldQueue = !parsed.data.anki_cleaned && noteIds.length > 0
    if (shouldQueue) {
      batch.set(
        db.collection('settings').doc(uid),
        { pending_anki_note_deletions: FieldValue.arrayUnion(...noteIds) },
        { merge: true },
      )
    }

    if (ownedEntries.length > 0) await batch.commit()

    return apiSuccess({
      deleted: ownedEntries.length,
      skipped: ids.length - ownedEntries.length,
      queued_note_count: shouldQueue ? noteIds.length : 0,
    })
  } catch (error) {
    return catchError(error)
  }
})
