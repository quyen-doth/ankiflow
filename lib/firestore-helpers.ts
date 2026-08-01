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
 * ids で card_types を batch-fetch (Admin SDK、Promise.all — ループ内で Firestore を呼ばない)、
 * buildNotes/regenerateEntryNotes 用に CardTypeItem (template 付き) にマップする。
 * sync/update/resync ルートで共有 — 3 つのコピーがずれるのを防ぐ。
 * Admin SDK は Firestore Rules をバイパスするため、呼び出し user の document だけを返し、
 * 他 user や __defaults__ の document は存在しない card type と同様に扱う。
 */
export async function fetchCardTypesByIds(db: Firestore, uid: string, ids: string[]): Promise<CardTypeItem[]> {
  const unique = [...new Set(ids)]
  if (unique.length === 0) return []
  const snaps = await Promise.all(unique.map((id) => db.collection('card_types').doc(id).get()))
  return snaps
    .filter((s) => s.exists && s.data()?.user_id === uid)
    .map((s) => {
      const data = s.data() as { name?: string; code?: string; template?: CardTemplate }
      return { id: s.id, name: data.name || s.id, code: data.code, template: data.template }
    })
}
