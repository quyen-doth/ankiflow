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
import { Input, FieldWrapper, Select } from '@/components/ui/FormField'
import { Plus, Pencil } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { verifyAttrs } from '@/verify/core/contract'
import { FormType } from '@/types'
import type { Category } from '@/types'

const FORM_TYPE_LABELS: Record<FormType, string> = {
  [FormType.LANGUAGE]: 'Language',
  [FormType.IT]: 'IT',
  [FormType.GENERAL]: 'General',
}

interface CategoryDraft {
  name: string
  form_type: FormType
  sort_order: number
  is_active: boolean
}

const EMPTY_DRAFT: CategoryDraft = { name: '', form_type: FormType.LANGUAGE, sort_order: 0, is_active: true }

export function CategoryManager() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [draft, setDraft] = useState<CategoryDraft>(EMPTY_DRAFT)
  const [saving, setSaving] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const toast = useToast()

  useEffect(() => {
    async function fetchCategories() {
      setLoading(true)
      try {
        const q = query(collection(db, 'categories'), orderBy('sort_order', 'asc'))
        const snapshot = await getDocs(q)
        setCategories(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Category)))
      } catch (error) {
        console.error('Error fetching categories:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchCategories()
  }, [refreshKey])

  const refresh = () => setRefreshKey(k => k + 1)

  const openCreate = () => {
    setEditing(null)
    setDraft(EMPTY_DRAFT)
    setModalOpen(true)
  }

  const openEdit = (category: Category) => {
    setEditing(category)
    setDraft({
      name: category.name,
      form_type: category.form_type,
      sort_order: category.sort_order,
      is_active: category.is_active,
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!draft.name.trim()) return
    setSaving(true)
    try {
      if (editing) {
        await updateDoc(doc(db, 'categories', editing.id), {
          ...draft,
          updated_at: serverTimestamp(),
        })
      } else {
        await addDoc(collection(db, 'categories'), {
          ...draft,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        })
      }
      setModalOpen(false)
      refresh()
      toast.success(editing ? 'Đã cập nhật category' : 'Đã tạo category')
    } catch (error) {
      console.error('Error saving category:', error)
      toast.error('Không lưu được category.')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (category: Category) => {
    try {
      await updateDoc(doc(db, 'categories', category.id), {
        is_active: !category.is_active,
        updated_at: serverTimestamp(),
      })
      refresh()
      toast.success(!category.is_active ? 'Đã kích hoạt category' : 'Đã tắt category')
    } catch (error) {
      console.error('Error toggling category status:', error)
      toast.error('Không cập nhật được trạng thái.')
    }
  }

  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (_: unknown, row: Category) => <span className="font-semibold text-ink">{row.name}</span>,
    },
    {
      key: 'form_type',
      header: 'Form Type',
      render: (_: unknown, row: Category) => <Badge variant="neutral">{FORM_TYPE_LABELS[row.form_type] ?? row.form_type}</Badge>,
    },
    {
      key: 'sort_order',
      header: 'Order',
      render: (_: unknown, row: Category) => <span className="text-slate-600">{row.sort_order}</span>,
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (_: unknown, row: Category) => (
        <button onClick={(e) => { e.stopPropagation(); handleToggleActive(row) }}>
          <Badge variant={row.is_active ? 'active' : 'inactive'}>{row.is_active ? 'Active' : 'Inactive'}</Badge>
        </button>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right' as const,
      render: (_: unknown, row: Category) => (
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Edit category ${row.name}`}
          onClick={(e) => { e.stopPropagation(); openEdit(row) }}
          className="p-2 h-auto rounded-full"
        >
          <Pencil className="w-3.5 h-3.5" />
        </Button>
      ),
    },
  ]

  return (
    <Card {...verifyAttrs({ unit: 'CategoryManager', rows: categories.length, modalOpen, loading })}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-body font-bold font-semibold text-slate-600">Categories</h2>
        <Button variant="primary" size="sm" leftIcon={<Plus className="w-4 h-4" />} onClick={openCreate}>
          Add Category
        </Button>
      </div>

      <DataTable
        data={categories}
        columns={columns}
        keyField="id"
        emptyMessage={loading ? 'Loading categories...' : 'No categories yet.'}
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Category' : 'Add Category'}
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <FieldWrapper label="Name">
            <Input value={draft.name} onChange={(e) => setDraft(d => ({ ...d, name: e.target.value }))} placeholder="e.g. Daily Life" />
          </FieldWrapper>
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
            <Button variant="primary" onClick={handleSave} disabled={saving || !draft.name.trim()}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  )
}
