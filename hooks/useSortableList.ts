'use client'

import { useCallback } from 'react'
import { Dispatch, SetStateAction } from 'react'
import { writeBatch, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useToast } from '@/components/ui/Toast'

/**
 * `sort_order` を持つ Admin リスト用の再利用 hook: drag-drop 後の新しい順序を受け取り、
 * state へ optimistic 更新してから writeBatch でリスト全体の `sort_order` (1-based) を書き戻す。
 * エラー → toast + refresh() で DB のデータへ巻き戻す。
 */
export function useSortableList<T extends { id: string }>(
  collectionName: string,
  setItems: Dispatch<SetStateAction<T[]>>,
  refresh: () => void,
): (reordered: T[]) => Promise<void> {
  const toast = useToast()

  return useCallback(
    async (reordered: T[]) => {
      // Optimistic: UI を即更新 + state 内の sort_order を同期。
      setItems(reordered.map((item, i) => ({ ...item, sort_order: i + 1 })))

      try {
        const batch = writeBatch(db)
        reordered.forEach((item, i) => {
          batch.update(doc(db, collectionName, item.id), {
            sort_order: i + 1,
            updated_at: serverTimestamp(),
          })
        })
        await batch.commit()
        toast.success('Order updated')
      } catch (error) {
        console.error('Error saving order:', error)
        toast.error('Failed to save order.')
        refresh()
      }
    },
    [collectionName, setItems, refresh, toast],
  )
}
