'use client'

import { useState, useEffect, useMemo } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Select, FieldWrapper } from '@/components/ui/FormField'
import { ClearSelectButton } from '@/components/create/ClearSelectButton'
import { DB_FORM_TYPE_TO_UI } from '@/lib/constants'
import { verifyAttrs } from '@/verify/core/contract'
import type { DeckConfig, FormType, LanguageType } from '@/types'

type UIFormType = 'Language' | 'IT' | 'General'

interface DeckSelectorProps {
  value: string
  /** onChangeFull: nhận cả deckId + formType (dùng trong page cần auto-detect form) */
  onChange?: (deckId: string, formType: UIFormType) => void
  /** onChangeId: chỉ nhận deckId (dùng trong form đã biết formType) */
  onChangeId?: (deckId: string) => void
  onClear?: () => void
  label?: string
  filterFormType?: FormType
  filterLanguage?: LanguageType
}

export function DeckSelector({ value, onChange, onChangeId, onClear, label = 'Anki Deck', filterFormType, filterLanguage }: DeckSelectorProps) {
  const [decks, setDecks] = useState<Pick<DeckConfig, 'id' | 'display_name' | 'form_type' | 'language' | 'sort_order'>[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchDecks() {
      try {
        const q = query(collection(db, 'decks'), where('is_active', '==', true))
        const snapshot = await getDocs(q)
        const data = snapshot.docs
          .map(doc => ({ id: doc.id, ...(doc.data() as Pick<DeckConfig, 'display_name' | 'form_type' | 'language' | 'sort_order'>) }))
          .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        setDecks(data)
      } catch (error) {
        console.error("Error fetching decks", error)
      } finally {
        setLoading(false)
      }
    }
    fetchDecks()
  }, [])

  const filteredDecks = useMemo(() => {
    let result = decks
    if (filterFormType) {
      result = result.filter(d => d.form_type === filterFormType)
    }
    if (filterLanguage) {
      result = result.filter(d => !d.language || d.language === filterLanguage)
    }
    return result
  }, [decks, filterFormType, filterLanguage])

  return (
    <FieldWrapper
      label={label}
      className="text-overline uppercase text-slate-600 tracking-wider font-bold"
      {...verifyAttrs({ unit: 'DeckSelector', count: filteredDecks.length, loading })}
    >
      <div className="relative">
        <Select
          aria-label={label}
          value={value}
          onChange={(e) => {
            const selectedDeck = filteredDecks.find(d => d.id === e.target.value)
            if (selectedDeck) {
              const uiFormType = DB_FORM_TYPE_TO_UI[selectedDeck.form_type]
              onChange?.(selectedDeck.id, uiFormType)
              onChangeId?.(selectedDeck.id)
            }
          }}
          disabled={loading}
          className="w-full bg-surface hover:bg-canvas transition-colors border border-transparent rounded-lg px-4 py-3 text-sm text-ink focus-visible:ring-2 focus-visible:ring-primary-bg cursor-pointer appearance-none"
        >
          <option value="" disabled>{loading ? 'Loading...' : 'Select a deck...'}</option>
          {filteredDecks.map(deck => (
            <option key={deck.id} value={deck.id}>{deck.display_name}</option>
          ))}
        </Select>
        <ClearSelectButton show={!!value && !!onClear} onClear={onClear} label="Xóa deck đã chọn" />
      </div>
    </FieldWrapper>
  )
}