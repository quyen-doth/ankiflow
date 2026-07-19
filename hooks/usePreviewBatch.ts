'use client'

import { useState, useEffect } from 'react'
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/components/providers/AuthProvider'
import { loadPendingBatch, clearPendingBatch } from '@/lib/pendingBatch'
import { findEntryContentType } from '@/lib/entryCustomFields'
import { loadUserContentTypes } from '@/lib/userContentTypes'
import type { PendingBatch } from '@/lib/pendingBatch'
import { FormType } from '@/types'
import type { Entry, CardTypeConfig, UserContentType } from '@/types'

type CardTypeItem = Pick<CardTypeConfig, 'id' | 'name' | 'description' | 'code' | 'template'>

interface PreviewBatchState {
  entries: Partial<Entry>[]
  setEntries: React.Dispatch<React.SetStateAction<Partial<Entry>[]>>
  contentType: UserContentType | null
  cardTypes: CardTypeItem[]
  selectedCardTypeIds: string[]
  setSelectedCardTypeIds: React.Dispatch<React.SetStateAction<string[]>>
  selectedDeckId: string
  setSelectedDeckId: React.Dispatch<React.SetStateAction<string>>
  isLoading: boolean
  error: string | null
}

function nonEmptyGeneratedString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

export function mapPendingBatchToPreview(
  pending: PendingBatch,
  ankiDeckName: string,
): Partial<Entry>[] {
  return pending.items.map((content) => {
    const generated = content as Record<string, unknown>
    const wordType = nonEmptyGeneratedString(generated.word_type)
      ?? nonEmptyGeneratedString(generated.word_type_vi)
      ?? ''
    const definition = nonEmptyGeneratedString(generated.definition)
      ?? nonEmptyGeneratedString(generated.definition_vi)
    return {
      ...(content as Partial<Entry>),
      word_type: wordType,
      ...(definition ? { definition } : {}),
      form_type: pending.formType,
      language: pending.language ?? undefined,
      output_language: pending.outputLanguage,
      anki_deck: ankiDeckName,
      category_id: pending.categoryId || null,
      card_type_ids: pending.cardTypeIds,
      tags: pending.tags,
      ...(pending.formType === FormType.IT ? { topic_ids: pending.topicIds ?? [] } : {}),
    }
  })
}

/**
 * Load batch pending (mảng generatedContent + metadata dùng chung) → mảng entries có thể
 * chỉnh sửa, kèm card_types và deck dùng chung. Soi gương usePreviewEntry nhưng cho nhiều thẻ.
 */
export function usePreviewBatch(): PreviewBatchState {
  const { user, loading: authLoading } = useAuth()
  const [entries, setEntries] = useState<Partial<Entry>[]>([])
  const [contentType, setContentType] = useState<UserContentType | null>(null)
  const [cardTypes, setCardTypes] = useState<CardTypeItem[]>([])
  const [selectedCardTypeIds, setSelectedCardTypeIds] = useState<string[]>([])
  const [selectedDeckId, setSelectedDeckId] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading || !user) return
    const uid = user.uid
    async function init() {
      setIsLoading(true)
      setError(null)
      setContentType(null)

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

      setEntries(mapPendingBatchToPreview(pending, ankiDeckName))

      try {
        const q = query(
          collection(db, 'card_types'),
          where('user_id', '==', uid),
          where('form_type', '==', pending.formType),
        )
        const [snapshot, contentTypes] = await Promise.all([
          getDocs(q),
          loadUserContentTypes(uid),
        ])
        setContentType(findEntryContentType(contentTypes, pending.formType) ?? null)

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
  }, [user, authLoading])

  return {
    entries,
    setEntries,
    contentType,
    cardTypes,
    selectedCardTypeIds,
    setSelectedCardTypeIds,
    selectedDeckId,
    setSelectedDeckId,
    isLoading,
    error,
  }
}
