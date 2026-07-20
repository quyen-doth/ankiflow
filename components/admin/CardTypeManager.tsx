'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  collection, query, where, getDocs,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp, deleteField,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/components/providers/AuthProvider'
import { useStudyLanguages } from '@/components/providers/StudyLanguageProvider'
import { Card } from '@/components/ui/Card'
import { DataTable } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Toggle } from '@/components/ui/Toggle'
import { Input, FieldWrapper, Select, Textarea } from '@/components/ui/FormField'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Plus, Pencil, Trash2, Search, ChevronDown, AlertTriangle } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { useSortableList } from '@/hooks/useSortableList'
import { verifyAttrs } from '@/verify/core/contract'
import { FormType } from '@/types'
import type { CardTypeConfig, CardTemplate, ContentType, LanguageCode } from '@/types'
import { canonicalizeLanguageCode, languageDisplayName } from '@/lib/studyLanguages'
import { DEFAULT_TEMPLATES, getFieldLabel } from '@/lib/anki/renderCard'
import { cardTemplateSchema, parseCustomFieldSource } from '@/lib/anki/cardFieldSource'
import { resolveCardTemplateCustomFields } from '@/lib/anki/cardTemplateFields'
import { loadGlobalContentTypes, loadUserContentTypes } from '@/lib/userContentTypes'
import { DEFAULTS_OWNER_ID } from '@/lib/constants'
import { CardStructureEditor, CardPreview } from '@/components/admin/CardTemplateEditor'

