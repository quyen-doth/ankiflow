'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  collection, query, where, getDocs,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Card } from '@/components/ui/Card'
import { DataTable } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Toggle } from '@/components/ui/Toggle'
import { Input, FieldWrapper, Select } from '@/components/ui/FormField'
import { AiOutputProfilesEditor } from '@/components/admin/AiOutputProfilesEditor'
import { Pencil, Plus, Trash2, Search } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/components/providers/AuthProvider'
import { useSortableList } from '@/hooks/useSortableList'
import { verifyAttrs } from '@/verify/core/contract'
import { cn } from '@/lib/utils'
import {
  resolveContentTypeFormType,
  isProtectedGlobalContentTypeId,
  validateContentTypeConfig,
} from '@/lib/contentTypes'
import {
  getContentTypePrimaryFieldKey,
  validateContentTypeBlueprint,
} from '@/lib/create/formBlueprint'
import {
  cloneStoredContentTypeAiProfiles,
  materializeContentTypeAiProfiles,
} from '@/lib/ai-agent/contentTypeProfiles'
import { parseAiOutputProfiles } from '@/lib/ai-agent/outputProfiles'
import {
  GLOBAL_CONTENT_TYPES_COLLECTION,
  USER_CONTENT_TYPES_COLLECTION,
} from '@/lib/constants'
import { FormType } from '@/types'
import type { AiOutputProfile, ContentType, FormFieldConfig } from '@/types'

const FIELD_TYPE_OPTIONS: { value: FormFieldConfig['type']; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'textarea', label: 'Textarea' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'checkbox_group', label: 'Checkbox group' },
  { value: 'tags', label: 'Tags' },
  { value: 'number', label: 'Number' },
]

interface ContentTypeDraft {
  code: string
  name: string
  description: string
  icon: string
  is_active: boolean
  sort_order: number
  default_create_mode: 'single' | 'batch'
}

const EMPTY_DRAFT: ContentTypeDraft = {
  code: '',
  name: '',
  description: '',
  icon: 'BookOpen',
  is_active: true,
  sort_order: 0,
  default_create_mode: 'single',
}

const EMPTY_FIELD: FormFieldConfig = {
  field_key: '',
  label: '',
  type: 'text',
  is_required: false,
  is_session_persistent: false,
  sort_order: 0,
  placeholder: null,
  data_source: null,
  options: [],
}

export type ContentTypeManagerScope = 'workspace' | 'global-defaults'

interface ContentTypeManagerProps {
  scope?: ContentTypeManagerScope
}

