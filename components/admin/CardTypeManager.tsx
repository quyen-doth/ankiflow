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
import { Toggle } from '@/components/ui/Toggle'
import { Input, FieldWrapper, Select, Textarea } from '@/components/ui/FormField'
import { Plus, Pencil } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { verifyAttrs } from '@/verify/core/contract'
import { FormType, LanguageType } from '@/types'
import type { CardTypeConfig } from '@/types'

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

interface CardTypeDraft {
  code: string
  name: string
  description: string
  form_type: FormType
  language: LanguageType | typeof NO_LANGUAGE
  is_default: boolean
  is_active: boolean
  sort_order: number
}

const EMPTY_DRAFT: CardTypeDraft = {
  code: '',
  name: '',
  description: '',
  form_type: FormType.LANGUAGE,
  language: NO_LANGUAGE,
  is_default: false,
  is_active: true,
  sort_order: 0,
}

export function CardTypeManager() {
  const [cardTypes, setCardTypes] = useState<CardTypeConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<CardTypeConfig | null>(null)
  const [draft, setDraft] = useState<CardTypeDraft>(EMPTY_DRAFT)
  const [saving, setSaving] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const toast = useToast()

  useEffect(() => {
    async function fetchCardTypes() {
      setLoading(true)
      try {
        const q = query(collection(db, 'card_types'), orderBy('sort_order', 'asc'))
        const snapshot = await getDocs(q)
        setCardTypes(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CardTypeConfig)))
      } catch (error) {
        console.error('Error fetching card types:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchCardTypes()
  }, [refreshKey])

  const refresh = () => setRefreshKey(k => k + 1)

  const openCreate = () => {
    setEditing(null)
    setDraft(EMPTY_DRAFT)
    setModalOpen(true)
  }

  const openEdit = (cardType: CardTypeConfig) => {
    setEditing(cardType)
    setDraft({
      code: cardType.code,
      name: cardType.name,
      description: cardType.description || '',
      form_type: cardType.form_type,
      language: cardType.language || NO_LANGUAGE,
      is_default: cardType.is_default,
      is_active: cardType.is_active,
      sort_order: cardType.sort_order,
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!draft.code.trim() || !draft.name.trim()) return
    setSaving(true)
    try {
      const base = {
        code: draft.code,
        name: draft.name,
        description: draft.description || '',
        form_type: draft.form_type,
        is_default: draft.is_default,
        is_active: draft.is_active,
        sort_order: draft.sort_order,
      }
      if (editing) {
        await updateDoc(doc(db, 'card_types', editing.id), {
          ...base,
          language: draft.language === NO_LANGUAGE ? deleteField() : draft.language,
          updated_at: serverTimestamp(),
        })
      } else {
        await addDoc(collection(db, 'card_types'), {
          ...base,
          ...(draft.language !== NO_LANGUAGE && { language: draft.language }),
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        })
      }
      setModalOpen(false)
      refresh()
      toast.success(editing ? 'Đã cập nhật card type' : 'Đã tạo card type')
    } catch (error) {
      console.error('Error saving card type:', error)
      toast.error('Không lưu được card type.')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (cardType: CardTypeConfig) => {
    try {
      await updateDoc(doc(db, 'card_types', cardType.id), { is_active: !cardType.is_active, updated_at: serverTimestamp() })
      refresh()
      toast.success(!cardType.is_active ? 'Đã kích hoạt card type' : 'Đã tắt card type')
    } catch (error) {
      console.error('Error toggling card type status:', error)
      toast.error('Không cập nhật được trạng thái.')
    }
  }

  const columns = [
    {
      key: 'code',
      header: 'Code',
      render: (_: unknown, row: CardTypeConfig) => <span className="font-mono text-overline text-slate-600">{row.code}</span>,
    },
    {
      key: 'name',
      header: 'Name',
      render: (_: unknown, row: CardTypeConfig) => <span className="font-semibold text-ink">{row.name}</span>,
    },
    {
      key: 'form_type',
      header: 'Form Type',
      render: (_: unknown, row: CardTypeConfig) => <Badge variant="neutral">{FORM_TYPE_LABELS[row.form_type] ?? row.form_type}</Badge>,
    },
    {
      key: 'language',
      header: 'Language',
      render: (_: unknown, row: CardTypeConfig) => (
        <span className="text-slate-600">{row.language ? (LANGUAGE_LABELS[row.language] ?? row.language) : '—'}</span>
      ),
    },
    {
      key: 'is_default',
      header: 'Default',
      render: (_: unknown, row: CardTypeConfig) => (
        row.is_default ? <Badge className="bg-primary-bg text-primary">Default</Badge> : <span className="text-slate-600">—</span>
      ),
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (_: unknown, row: CardTypeConfig) => (
        <button onClick={(e) => { e.stopPropagation(); handleToggleActive(row) }}>
          <Badge variant={row.is_active ? 'active' : 'inactive'}>{row.is_active ? 'Active' : 'Inactive'}</Badge>
        </button>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right' as const,
      render: (_: unknown, row: CardTypeConfig) => (
        <Button variant="ghost" size="sm" aria-label={`Edit card type ${row.name}`} onClick={(e) => { e.stopPropagation(); openEdit(row) }} className="p-2 h-auto rounded-full">
          <Pencil className="w-3.5 h-3.5" />
        </Button>
      ),
    },
  ]

  return (
    <Card {...verifyAttrs({ unit: 'CardTypeManager', rows: cardTypes.length, modalOpen, loading })}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-body font-bold font-semibold text-slate-600">Card Types</h2>
          <p className="text-secondary text-slate-400 mt-0.5">Note templates generated per vocabulary item</p>
        </div>
        <Button variant="primary" size="sm" leftIcon={<Plus className="w-4 h-4" />} onClick={openCreate}>
          Add card type
        </Button>
      </div>

      <DataTable
        data={cardTypes}
        columns={columns}
        keyField="id"
        emptyMessage={loading ? 'Loading card types...' : 'No card types yet.'}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Card Type' : 'Add Card Type'} size="md">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldWrapper label="Code">
              <Input value={draft.code} onChange={(e) => setDraft(d => ({ ...d, code: e.target.value }))} placeholder="e.g. word_meaning" />
            </FieldWrapper>
            <FieldWrapper label="Name">
              <Input value={draft.name} onChange={(e) => setDraft(d => ({ ...d, name: e.target.value }))} placeholder="e.g. Word → Meaning" />
            </FieldWrapper>
          </div>
          <FieldWrapper label="Description">
            <Textarea
              value={draft.description}
              onChange={(e) => setDraft(d => ({ ...d, description: e.target.value }))}
              placeholder="Optional description"
              rows={2}
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
          <div className="flex flex-col gap-3">
            <Toggle
              label="Default card type"
              description="Pre-selected by default when creating a new card"
              checked={draft.is_default}
              onChange={(v) => setDraft(d => ({ ...d, is_default: v }))}
            />
            <Toggle
              label="Active"
              description="Visible and selectable in the Create flow"
              checked={draft.is_active}
              onChange={(v) => setDraft(d => ({ ...d, is_active: v }))}
            />
          </div>

          <div className="flex gap-3 justify-end mt-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSave} disabled={saving || !draft.code.trim() || !draft.name.trim()}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  )
}
