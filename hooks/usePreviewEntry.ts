'use client'

import { useState, useEffect } from 'react'
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { loadPendingEntry, clearPendingEntry } from '@/lib/pendingEntry'
import type { Entry, CardTypeConfig } from '@/types'

type CardTypeItem = Pick<CardTypeConfig, 'id' | 'name' | 'description' | 'code'>

interface PreviewEntryState {
  entry: Partial<Entry>
  setEntry: React.Dispatch<React.SetStateAction<Partial<Entry>>>
  cardTypes: CardTypeItem[]
  selectedCardTypeIds: string[]
  setSelectedCardTypeIds: React.Dispatch<React.SetStateAction<string[]>>
  isLoading: boolean
  error: string | null
}

export function usePreviewEntry(): PreviewEntryState {
  const [entry, setEntry] = useState<Partial<Entry>>({})
  const [cardTypes, setCardTypes] = useState<CardTypeItem[]>([])
  const [selectedCardTypeIds, setSelectedCardTypeIds] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      setIsLoading(true)
      setError(null)

      const pending = loadPendingEntry()

      if (!pending) {
        setError('No data found. Please go back to Create and generate again.')
        setIsLoading(false)
        return
      }

      const content = pending.generatedContent as Record<string, unknown>

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

      const mappedEntry: Partial<Entry> = {
        form_type: pending.formType,
        language: pending.language ?? undefined,
        anki_deck: ankiDeckName,
        category_id: pending.categoryId || null,
        card_type_ids: pending.cardTypeIds,
        tags: pending.tags,
        ...(content as Partial<Entry>),
        word_type: (content.word_type as string) || (content.word_type_vi as string) || '',
      }
      setEntry(mappedEntry)

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
        }

        const fetchedCardTypes: FetchedCardType[] = snapshot.docs
          .map(doc => ({ id: doc.id, ...(doc.data() as Omit<FetchedCardType, 'id'>) }))
          .filter(ct => {
            if (ct.is_active === false) return false
            if (!pending.language) return true
            return !ct.language || ct.language === pending.language
          })
          .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))

        setCardTypes(fetchedCardTypes.map(ct => ({
          id: ct.id,
          name: ct.name,
          description: ct.description,
          code: (ct as Record<string, unknown>).code as string || ct.id,
        })))

        const preSelected = pending.cardTypeIds.length > 0
          ? pending.cardTypeIds.filter(id => fetchedCardTypes.some(ct => ct.id === id))
          : fetchedCardTypes.map(ct => ct.id)
        setSelectedCardTypeIds(preSelected)

      } catch (firestoreErr) {
        console.error('Lỗi fetch card_types:', firestoreErr)
      }

      clearPendingEntry()
      setIsLoading(false)
    }

    init()
  }, [])

  return { entry, setEntry, cardTypes, selectedCardTypeIds, setSelectedCardTypeIds, isLoading, error }
}
