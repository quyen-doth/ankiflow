'use client'

import { useCallback } from 'react'
import { Dispatch, SetStateAction } from 'react'
import { writeBatch, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useToast } from '@/components/ui/Toast'

/**
 * Hook tái dùng cho danh sách Admin có `sort_order`: nhận thứ tự mới sau khi kéo-thả,
 * cập nhật optimistic vào state rồi ghi lại `sort_order` (1-based) cho cả list bằng writeBatch.
 * Lỗi → toast + refresh() để hoàn tác về dữ liệu DB.
 */
export function useSortableList<T extends { id: string }>(
  collectionName: string,
  setItems: Dispatch<SetStateAction<T[]>>,
  refresh: () => void,
): (reordered: T[]) => Promise<void> {
  const toast = useToast()

  return useCallback(
    async (reordered: T[]) => {
      // Optimistic: cập nhật UI ngay + đồng bộ sort_order trong state.
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