export function ContentTypeManager({ scope = 'workspace' }: ContentTypeManagerProps = {}) {
  const { user, loading: authLoading } = useAuth()
  const uid = user?.uid
  const isAdmin = !!user?.email && user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL
  const isGlobalScope = scope === 'global-defaults' && isAdmin
  const collectionName = isGlobalScope
    ? GLOBAL_CONTENT_TYPES_COLLECTION
    : USER_CONTENT_TYPES_COLLECTION

  const [contentTypes, setContentTypes] = useState<ContentType[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ContentType | null>(null)
  const [draft, setDraft] = useState<ContentTypeDraft>(EMPTY_DRAFT)
  const [fields, setFields] = useState<FormFieldConfig[]>([])
  const [aiOutputProfiles, setAiOutputProfiles] = useState<AiOutputProfile[]>([])
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ContentType | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const toast = useToast()

  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'active' | 'inactive' | ''>('')

  useEffect(() => {
    if (authLoading) return
    if (!uid) return
    let cancelled = false

    async function fetchContentTypes() {
      setLoading(true)
      try {
        const source = collection(db, collectionName)
        const q = isGlobalScope
          ? query(source)
          : query(source, where('user_id', '==', uid))
        const snapshot = await getDocs(q)
        if (cancelled) return
        setContentTypes(
          snapshot.docs
            .map(d => ({ id: d.id, ...d.data() } as ContentType))
            .sort((left, right) => (left.sort_order || 0) - (right.sort_order || 0)),
        )
      } catch (error) {
        if (cancelled) return
        console.error('Error fetching content types:', error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchContentTypes()
    return () => {
      cancelled = true
    }
  }, [refreshKey, collectionName, isGlobalScope, uid, authLoading])

  const refresh = useCallback(() => setRefreshKey(k => k + 1), [])
  const handleReorder = useSortableList<ContentType>(collectionName, setContentTypes, refresh)
  const canReorder = !search && !filterStatus

  const filteredContentTypes = useMemo(() => {
    let result = contentTypes
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(ct => ct.name.toLowerCase().includes(q) || ct.code.toLowerCase().includes(q))
    }
    if (filterStatus) result = result.filter(ct => (filterStatus === 'active') === ct.is_active)
    return result
  }, [contentTypes, search, filterStatus])

  const openCreate = () => {
    setEditing(null)
    setDraft(EMPTY_DRAFT)
    setFields([])
    setAiOutputProfiles([])
    setModalOpen(true)
  }

  const openEdit = (contentType: ContentType) => {
    setEditing(contentType)
    setDraft({
      code: contentType.code,
      name: contentType.name,
      description: contentType.description,
      icon: contentType.icon,
      is_active: contentType.is_active,
      sort_order: contentType.sort_order,
      default_create_mode: contentType.default_create_mode ?? 'single',
    })
    setFields([...contentType.fields].sort((a, b) => a.sort_order - b.sort_order).map(f => ({ ...f })))
    try {
      setAiOutputProfiles(materializeContentTypeAiProfiles(contentType).profiles)
    } catch {
      setAiOutputProfiles(cloneStoredContentTypeAiProfiles(contentType))
    }
    setModalOpen(true)
  }

  const aiProfileContext = useMemo(() => {
    const code = draft.code.trim()
    if (resolveContentTypeFormType(code) === FormType.GENERAL) {
      return { primaryFieldKey: 'title', disabledReason: 'General Knowledge uses local form content and does not call the AI generator.' }
    }
    try {
      return {
        primaryFieldKey: getContentTypePrimaryFieldKey({ code, name: draft.name, fields }),
        disabledReason: undefined,
      }
    } catch {
      return { primaryFieldKey: null, disabledReason: undefined }
    }
  }, [draft.code, draft.name, fields])

  const initializeAiOutputProfiles = () => {
    try {
      const materialized = materializeContentTypeAiProfiles({
        code: draft.code.trim(),
        name: draft.name.trim(),
        fields,
      })
      setAiOutputProfiles(materialized.profiles)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Add a valid primary form field first.')
    }
  }

  const updateField = <K extends keyof FormFieldConfig>(index: number, key: K, value: FormFieldConfig[K]) => {
    setFields(prev => prev.map((f, i) => i === index ? { ...f, [key]: value } : f))
  }

  const addField = () => {
    setFields(prev => [...prev, { ...EMPTY_FIELD, sort_order: prev.length }])
  }

  const removeField = (index: number) => {
    setFields(prev => prev.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    if (!uid) return
    const validation = validateContentTypeConfig({
      ...draft,
      code: draft.code.trim(),
      name: draft.name.trim(),
      fields,
    }, editing?.code)
    if (!validation.success) {
      toast.error(validation.issues[0]?.message ?? 'Invalid content type configuration.')
      return
    }

    const blueprintValidation = validateContentTypeBlueprint(validation.data)
    if (!blueprintValidation.success) {
      toast.error(blueprintValidation.error)
      return
    }

    const primaryFieldKey = getContentTypePrimaryFieldKey(validation.data)
    let profilesToPersist = aiOutputProfiles
    const usesAiGeneration = resolveContentTypeFormType(validation.data.code) !== FormType.GENERAL
    if (usesAiGeneration && profilesToPersist.length === 0) {
      profilesToPersist = materializeContentTypeAiProfiles(validation.data).profiles
    }
    if (profilesToPersist.length > 0) {
      try {
        profilesToPersist = parseAiOutputProfiles(profilesToPersist, primaryFieldKey)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Invalid AI output profiles.')
        return
      }
    }
    const completeData = {
      ...validation.data,
      ...(profilesToPersist.length > 0 ? { ai_output_profiles: profilesToPersist } : {}),
    }

    if (!editing) {
      const normalizedCode = validation.data.code.toLocaleLowerCase('en-US')
      const duplicate = contentTypes.some(contentType =>
        contentType.code.trim().toLocaleLowerCase('en-US') === normalizedCode)
      if (duplicate) {
        toast.error('Content type code must be unique in this workspace.')
        return
      }
    }

    setSaving(true)
    try {
      if (editing) {
        const { code: _immutableCode, ...editableData } = completeData
        void _immutableCode
        await updateDoc(doc(db, collectionName, editing.id), {
          ...editableData,
          updated_at: serverTimestamp(),
        })
      } else {
        await addDoc(collection(db, collectionName), {
          ...completeData,
          ...(isGlobalScope ? {} : { user_id: uid }),
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        })
      }
      setModalOpen(false)
      refresh()
      toast.success(editing ? 'Content type updated' : 'Content type created')
    } catch (error) {
      console.error('Error saving content type:', error)
      toast.error('Failed to save content type.')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (contentType: ContentType) => {
    try {
      await updateDoc(doc(db, collectionName, contentType.id), {
        is_active: !contentType.is_active,
        updated_at: serverTimestamp(),
      })
      refresh()
      toast.success(!contentType.is_active ? 'Content type activated' : 'Content type deactivated')
    } catch (error) {
      console.error('Error toggling content type status:', error)
      toast.error('Failed to update status.')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    if (isGlobalScope && isProtectedGlobalContentTypeId(deleteTarget.id)) {
      toast.error('Built-in defaults can be deactivated but cannot be deleted.')
      setDeleteTarget(null)
      return
    }
    setDeleting(true)
    try {
      await deleteDoc(doc(db, collectionName, deleteTarget.id))
      setDeleteTarget(null)
      refresh()
      toast.success('Content type deleted')
    } catch (error) {
      console.error('Error deleting content type:', error)
      toast.error('Failed to delete content type.')
    } finally {
      setDeleting(false)
    }
  }

  const columns = [
    {
      key: 'code',
      header: 'Code',
      render: (_: unknown, row: ContentType) => <span className="font-mono text-overline text-slate-600">{row.code}</span>,
    },
    {
      key: 'name',
      header: 'Name',
      render: (_: unknown, row: ContentType) => <span className="font-semibold text-ink">{row.name}</span>,
    },
    {
      key: 'fields',
      header: 'Fields',
      render: (_: unknown, row: ContentType) => <span className="text-slate-600">{row.fields?.length || 0}</span>,
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (_: unknown, row: ContentType) => (
        <button onClick={(e) => { e.stopPropagation(); handleToggleActive(row) }} aria-label={`Toggle status ${row.name}`}>
          <Badge variant={row.is_active ? 'active' : 'inactive'}>{row.is_active ? 'Active' : 'Inactive'}</Badge>
        </button>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right' as const,
      render: (_: unknown, row: ContentType) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="sm" aria-label={`Edit fields ${row.name}`} onClick={(e) => { e.stopPropagation(); openEdit(row) }} className="p-2 h-auto rounded-full">
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          {(!isGlobalScope || !isProtectedGlobalContentTypeId(row.id)) && (
            <Button variant="ghost" size="sm" aria-label={`Delete content type ${row.name}`} onClick={(e) => { e.stopPropagation(); setDeleteTarget(row) }} className="p-2 h-auto text-slate-600 hover:text-danger hover:bg-danger-bg rounded-full">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <Card {...verifyAttrs({
      unit: 'ContentTypeManager',
      rows: contentTypes.length,
      modalOpen,
      loading,
      scope: isGlobalScope ? 'global-defaults' : 'workspace',
      collection: collectionName,
    })}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-body font-bold font-semibold text-slate-600">Content Types</h2>
          <p className="text-[12.5px] text-slate-500 mt-0.5">
            {isGlobalScope
              ? 'Defaults copied to accounts created in the future.'
              : 'Form configurations for your workspace.'}
          </p>
        </div>
        <Button variant="primary" size="sm" leftIcon={<Plus className="w-4 h-4" />} onClick={openCreate}>
          Add Content Type
        </Button>
      </div>

      {isGlobalScope && (
        <p className="text-[12.5px] text-slate-600 bg-[#fdfbf5] border border-[#f0e4cc] rounded-[9px] px-3 py-2 mb-4">
          Built-in defaults can be deactivated but cannot be deleted. Custom defaults can be deleted.
        </p>
      )}

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-[14px] top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400/70" />
          <input
            type="search"
            placeholder="Search content types..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-[46px] bg-[#fcfcfb] border border-[#e3e3de] rounded-[10px] pl-10 pr-[14px] text-[15px] text-ink placeholder:text-slate-400/70 focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary-bg transition-shadow"
          />
        </div>
        <Select
          aria-label="Filter by status"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as 'active' | 'inactive' | '')}
          className="!w-auto min-w-[110px]"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </Select>
      </div>

      <DataTable
        data={filteredContentTypes}
        columns={columns}
        keyField="id"
        onRowClick={(row) => openEdit(row)}
        onReorder={canReorder ? handleReorder : undefined}
        emptyMessage={
          loading
            ? 'Loading content types...'
            : filteredContentTypes.length === 0 && contentTypes.length > 0
              ? 'No content types match your filters.'
              : 'No content types yet.'
        }
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={handleSave}
        title={editing ? `Edit — ${editing.name}` : 'Add Content Type'}
        size="lg"
      >
        <div className="flex flex-col gap-4 max-h-[60vh] overflow-y-auto pr-1">
          {/* Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldWrapper label="Name">
              <Input
                aria-label="Content type name"
                value={draft.name}
                onChange={(e) => setDraft(d => ({ ...d, name: e.target.value }))}
                placeholder="e.g. Medical Terms"
              />
            </FieldWrapper>
            <FieldWrapper label="Code">
              <Input
                aria-label="Content type code"
                value={draft.code}
                onChange={(e) => setDraft(d => ({ ...d, code: e.target.value }))}
                placeholder="e.g. form_medical"
                disabled={!!editing}
              />
            </FieldWrapper>
          </div>
          <FieldWrapper label="Description">
            <Input
              aria-label="Description"
              value={draft.description}
              onChange={(e) => setDraft(d => ({ ...d, description: e.target.value }))}
              placeholder="Short description of this content type"
            />
          </FieldWrapper>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldWrapper label="Icon">
              <Input
                aria-label="Icon name"
                value={draft.icon}
                onChange={(e) => setDraft(d => ({ ...d, icon: e.target.value }))}
                placeholder="e.g. BookOpen"
              />
            </FieldWrapper>
            <FieldWrapper label="Sort Order">
              <Input
                type="number"
                aria-label="Sort Order"
                value={draft.sort_order}
                onChange={(e) => setDraft(d => ({ ...d, sort_order: Number(e.target.value) }))}
              />
            </FieldWrapper>
          </div>

          <Toggle
            label="Active"
            description="Visible and selectable in the Create flow"
            checked={draft.is_active}
            onChange={(v) => setDraft(d => ({ ...d, is_active: v }))}
          />

          <FieldWrapper label="Default create mode">
            <div className="inline-flex gap-1 bg-[#ececea] rounded-[11px] p-1" role="radiogroup" aria-label="Default create mode">
              {(['single', 'batch'] as const).map((mode) => {
                const active = draft.default_create_mode === mode
                return (
                  <button
                    key={mode}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setDraft(d => ({ ...d, default_create_mode: mode }))}
                    className={cn(
                      'px-4 py-[7px] rounded-[8px] text-[13px] font-bold capitalize transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                      active ? 'bg-white text-primary shadow-[0_1px_3px_rgba(0,0,0,0.08)]' : 'bg-transparent text-[#7c7f87] hover:text-ink',
                    )}
                  >
                    {mode}
                  </button>
                )
              })}
            </div>
            <p className="text-[12px] text-slate-400 mt-1.5">Pre-selected when this content type is opened in Create (user can still switch).</p>
          </FieldWrapper>

          {/* Fields */}
          <div className="flex items-center justify-between mt-2">
            <h3 className="text-body font-semibold text-slate-600">Fields</h3>
            <Button variant="ghost" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={addField}>
              Add Field
            </Button>
          </div>

          {fields.map((field, index) => (
            <div key={index} className="rounded-card border border-border/40 p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-overline text-slate-600">
                  {field.field_key || `field_${index}`}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeField(index)}
                  className="p-1.5 h-auto text-slate-600 hover:text-danger rounded-full"
                  aria-label={`Remove field ${field.field_key || index}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <FieldWrapper label="Field Key">
                  <Input
                    aria-label={`Field key ${index}`}
                    value={field.field_key}
                    onChange={(e) => updateField(index, 'field_key', e.target.value)}
                    placeholder="e.g. definition"
                  />
                </FieldWrapper>
                <FieldWrapper label="Label">
                  <Input
                    aria-label={`Label for field ${index}`}
                    value={field.label}
                    onChange={(e) => updateField(index, 'label', e.target.value)}
                    placeholder="e.g. Definition"
                  />
                </FieldWrapper>
                <FieldWrapper label="Type">
                  <Select
                    aria-label={`Type for field ${index}`}
                    value={field.type}
                    onChange={(e) => updateField(index, 'type', e.target.value as FormFieldConfig['type'])}
                  >
                    {FIELD_TYPE_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </Select>
                </FieldWrapper>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FieldWrapper label="Placeholder">
                  <Input
                    value={field.placeholder || ''}
                    onChange={(e) => updateField(index, 'placeholder', e.target.value)}
                    placeholder="Optional placeholder"
                  />
                </FieldWrapper>
                <FieldWrapper label="Sort Order">
                  <Input
                    type="number"
                    aria-label={`Sort order for field ${index}`}
                    value={field.sort_order}
                    onChange={(e) => updateField(index, 'sort_order', Number(e.target.value))}
                  />
                </FieldWrapper>
              </div>
              {field.type === 'dropdown' && (
                <FieldWrapper label="Options">
                  <Input
                    aria-label={`Options for field ${index}`}
                    value={(field.options ?? []).join(', ')}
                    onChange={(e) => updateField(
                      index,
                      'options',
                      e.target.value.split(',').map(option => option.trim()).filter(Boolean),
                    )}
                    placeholder="Beginner, Intermediate, Advanced"
                  />
                </FieldWrapper>
              )}
              <div className="flex flex-col gap-2">
                <Toggle
                  label="Required"
                  description="The user must fill in this field before submitting"
                  checked={field.is_required}
                  onChange={(v) => updateField(index, 'is_required', v)}
                />
                <Toggle
                  label="Persist across entries"
                  description="Keep the value saved in the session for the next entry"
                  checked={field.is_session_persistent}
                  onChange={(v) => updateField(index, 'is_session_persistent', v)}
                />
              </div>
            </div>
          ))}

          {fields.length === 0 && (
            <p className="text-sm text-slate-600 text-center py-4">
              No fields yet. Click &quot;Add Field&quot; to define form fields.
            </p>
          )}

          <AiOutputProfilesEditor
            profiles={aiOutputProfiles}
            primaryFieldKey={aiProfileContext.primaryFieldKey}
            disabledReason={aiProfileContext.disabledReason}
            contentType={{
              code: draft.code,
              name: draft.name,
              description: draft.description,
              fields,
            }}
            onInitialize={initializeAiOutputProfiles}
            onChange={setAiOutputProfiles}
          />

          <div className="flex gap-3 justify-end mt-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={saving || !draft.name.trim() || !draft.code.trim()}
            >
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete content type"
        size="sm"
      >
        <p className="text-sm text-slate-600">
          Delete <span className="font-semibold text-ink">{deleteTarget?.name}</span>? This removes the
          form configuration permanently and cannot be undone.
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
