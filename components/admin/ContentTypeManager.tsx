'use client'

import { useState, useEffect } from 'react'
import {
  collection, query, orderBy, getDocs,
  addDoc, updateDoc, doc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Card } from '@/components/ui/Card'
import { DataTable } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Toggle } from '@/components/ui/Toggle'
import { Input, FieldWrapper, Select } from '@/components/ui/FormField'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { verifyAttrs } from '@/verify/core/contract'
import { FormType } from '@/types'
import type { ContentType, FormFieldConfig } from '@/types'

const FORM_TYPE_LABELS: Record<FormType, string> = {
  [FormType.LANGUAGE]: 'Language',
  [FormType.IT]: 'IT',
  [FormType.GENERAL]: 'General',
}

const FIELD_TYPE_OPTIONS: { value: FormFieldConfig['type']; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'textarea', label: 'Textarea' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'checkbox_group', label: 'Checkbox group' },
  { value: 'tags', label: 'Tags' },
  { value: 'number', label: 'Number' },
]

const FIELD_TYPE_LABELS: Record<FormFieldConfig['type'], string> = Object.fromEntries(
  FIELD_TYPE_OPTIONS.map(o => [o.value, o.label])
) as Record<FormFieldConfig['type'], string>

interface ContentTypeDraft {
  code: FormType
  name: string
  description: string
  icon: string
  is_active: boolean
  sort_order: number
}

const EMPTY_DRAFT: ContentTypeDraft = {
  code: FormType.GENERAL,
  name: '',
  description: '',
  icon: 'BookOpen',
  is_active: true,
  sort_order: 0,
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
}

export function ContentTypeManager() {
  const [contentTypes, setContentTypes] = useState<ContentType[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ContentType | null>(null)
  const [draft, setDraft] = useState<ContentTypeDraft>(EMPTY_DRAFT)
  const [fields, setFields] = useState<FormFieldConfig[]>([])
  const [saving, setSaving] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    async function fetchContentTypes() {
      setLoading(true)
      try {
        const q = query(collection(db, 'content_types'), orderBy('sort_order', 'asc'))
        const snapshot = await getDocs(q)
        setContentTypes(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ContentType)))
      } catch (error) {
        console.error('Error fetching content types:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchContentTypes()
  }, [refreshKey])

  const refresh = () => setRefreshKey(k => k + 1)

  const openCreate = () => {
    setEditing(null)
    setDraft(EMPTY_DRAFT)
    setFields([])
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
    })
    setFields([...contentType.fields].sort((a, b) => a.sort_order - b.sort_order).map(f => ({ ...f })))
    setModalOpen(true)
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
    setSaving(true)
    try {
      if (editing) {
        await updateDoc(doc(db, 'content_types', editing.id), {
          ...draft,
          fields,
          updated_at: serverTimestamp(),
        })
      } else {
        await addDoc(collection(db, 'content_types'), {
          ...draft,
          fields,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        })
      }
      setModalOpen(false)
      refresh()
    } catch (error) {
      console.error('Error saving content type:', error)
    } finally {
      setSaving(false)
    }
  }

  const columns = [
    {
      key: 'code',
      header: 'Code',
      render: (_: unknown, row: ContentType) => <span className="font-mono text-label-sm text-on-surface-var">{row.code}</span>,
    },
    {
      key: 'name',
      header: 'Name',
      render: (_: unknown, row: ContentType) => <span className="font-semibold text-on-surface">{row.name}</span>,
    },
    {
      key: 'fields',
      header: 'Fields',
      render: (_: unknown, row: ContentType) => <span className="text-on-surface-var">{row.fields?.length || 0}</span>,
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (_: unknown, row: ContentType) => (
        <Badge variant={row.is_active ? 'active' : 'inactive'}>{row.is_active ? 'Active' : 'Inactive'}</Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right' as const,
      render: (_: unknown, row: ContentType) => (
        <Button variant="ghost" size="sm" aria-label={`Edit fields ${row.name}`} onClick={(e) => { e.stopPropagation(); openEdit(row) }} className="p-2 h-auto rounded-full">
          <Pencil className="w-3.5 h-3.5" />
        </Button>
      ),
    },
  ]

  return (
    <Card {...verifyAttrs({ unit: 'ContentTypeManager', rows: contentTypes.length, modalOpen, loading })}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-label-lg font-semibold text-on-surface-var">Content Types</h2>
        <Button variant="primary" size="sm" leftIcon={<Plus className="w-4 h-4" />} onClick={openCreate}>
          Add Content Type
        </Button>
      </div>

      <DataTable
        data={contentTypes}
        columns={columns}
        keyField="id"
        emptyMessage={loading ? 'Loading content types...' : 'No content types yet.'}
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit — ${editing.name}` : 'Add Content Type'}
        size="lg"
      >
        <div className="flex flex-col gap-4 max-h-[60vh] overflow-y-auto pr-1">
          {/* Metadata */}
          <div className="grid grid-cols-2 gap-4">
            <FieldWrapper label="Name">
              <Input
                aria-label="Content type name"
                value={draft.name}
                onChange={(e) => setDraft(d => ({ ...d, name: e.target.value }))}
                placeholder="e.g. Medical Terms"
              />
            </FieldWrapper>
            <FieldWrapper label="Form Type">
              <Select
                aria-label="Form Type"
                value={draft.code}
                onChange={(e) => setDraft(d => ({ ...d, code: e.target.value as FormType }))}
              >
                {Object.values(FormType).map(ft => (
                  <option key={ft} value={ft}>{FORM_TYPE_LABELS[ft]}</option>
                ))}
              </Select>
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
          <div className="grid grid-cols-2 gap-4">
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

          {/* Fields */}
          <div className="flex items-center justify-between mt-2">
            <h3 className="text-label-md font-semibold text-on-surface-var">Fields</h3>
            <Button variant="ghost" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={addField}>
              Add Field
            </Button>
          </div>

          {fields.map((field, index) => (
            <div key={index} className="rounded-xl border border-outline-var/40 p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-label-sm text-on-surface-var">
                  {field.field_key || `field_${index}`}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeField(index)}
                  className="p-1.5 h-auto text-on-surface-var hover:text-error rounded-full"
                  aria-label={`Remove field ${field.field_key || index}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-3">
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
              <div className="grid grid-cols-2 gap-3">
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
            <p className="text-sm text-on-surface-var text-center py-4">
              No fields yet. Click &quot;Add Field&quot; to define form fields.
            </p>
          )}

          <div className="flex gap-3 justify-end mt-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={saving || !draft.name.trim()}
            >
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  )
}