/** Slugify name → code (vd "Word → Meaning" → "word_to_meaning"). */
function slugifyCode(name: string): string {
  return name
    .toLowerCase()
    .replace(/→/g, ' to ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

const FORM_TYPE_LABELS: Record<FormType, string> = {
  [FormType.LANGUAGE]: 'Language',
  [FormType.IT]: 'IT',
  [FormType.GENERAL]: 'General',
}

const NO_LANGUAGE = '__none__'

interface CardTypeDraft {
  code: string
  name: string
  description: string
  form_type: FormType
  language: LanguageCode | typeof NO_LANGUAGE
  is_default: boolean
  is_active: boolean
  sort_order: number
  template: CardTemplate
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
  template: DEFAULT_TEMPLATES['word_to_meaning'],
}

interface CardTypeManagerProps {
  /** 編集対象 docs の所有者 — 既定は現在 user の uid。admin は `__defaults__`
   *  (DEFAULTS_OWNER_ID) を渡し、新規 user が seedUserDefaults で受け取る template を編集する。 */
  ownerId?: string
}

export function CardTypeManager({ ownerId: ownerIdProp }: CardTypeManagerProps = {}) {
  const { user, loading: authLoading } = useAuth()
  const { languages, enabledLanguages } = useStudyLanguages()
  const ownerId = ownerIdProp ?? user?.uid
  const [cardTypes, setCardTypes] = useState<CardTypeConfig[]>([])
  const [contentTypes, setContentTypes] = useState<ContentType[]>([])
  const [contentTypesLoaded, setContentTypesLoaded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<CardTypeConfig | null>(null)
  const [draft, setDraft] = useState<CardTypeDraft>(EMPTY_DRAFT)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<CardTypeConfig | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showErrors, setShowErrors] = useState(false)
  const [codeEdited, setCodeEdited] = useState(false)
  const toast = useToast()

  const [search, setSearch] = useState('')
  const [filterFormType, setFilterFormType] = useState<FormType | ''>('')
  const [filterLanguage, setFilterLanguage] = useState<LanguageCode | ''>('')
  const [filterStatus, setFilterStatus] = useState<'active' | 'inactive' | ''>('')

  const languageOptions = useMemo(() => {
    const codes = new Set<string>()
    languages.forEach(language => codes.add(language.code))
    cardTypes.forEach(cardType => {
      if (cardType.language) codes.add(canonicalizeLanguageCode(cardType.language) ?? cardType.language)
    })
    return Array.from(codes).map(code => ({ value: code, label: languageDisplayName(code, languages) }))
  }, [cardTypes, languages])

  const selectableLanguageOptions = useMemo(() => {
    const codes = new Set(enabledLanguages.map(language => language.code))
    if (draft.language !== NO_LANGUAGE) codes.add(draft.language)
    return Array.from(codes).map(code => ({ value: code, label: languageDisplayName(code, languages) }))
  }, [draft.language, enabledLanguages, languages])

  const customFields = useMemo(() => resolveCardTemplateCustomFields(
    contentTypes,
    draft.form_type,
    draft.language === NO_LANGUAGE ? null : draft.language,
  ), [contentTypes, draft.form_type, draft.language])

  const unavailableTemplateFields = useMemo(() => {
    const availableSources = new Set<string>(customFields.map(field => field.source))
    const seen = new Set<string>()

    return [...draft.template.front, ...draft.template.back].flatMap(source => {
      const customKey = parseCustomFieldSource(source)
      if (!customKey || availableSources.has(source) || seen.has(source)) return []
      seen.add(source)
      return [getFieldLabel(source)]
    })
  }, [customFields, draft.template.back, draft.template.front])

  useEffect(() => {
    if (authLoading || !ownerId) return
    async function fetchCardTypes() {
      setLoading(true)
      try {
        // Sort in-memory thay orderBy — tránh composite index (user_id, sort_order)
        const q = query(collection(db, 'card_types'), where('user_id', '==', ownerId))
        const snapshot = await getDocs(q)
        setCardTypes(
          snapshot.docs
            .map(d => ({ id: d.id, ...d.data() } as CardTypeConfig))
            .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
        )
      } catch (error) {
        console.error('Error fetching card types:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchCardTypes()
  }, [refreshKey, ownerId, authLoading])

  useEffect(() => {
    if (authLoading || !ownerId || !user?.uid) return
    let cancelled = false
    const contentTypeOwnerId = ownerId

    async function fetchContentTypes() {
      setContentTypesLoaded(false)
      try {
        const loaded = contentTypeOwnerId === DEFAULTS_OWNER_ID
          ? await loadGlobalContentTypes()
          : await loadUserContentTypes(contentTypeOwnerId)
        if (!cancelled) {
          setContentTypes(loaded)
          setContentTypesLoaded(true)
        }
      } catch (error) {
        if (cancelled) return
        console.error('Error fetching content types for card templates:', error)
        setContentTypes([])
      }
    }

    fetchContentTypes()
    return () => {
      cancelled = true
    }
  }, [authLoading, ownerId, user?.uid])

  const refresh = () => setRefreshKey(k => k + 1)
  const handleReorder = useSortableList<CardTypeConfig>('card_types', setCardTypes, refresh)
  const canReorder = !search && !filterFormType && !filterLanguage && !filterStatus

  const filteredCardTypes = useMemo(() => {
    let result = cardTypes
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(ct => ct.name.toLowerCase().includes(q) || ct.code.toLowerCase().includes(q))
    }
    if (filterFormType) result = result.filter(ct => ct.form_type === filterFormType)
    if (filterLanguage) result = result.filter(ct => ct.language === filterLanguage)
    if (filterStatus) result = result.filter(ct => (filterStatus === 'active') === ct.is_active)
    return result
  }, [cardTypes, search, filterFormType, filterLanguage, filterStatus])

  // Validation: name & code は非空、Front/Back 各面に ≥ 1 field。
  const errors = {
    name: !draft.name.trim(),
    code: !draft.code.trim(),
    front: draft.template.front.length === 0,
    back: draft.template.back.length === 0,
    template: !cardTemplateSchema.safeParse(draft.template).success,
  }
  const hasErrors = errors.name || errors.code || errors.front || errors.back || errors.template

  const openCreate = () => {
    setEditing(null)
    setDraft(EMPTY_DRAFT)
    setShowAdvanced(false)
    setShowErrors(false)
    setCodeEdited(false)
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
      template: cardType.template ?? DEFAULT_TEMPLATES[cardType.code] ?? DEFAULT_TEMPLATES['word_to_meaning'],
    })
    setShowAdvanced(false)
    setShowErrors(false)
    setCodeEdited(true) // 既存 card: name に応じた code の自動変更はしない
    setModalOpen(true)
  }

  // name 変更 → code を自動生成 (新規作成時、かつ user が code を手動編集していない場合のみ)。
  const handleNameChange = (name: string) => {
    setDraft(d => {
      if (editing || codeEdited) return { ...d, name }
      const code = slugifyCode(name)
      const template = DEFAULT_TEMPLATES[code] ?? d.template
      return { ...d, name, code, template }
    })
  }

  const handleSave = async () => {
    if (hasErrors) {
      setShowErrors(true)
      return
    }
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
        template: draft.template,
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
          user_id: ownerId,
          ...(draft.language !== NO_LANGUAGE && { language: draft.language }),
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        })
      }
      setModalOpen(false)
      refresh()
      toast.success(editing ? 'Card type updated' : 'Card type created')
    } catch (error) {
      console.error('Error saving card type:', error)
      toast.error('Failed to save card type.')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (cardType: CardTypeConfig) => {
    try {
      await updateDoc(doc(db, 'card_types', cardType.id), { is_active: !cardType.is_active, updated_at: serverTimestamp() })
      refresh()
      toast.success(!cardType.is_active ? 'Card type activated' : 'Card type deactivated')
    } catch (error) {
      console.error('Error toggling card type status:', error)
      toast.error('Failed to update status.')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteDoc(doc(db, 'card_types', deleteTarget.id))
      setDeleteTarget(null)
      refresh()
      toast.success('Card type deleted')
    } catch (error) {
      console.error('Error deleting card type:', error)
      toast.error('Failed to delete card type.')
    } finally {
      setDeleting(false)
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
        <span className="text-slate-600">{row.language ? languageDisplayName(row.language, languages) : '—'}</span>
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
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="sm" aria-label={`Edit card type ${row.name}`} onClick={(e) => { e.stopPropagation(); openEdit(row) }} className="p-2 h-auto rounded-full">
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="sm" aria-label={`Delete card type ${row.name}`} onClick={(e) => { e.stopPropagation(); setDeleteTarget(row) }} className="p-2 h-auto text-slate-600 hover:text-danger hover:bg-danger-bg rounded-full">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
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

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-[14px] top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400/70" />
          <input
            type="search"
            placeholder="Search card types..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-[46px] bg-[#fcfcfb] border border-[#e3e3de] rounded-[10px] pl-10 pr-[14px] text-[15px] text-ink placeholder:text-slate-400/70 focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary-bg transition-shadow"
          />
        </div>
        <Select aria-label="Filter by form type" value={filterFormType} onChange={(e) => setFilterFormType(e.target.value as FormType | '')} className="!w-auto min-w-[130px]">
          <option value="">All Types</option>
          {Object.values(FormType).map(ft => (<option key={ft} value={ft}>{FORM_TYPE_LABELS[ft]}</option>))}
        </Select>
        <Select aria-label="Filter by language" value={filterLanguage} onChange={(e) => setFilterLanguage(e.target.value as LanguageCode | '')} className="!w-auto min-w-[130px]">
          <option value="">All Languages</option>
          {languageOptions.map(language => (<option key={language.value} value={language.value}>{language.label}</option>))}
        </Select>
        <Select aria-label="Filter by status" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as 'active' | 'inactive' | '')} className="!w-auto min-w-[110px]">
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </Select>
      </div>

      <DataTable
        data={filteredCardTypes}
        columns={columns}
        keyField="id"
        onRowClick={(row) => openEdit(row)}
        onReorder={canReorder ? handleReorder : undefined}
        emptyMessage={
          loading
            ? 'Loading card types...'
            : filteredCardTypes.length === 0 && cardTypes.length > 0
              ? 'No card types match your filters.'
              : 'No card types yet.'
        }
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} onConfirm={handleSave} title={editing ? 'Edit Card Type' : 'Add Card Type'} size="xl">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_340px] gap-6">
          {/* LEFT: metadata + structure */}
          <div className="flex flex-col gap-4 min-w-0">
            <FieldWrapper label="Name" error={showErrors && errors.name ? 'Name is required' : undefined}>
              <Input
                value={draft.name}
                error={showErrors && errors.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. Word → Meaning"
              />
            </FieldWrapper>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FieldWrapper label="Form Type">
                <SegmentedControl
                  aria-label="Form Type"
                  value={draft.form_type}
                  onChange={(v) => setDraft(d => ({ ...d, form_type: v }))}
                  options={Object.values(FormType).map(ft => ({ value: ft, label: FORM_TYPE_LABELS[ft] }))}
                />
              </FieldWrapper>
              <FieldWrapper label="Language">
                <Select
                  aria-label="Language"
                  value={draft.language}
                  onChange={(event) => setDraft(d => ({ ...d, language: event.target.value as LanguageCode | typeof NO_LANGUAGE }))}
                >
                  <option value={NO_LANGUAGE}>All</option>
                  {selectableLanguageOptions.map(language => (
                    <option key={language.value} value={language.value}>{language.label}</option>
                  ))}
                </Select>
                {draft.form_type === FormType.LANGUAGE && (
                  <p className="mt-1.5 text-[11.5px] leading-relaxed text-slate-400">
                    Language-specific output fields are only available when a language is selected. &apos;All&apos; shows Default fields only.
                  </p>
                )}
              </FieldWrapper>
            </div>

            <div className="border-t border-[#eaeae6] pt-4">
              <CardStructureEditor
                code={draft.code}
                template={draft.template}
                customFields={customFields}
                showErrors={showErrors}
                onChange={template => setDraft(d => ({ ...d, template }))}
              />
              {contentTypesLoaded && unavailableTemplateFields.length > 0 && (
                <div role="alert" className="mt-3 flex items-start gap-2 rounded-[7px] border border-[#efe0c6] bg-[#faf3e6] px-3 py-2.5 text-[#8a5a12]">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <p className="text-[12px] leading-relaxed">
                    <span className="font-semibold">Unavailable for the current selection: {unavailableTemplateFields.join(', ')}.</span>{' '}
                    These fields remain in the card structure, but their AI output may be empty.
                  </p>
                </div>
              )}
              {showErrors && (errors.front || errors.back) && (
                <p className="text-overline text-danger mt-2">
                  Each side must have at least one field.
                </p>
              )}
              {showErrors && errors.template && !errors.front && !errors.back && (
                <p className="text-overline text-danger mt-2">
                  Card fields must be supported built-in fields or valid custom fields.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-[#eaeae6] pt-4">
              <Toggle bare label="Default" checked={draft.is_default} onChange={(v) => setDraft(d => ({ ...d, is_default: v }))} />
              <Toggle bare label="Active" checked={draft.is_active} onChange={(v) => setDraft(d => ({ ...d, is_active: v }))} />
            </div>

            {/* Advanced (collapsible): code, description, sort order */}
            <div className="border-t border-[#eaeae6] pt-3">
              <button
                type="button"
                onClick={() => setShowAdvanced(s => !s)}
                className="flex items-center gap-1.5 text-overline uppercase tracking-[0.05em] text-slate-400 font-mono hover:text-ink transition-colors"
              >
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
                Advanced
              </button>
              {showAdvanced && (
                <div className="flex flex-col gap-4 mt-3">
                  <FieldWrapper label="Code" error={showErrors && errors.code ? 'Code is required' : undefined}>
                    <Input
                      value={draft.code}
                      error={showErrors && errors.code}
                      onChange={(e) => { setCodeEdited(true); setDraft(d => ({ ...d, code: e.target.value })) }}
                      placeholder="e.g. word_to_meaning"
                    />
                  </FieldWrapper>
                  <FieldWrapper label="Description">
                    <Textarea
                      value={draft.description}
                      onChange={(e) => setDraft(d => ({ ...d, description: e.target.value }))}
                      placeholder="Optional description"
                      rows={2}
                    />
                  </FieldWrapper>
                  <FieldWrapper label="Sort Order">
                    <Input type="number" aria-label="Sort Order" value={draft.sort_order} onChange={(e) => setDraft(d => ({ ...d, sort_order: Number(e.target.value) }))} />
                  </FieldWrapper>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: sticky preview */}
          <div className="md:sticky md:top-0 md:self-start">
            <CardPreview
              template={draft.template}
              language={draft.language === NO_LANGUAGE ? null : draft.language}
              customFields={customFields}
            />
          </div>
        </div>

        <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-[#eaeae6]">
          <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </Modal>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title="Delete card type" size="sm">
        <p className="text-sm text-slate-600">
          Delete <span className="font-semibold text-ink">{deleteTarget?.name}</span>?
          This removes the card type permanently. This cannot be undone.
        </p>
        <div className="flex gap-3 justify-end mt-5">
          <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </Modal>
    </Card>
  )
}
