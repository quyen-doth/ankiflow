'use client'

import { useState, useEffect } from 'react'
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { loadPendingBatch, clearPendingBatch } from '@/lib/pendingBatch'
import type { Entry, CardTypeConfig } from '@/types'

type CardTypeItem = Pick<CardTypeConfig, 'id' | 'name' | 'description' | 'code' | 'template'>

interface PreviewBatchState {
  entries: Partial<Entry>[]
  setEntries: React.Dispatch<React.SetStateAction<Partial<Entry>[]>>
  cardTypes: CardTypeItem[]
  selectedCardTypeIds: string[]
  setSelectedCardTypeIds: React.Dispatch<React.SetStateAction<string[]>>
  selectedDeckId: string
  setSelectedDeckId: React.Dispatch<React.SetStateAction<string>>
  isLoading: boolean
  error: string | null
}

/**
 * Load batch pending (mảng generatedContent + metadata dùng chung) → mảng entries có thể
 * chỉnh sửa, kèm card_types và deck dùng chung. Soi gương usePreviewEntry nhưng cho nhiều thẻ.
 */
export function usePreviewBatch(): PreviewBatchState {
  const [entries, setEntries] = useState<Partial<Entry>[]>([])
  const [cardTypes, setCardTypes] = useState<CardTypeItem[]>([])
  const [selectedCardTypeIds, setSelectedCardTypeIds] = useState<string[]>([])
  const [selectedDeckId, setSelectedDeckId] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      setIsLoading(true)
      setError(null)

      const pending = loadPendingBatch()

      if (!pending || pending.items.length === 0) {
        setError('No batch data found. Please go back to Create and generate again.')
        setIsLoading(false)
        return
      }

      // Resolve tên Anki deck dùng chung 1 lần.
      let ankiDeckName = pending.deckId || ''
      if (pending.deckId) {
        try {
          const deckSnap = await getDoc(doc(db, 'decks', pending.deckId))
          if (deckSnap.exists()) {
            ankiDeckName = (deckSnap.data() as Record<string, string>).anki_deck_name || pending.deckId
          }
        } catch (e) {
          console.error('Error fetching deck:', e)
        }
      }
      setSelectedDeckId(pending.deckId || '')

      const mapped: Partial<Entry>[] = pending.items.map((content) => ({
        form_type: pending.formType,
        language: pending.language ?? undefined,
        anki_deck: ankiDeckName,
        category_id: pending.categoryId || null,
        card_type_ids: pending.cardTypeIds,
        tags: pending.tags,
        ...(content as Partial<Entry>),
        word_type:
          ((content as Record<string, unknown>).word_type as string) ||
          ((content as Record<string, unknown>).word_type_vi as string) ||
          '',
      }))
      setEntries(mapped)

      try {
        const q = query(
          collection(db, 'card_types'),
          where('form_type', '==', pending.formType),
        )
        const snapshot = await getDocs(q)

        type FetchedCardType = {
          id: string
          name: string
          description?: string
          sort_order?: number
          is_active?: boolean
          language?: string | null
          template?: CardTypeConfig['template']
        }

        const fetched: FetchedCardType[] = snapshot.docs
          .map(d => ({ id: d.id, ...(d.data() as Omit<FetchedCardType, 'id'>) }))
          .filter(ct => {
            if (ct.is_active === false) return false
            if (!pending.language) return true
            return !ct.language || ct.language === pending.language
          })
          .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))

        setCardTypes(fetched.map(ct => ({
          id: ct.id,
          name: ct.name,
          description: ct.description,
          code: (ct as Record<string, unknown>).code as string || ct.id,
          template: ct.template,
        })))

        const preSelected = pending.cardTypeIds.length > 0
          ? pending.cardTypeIds.filter(id => fetched.some(ct => ct.id === id))
          : fetched.map(ct => ct.id)
        setSelectedCardTypeIds(preSelected)
      } catch (firestoreErr) {
        console.error('Lỗi fetch card_types:', firestoreErr)
      }

      clearPendingBatch()
      setIsLoading(false)
    }

    init()
  }, [])

  return {
    entries,
    setEntries,
    cardTypes,
    selectedCardTypeIds,
    setSelectedCardTypeIds,
    selectedDeckId,
    setSelectedDeckId,
    isLoading,
    error,
  }
}
