'use client'

import { useState, useEffect } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Select, FieldWrapper } from '@/components/ui/FormField'
import { DB_FORM_TYPE_TO_UI } from '@/lib/constants'
import type { DeckConfig } from '@/types'

type UIFormType = 'Language' | 'IT' | 'General'

interface DeckSelectorProps {
  value: string
  onChange: (deckId: string, formType: UIFormType) => void
}

export function DeckSelector({ value, onChange }: DeckSelectorProps) {
  const [decks, setDecks] = useState<Pick<DeckConfig, 'id' | 'display_name' | 'form_type' | 'sort_order'>[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchDecks() {
      try {
        const q = query(collection(db, 'decks'), where('is_active', '==', true))
        const snapshot = await getDocs(q)
        const data = snapshot.docs
          .map(doc => ({ id: doc.id, ...(doc.data() as Pick<DeckConfig, 'display_name' | 'form_type' | 'sort_order'>) }))
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

  return (
    <FieldWrapper label="Target Deck">
      <Select
        value={value}
        onChange={(e) => {
          const selectedDeck = decks.find(d => d.id === e.target.value)
          if (selectedDeck) {
            // Dùng DB_FORM_TYPE_TO_UI để chuyển Firestore enum → UI label
            const uiFormType = DB_FORM_TYPE_TO_UI[selectedDeck.form_type]
            onChange(selectedDeck.id, uiFormType)
          }
        }}
        disabled={loading}
      >
        <option value="" disabled>{loading ? 'Loading...' : 'Select a deck...'}</option>
        {decks.map(deck => (
          <option key={deck.id} value={deck.id}>{deck.display_name}</option>
        ))}
      </Select>
    </FieldWrapper>
  )
}
