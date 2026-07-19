'use client'

import { useState, useEffect, useMemo } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/components/providers/AuthProvider'
import { FieldWrapper } from '@/components/ui/FormField'
import { CreatableSelect } from './CreatableSelect'
import { NewDeckModal } from './NewDeckModal'
import { verifyAttrs } from '@/verify/core/contract'
import type { DeckConfig, FormType, LanguageCode } from '@/types'
import type { CreatedDeck } from '@/lib/create/createDeckCategory'

type DeckRow = Pick<DeckConfig, 'id' | 'display_name' | 'anki_deck_name' | 'form_type' | 'language' | 'sort_order'>

interface DeckCreatableFieldProps {
  value: string
  onChangeId: (deckId: string) => void
  onClear?: () => void
  label?: string
  placeholder?: string
  filterFormType?: FormType | string
  filterLanguage?: LanguageCode
  /** create ページで新規作成する deck に付与する form_type/言語。 */
  createFormType: FormType | string
  createLanguage?: LanguageCode | null
  /** entry に紐付く Anki deck 名 — deckId 未確定時に選択中 deck の表示に使う。 */
  fallbackDeckName?: string
}

/** 検索 + その場で deck 新規作成できる pulldown (popup 経由)。Create ページで使用。 */
export function DeckCreatableField({
  value,
  onChangeId,
  onClear,
  label = 'Anki Deck',
  placeholder = 'Select a deck…',
  filterFormType,
  filterLanguage,
  createFormType,
  createLanguage,
  fallbackDeckName,
}: DeckCreatableFieldProps) {
  const { user, loading: authLoading } = useAuth()
  const [decks, setDecks] = useState<DeckRow[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [pendingName, setPendingName] = useState('')

  useEffect(() => {
    if (authLoading || !user) return
    const uid = user.uid
    async function fetchDecks() {
      try {
        const q = query(collection(db, 'decks'), where('user_id', '==', uid), where('is_active', '==', true))
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
  }, [user, authLoading])

  const filteredDecks = useMemo(() => {
    let result = decks
    if (filterFormType) result = result.filter(d => d.form_type === filterFormType)
    if (filterLanguage) result = result.filter(d => !d.language || d.language === filterLanguage)
    return result
  }, [decks, filterFormType, filterLanguage])

  const options = filteredDecks.map(d => ({ id: d.id, label: d.display_name }))

  // 選択中 deck の表示: value (deckId) を優先; id が無ければ Anki deck 名から resolve。
  const effectiveValue = useMemo(() => {
    if (value) return value
    if (fallbackDeckName) return decks.find(d => d.anki_deck_name === fallbackDeckName)?.id ?? ''
    return ''
  }, [value, fallbackDeckName, decks])

  const handleDeckCreated = (deck: CreatedDeck) => {
    setDecks(prev => [
      ...prev,
      { id: deck.id, display_name: deck.display_name, anki_deck_name: deck.anki_deck_name, form_type: createFormType as FormType, language: createLanguage ?? null, sort_order: 999 },
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
        value={effectiveValue}
        onChange={onChangeId}
        onClear={onClear}
        onCreate={(q) => { setPendingName(q); setModalOpen(true) }}
        placeholder={placeholder}
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
