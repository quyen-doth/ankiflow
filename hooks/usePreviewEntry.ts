'use client'

import { useState, useEffect } from 'react'
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/components/providers/AuthProvider'
import { loadPendingEntry, clearPendingEntry } from '@/lib/pendingEntry'
import { findEntryContentType } from '@/lib/entryCustomFields'
import { loadUserContentTypes } from '@/lib/userContentTypes'
import type { PendingEntry } from '@/lib/pendingEntry'
import { FormType } from '@/types'
import type { Entry, CardTypeConfig, UserContentType } from '@/types'

type CardTypeItem = Pick<CardTypeConfig, 'id' | 'name' | 'description' | 'code' | 'template'>

interface PreviewEntryState {
  entry: Partial<Entry>
  setEntry: React.Dispatch<React.SetStateAction<Partial<Entry>>>
  contentType: UserContentType | null
  cardTypes: CardTypeItem[]
  selectedCardTypeIds: string[]
  setSelectedCardTypeIds: React.Dispatch<React.SetStateAction<string[]>>
  isLoading: boolean
  error: string | null
}

function nonEmptyGeneratedString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

export function mapPendingEntryToPreview(
  pending: PendingEntry,
  ankiDeckName: string,
): Partial<Entry> {
  const content = pending.generatedContent as Record<string, unknown>
  const wordType = nonEmptyGeneratedString(content.word_type)
    ?? nonEmptyGeneratedString(content.word_type_vi)
    ?? ''
  const definition = nonEmptyGeneratedString(content.definition)
    ?? nonEmptyGeneratedString(content.definition_vi)
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
}

export function usePreviewEntry(): PreviewEntryState {
  const { user, loading: authLoading } = useAuth()
  const [entry, setEntry] = useState<Partial<Entry>>({})
  const [cardTypes, setCardTypes] = useState<CardTypeItem[]>([])
  const [contentType, setContentType] = useState<UserContentType | null>(null)
  const [selectedCardTypeIds, setSelectedCardTypeIds] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading || !user) return
    const uid = user.uid
    async function init() {
      setIsLoading(true)
      setError(null)

      const pending = loadPendingEntry()

      if (!pending) {
        setError('No data found. Please go back to Create and generate again.')
        setIsLoading(false)
        return
      }

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

      setEntry(mapPendingEntryToPreview(pending, ankiDeckName))

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
          template: ct.template,
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
  }, [user, authLoading])

  return {
    entry,
    setEntry,
    contentType,
    cardTypes,
    selectedCardTypeIds,
    setSelectedCardTypeIds,
    isLoading,
    error,
  }
}
