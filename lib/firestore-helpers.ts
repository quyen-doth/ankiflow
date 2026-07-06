import type { Firestore } from 'firebase-admin/firestore'
import type { CardTypeItem } from '@/lib/buildNotes'
import type { CardTemplate } from '@/types'

export function withTimestamps<T extends Record<string, unknown>>(
  data: T,
  isNew: boolean
): T & { created_at?: Date; updated_at: Date } {
  const now = new Date()
  return isNew
    ? { ...data, created_at: now, updated_at: now }
    : { ...data, updated_at: now }
}

/**
 * Batch-fetch card_types theo ids (Admin SDK, Promise.all — không Firestore trong loop),
 * map về CardTypeItem (kèm template) cho buildNotes/regenerateEntryNotes.
 * Dùng chung cho các route sync/update/resync — tránh 3 bản copy lệch nhau.
 */
export async function fetchCardTypesByIds(db: Firestore, ids: string[]): Promise<CardTypeItem[]> {
  const unique = [...new Set(ids)]
  if (unique.length === 0) return []
  const snaps = await Promise.all(unique.map((id) => db.collection('card_types').doc(id).get()))
  return snaps
    .filter((s) => s.exists)
    .map((s) => {
      const data = s.data() as { name?: string; code?: string; template?: CardTemplate }
      return { id: s.id, name: data.name || s.id, code: data.code, template: data.template }
    })
}
