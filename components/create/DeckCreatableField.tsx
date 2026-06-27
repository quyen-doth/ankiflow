'use client'

import { useState, useEffect, useMemo } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { FieldWrapper } from '@/components/ui/FormField'
import { CreatableSelect } from './CreatableSelect'
import { NewDeckModal } from './NewDeckModal'
import { verifyAttrs } from '@/verify/core/contract'
import type { DeckConfig, FormType, LanguageType } from '@/types'
import type { CreatedDeck } from '@/lib/create/createDeckCategory'

type DeckRow = Pick<DeckConfig, 'id' | 'display_name' | 'form_type' | 'language' | 'sort_order'>

interface DeckCreatableFieldProps {
  value: string
  onChangeId: (deckId: string) => void
  onClear?: () => void
  label?: string
  filterFormType?: FormType
  filterLanguage?: LanguageType
  /** form_type/ngôn ngữ gán cho deck MỚI khi tạo trong trang create. */
  createFormType: FormType | string
  createLanguage?: LanguageType | null
}

/** Pulldown deck có tìm kiếm + tạo deck mới ngay (qua popup). Dùng trong trang Create. */
export function DeckCreatableField({
  value,
  onChangeId,
  onClear,
  label = 'Anki Deck',
  filterFormType,
  filterLanguage,
  createFormType,
  createLanguage,
}: DeckCreatableFieldProps) {
  const [decks, setDecks] = useState<DeckRow[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [pendingName, setPendingName] = useState('')

  useEffect(() => {
    async function fetchDecks() {
      try {
        const q = query(collection(db, 'decks'), where('is_active', '==', true))
        const snapshot = await getDocs(q)
        const data = snapshot.docs
          .map(doc => ({ id: doc.id, ...(doc.data() as Omit<DeckRow, 'id'>) }))
          .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        setDecks(data)
      } catch (error) {
        console.error('Error fetching decks', error)
      } finally {
        setLoading(false)
      }
    }
    fetchDecks()
  }, [])

  const filteredDecks = useMemo(() => {
    let result = decks
    if (filterFormType) result = result.filter(d => d.form_type === filterFormType)
    if (filterLanguage) result = result.filter(d => !d.language || d.language === filterLanguage)
    return result
  }, [decks, filterFormType, filterLanguage])

  const options = filteredDecks.map(d => ({ id: d.id, label: d.display_name }))

  const handleDeckCreated = (deck: CreatedDeck) => {
    setDecks(prev => [
      ...prev,
      { id: deck.id, display_name: deck.display_name, form_type: createFormType as FormType, language: createLanguage ?? null, sort_order: 999 },
    ])
    onChangeId(deck.id)
  }

  return (
    <FieldWrapper
      label={label}
      className="text-overline uppercase text-slate-600 tracking-wider font-bold"
      {...verifyAttrs({ unit: 'DeckCreatableField', count: filteredDecks.length, loading })}
    >
      <CreatableSelect
        ariaLabel={label}
        options={options}
        value={value}
        onChange={onChangeId}
        onClear={onClear}
        onCreate={(q) => { setPendingName(q); setModalOpen(true) }}
        placeholder="Select a deck…"
        createNoun="deck"
        loading={loading}
      />
      <NewDeckModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        defaultDisplayName={pendingName}
        formType={createFormType}
        language={createLanguage}
        onCreated={handleDeckCreated}
      />
    </FieldWrapper>
  )
}
