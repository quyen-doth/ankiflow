'use client'

import { useState, useEffect } from 'react'
import {
  collection, query, orderBy, getDocs,
  addDoc, updateDoc, doc, serverTimestamp, deleteField,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Card } from '@/components/ui/Card'
import { DataTable } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input, FieldWrapper, Select } from '@/components/ui/FormField'
import { Plus, Pencil } from 'lucide-react'
import { verifyAttrs } from '@/verify/core/contract'
import { FormType, LanguageType } from '@/types'
import type { DeckConfig } from '@/types'

const FORM_TYPE_LABELS: Record<FormType, string> = {
  [FormType.LANGUAGE]: 'Language',
  [FormType.IT]: 'IT',
  [FormType.GENERAL]: 'General',
}

const LANGUAGE_LABELS: Record<LanguageType, string> = {
  [LanguageType.ENGLISH]: 'English',
  [LanguageType.JAPANESE]: 'Japanese',
  [LanguageType.CHINESE]: 'Chinese',
}

const NO_LANGUAGE = '__none__'

interface DeckDraft {
  anki_deck_name: string
  display_name: string
  form_type: FormType
  language: LanguageType | typeof NO_LANGUAGE
  is_active: boolean
  sort_order: number
}

const EMPTY_DRAFT: DeckDraft = {
  anki_deck_name: '',
  display_name: '',
  form_type: FormType.LANGUAGE,
  language: NO_LANGUAGE,
  is_active: true,
  sort_order: 0,
}

