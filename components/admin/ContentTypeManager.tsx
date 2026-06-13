'use client'

import { useState, useEffect } from 'react'
import {
  collection, query, orderBy, getDocs,
  updateDoc, doc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Card } from '@/components/ui/Card'
import { DataTable } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Toggle } from '@/components/ui/Toggle'
import { Input, FieldWrapper } from '@/components/ui/FormField'
import { Pencil } from 'lucide-react'
import { verifyAttrs } from '@/verify/core/contract'
import { FormType } from '@/types'
import type { ContentType, FormFieldConfig } from '@/types'

const FORM_TYPE_LABELS: Record<FormType, string> = {
  [FormType.LANGUAGE]: 'Language',
  [FormType.IT]: 'IT',
  [FormType.GENERAL]: 'General',
}

const FIELD_TYPE_LABELS: Record<FormFieldConfig['type'], string> = {
  text: 'Text',
  textarea: 'Textarea',
  dropdown: 'Dropdown',
  checkbox_group: 'Checkbox group',
  tags: 'Tags',
  number: 'Number',
}

export function ContentTypeManager() {
  const [contentTypes, setContentTypes] = useState<ContentType[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ContentType | null>(null)
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

  const openEdit = (contentType: ContentType) => {
    setEditing(contentType)
    setFields([...contentType.fields].sort((a, b) => a.sort_order - b.sort_order).map(f => ({ ...f })))
    setModalOpen(true)
  }

  const updateField = <K extends keyof FormFieldConfig>(index: number, key: K, value: FormFieldConfig[K]) => {
    setFields(prev => prev.map((f, i) => i === index ? { ...f, [key]: value } : f))
  }

  const handleSave = async () => {
    if (!editing) return
    setSaving(true)
    try {
      await updateDoc(doc(db, 'content_types', editing.id), { fields, updated_at: serverTimestamp() })
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
        title={editing ? `Edit Fields — ${editing.name}` : 'Edit Fields'}
        size="lg"
      >
        <div className="flex flex-col gap-4 max-h-[60vh] overflow-y-auto pr-1">
          {editing && (
            <div className="flex items-center gap-2 text-label-sm text-on-surface-var">
              <Badge variant="neutral">{FORM_TYPE_LABELS[editing.code] ?? editing.code}</Badge>
              <span>{editing.description}</span>
            </div>
          )}

          {fields.map((field, index) => (
            <div key={field.field_key} className="rounded-xl border border-outline-var/40 p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-label-sm text-on-surface-var">{field.field_key}</span>
                <Badge variant="neutral">{FIELD_TYPE_LABELS[field.type]}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FieldWrapper label="Label">
                  <Input aria-label={`Label for ${field.field_key}`} value={field.label} onChange={(e) => updateField(index, 'label', e.target.value)} />
                </FieldWrapper>
                <FieldWrapper label="Sort Order">
                  <Input
                    type="number"
                    aria-label={`Sort order for ${field.field_key}`}
                    value={field.sort_order}
                    onChange={(e) => updateField(index, 'sort_order', Number(e.target.value))}
                  />
                </FieldWrapper>
              </div>
              <FieldWrapper label="Placeholder">
                <Input
                  value={field.placeholder || ''}
                  onChange={(e) => updateField(index, 'placeholder', e.target.value)}
                  placeholder="Optional placeholder text"
                />
              </FieldWrapper>
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

          <div className="flex gap-3 justify-end mt-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  )
}