export function DeckManager() {
  const [decks, setDecks] = useState<DeckConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<DeckConfig | null>(null)
  const [draft, setDraft] = useState<DeckDraft>(EMPTY_DRAFT)
  const [saving, setSaving] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    async function fetchDecks() {
      setLoading(true)
      try {
        const q = query(collection(db, 'decks'), orderBy('sort_order', 'asc'))
        const snapshot = await getDocs(q)
        setDecks(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as DeckConfig)))
      } catch (error) {
        console.error('Error fetching decks:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchDecks()
  }, [refreshKey])

  const refresh = () => setRefreshKey(k => k + 1)

  const openCreate = () => {
    setEditing(null)
    setDraft(EMPTY_DRAFT)
    setModalOpen(true)
  }

  const openEdit = (deck: DeckConfig) => {
    setEditing(deck)
    setDraft({
      anki_deck_name: deck.anki_deck_name,
      display_name: deck.display_name,
      form_type: deck.form_type,
      language: deck.language || NO_LANGUAGE,
      is_active: deck.is_active,
      sort_order: deck.sort_order,
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!draft.anki_deck_name.trim() || !draft.display_name.trim()) return
    setSaving(true)
    try {
      if (editing) {
        await updateDoc(doc(db, 'decks', editing.id), {
          anki_deck_name: draft.anki_deck_name,
          display_name: draft.display_name,
          form_type: draft.form_type,
          language: draft.language === NO_LANGUAGE ? deleteField() : draft.language,
          is_active: draft.is_active,
          sort_order: draft.sort_order,
          updated_at: serverTimestamp(),
        })
      } else {
        await addDoc(collection(db, 'decks'), {
          anki_deck_name: draft.anki_deck_name,
          display_name: draft.display_name,
          form_type: draft.form_type,
          ...(draft.language !== NO_LANGUAGE && { language: draft.language }),
          is_active: draft.is_active,
          sort_order: draft.sort_order,
          default_card_type_ids: [],
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        })
      }
      // Sync deck to Anki
      try {
        await fetch('/api/anki/decks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deckName: draft.anki_deck_name }),
        })
      } catch (e) {
        console.error('AnkiConnect sync failed:', e)
      }

      setModalOpen(false)
      refresh()
    } catch (error) {
      console.error('Error saving deck:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (deckConfig: DeckConfig) => {
    try {
      await updateDoc(doc(db, 'decks', deckConfig.id), { is_active: !deckConfig.is_active, updated_at: serverTimestamp() })
      refresh()
    } catch (error) {
      console.error('Error toggling deck status:', error)
    }
  }

  const columns = [
    {
      key: 'anki_deck_name',
      header: 'Anki Name',
      render: (_: unknown, row: DeckConfig) => <span className="font-mono text-label-sm text-on-surface-var">{row.anki_deck_name}</span>,
    },
    {
      key: 'display_name',
      header: 'Display Name',
      render: (_: unknown, row: DeckConfig) => <span className="font-semibold text-on-surface">{row.display_name}</span>,
    },
    {
      key: 'form_type',
      header: 'Form Type',
      render: (_: unknown, row: DeckConfig) => <Badge variant="neutral">{FORM_TYPE_LABELS[row.form_type] ?? row.form_type}</Badge>,
    },
    {
      key: 'language',
      header: 'Language',
      render: (_: unknown, row: DeckConfig) => (
        <span className="text-on-surface-var">{row.language ? (LANGUAGE_LABELS[row.language] ?? row.language) : '—'}</span>
      ),
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (_: unknown, row: DeckConfig) => (
        <button onClick={(e) => { e.stopPropagation(); handleToggleActive(row) }}>
          <Badge variant={row.is_active ? 'active' : 'inactive'}>{row.is_active ? 'Active' : 'Inactive'}</Badge>
        </button>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right' as const,
      render: (_: unknown, row: DeckConfig) => (
        <Button variant="ghost" size="sm" aria-label={`Edit deck ${row.display_name}`} onClick={(e) => { e.stopPropagation(); openEdit(row) }} className="p-2 h-auto rounded-full">
          <Pencil className="w-3.5 h-3.5" />
        </Button>
      ),
    },
  ]

  return (
    <Card {...verifyAttrs({ unit: 'DeckManager', rows: decks.length, modalOpen, loading })}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-label-lg font-semibold text-on-surface-var">Decks</h2>
        <Button variant="primary" size="sm" leftIcon={<Plus className="w-4 h-4" />} onClick={openCreate}>
          Add Deck
        </Button>
      </div>

      <DataTable
        data={decks}
        columns={columns}
        keyField="id"
        emptyMessage={loading ? 'Loading decks...' : 'No decks yet.'}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Deck' : 'Add Deck'} size="md">
        <div className="flex flex-col gap-4">
          <FieldWrapper label="Anki Deck Name">
            <Input
              value={draft.anki_deck_name}
              onChange={(e) => setDraft(d => ({ ...d, anki_deck_name: e.target.value }))}
              placeholder="e.g. AnkiFlow::English::Vocabulary"
            />
          </FieldWrapper>
          <FieldWrapper label="Display Name">
            <Input
              value={draft.display_name}
              onChange={(e) => setDraft(d => ({ ...d, display_name: e.target.value }))}
              placeholder="e.g. English Vocabulary"
            />
          </FieldWrapper>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldWrapper label="Form Type">
              <Select
                aria-label="Form Type"
                value={draft.form_type}
                onChange={(e) => setDraft(d => ({ ...d, form_type: e.target.value as FormType }))}
              >
                {Object.values(FormType).map(ft => (
                  <option key={ft} value={ft}>{FORM_TYPE_LABELS[ft]}</option>
                ))}
              </Select>
            </FieldWrapper>
            <FieldWrapper label="Language">
              <Select
                aria-label="Language"
                value={draft.language}
                onChange={(e) => setDraft(d => ({ ...d, language: e.target.value as LanguageType | typeof NO_LANGUAGE }))}
              >
                <option value={NO_LANGUAGE}>—</option>
                {Object.values(LanguageType).map(lang => (
                  <option key={lang} value={lang}>{LANGUAGE_LABELS[lang]}</option>
                ))}
              </Select>
            </FieldWrapper>
          </div>
          <FieldWrapper label="Sort Order">
            <Input
              type="number"
              aria-label="Sort Order"
              value={draft.sort_order}
              onChange={(e) => setDraft(d => ({ ...d, sort_order: Number(e.target.value) }))}
            />
          </FieldWrapper>

          <div className="flex gap-3 justify-end mt-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSave} disabled={saving || !draft.anki_deck_name.trim() || !draft.display_name.trim()}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  )
}
