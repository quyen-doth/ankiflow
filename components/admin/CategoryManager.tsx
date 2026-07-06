'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  collection, query, where, getDocs,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/components/providers/AuthProvider'
import { Card } from '@/components/ui/Card'
import { DataTable } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input, FieldWrapper, Select } from '@/components/ui/FormField'
import { Plus, Pencil, Trash2, Search } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { useSortableList } from '@/hooks/useSortableList'
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

interface CategoryManagerProps {
  /** Chủ sở hữu docs đang sửa — mặc định uid của user hiện tại. Admin truyền `__defaults__`
   *  (DEFAULTS_OWNER_ID) để sửa template mà user mới nhận qua seedUserDefaults. */
  ownerId?: string
}

export function CategoryManager({ ownerId: ownerIdProp }: CategoryManagerProps = {}) {
  const { user, loading: authLoading } = useAuth()
  const ownerId = ownerIdProp ?? user?.uid
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [draft, setDraft] = useState<CategoryDraft>(EMPTY_DRAFT)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const toast = useToast()

  const [search, setSearch] = useState('')
  const [filterFormType, setFilterFormType] = useState<FormType | ''>('')
  const [filterStatus, setFilterStatus] = useState<'active' | 'inactive' | ''>('')

  useEffect(() => {
    if (authLoading || !ownerId) return
    async function fetchCategories() {
      setLoading(true)
      try {
        // Sort in-memory thay orderBy — tránh composite index (user_id, sort_order)
        const q = query(collection(db, 'categories'), where('user_id', '==', ownerId))
        const snapshot = await getDocs(q)
        setCategories(
          snapshot.docs
            .map(d => ({ id: d.id, ...d.data() } as Category))
            .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
        )
      } catch (error) {
        console.error('Error fetching categories:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchCategories()
  }, [refreshKey, ownerId, authLoading])

  const refresh = () => setRefreshKey(k => k + 1)
  const handleReorder = useSortableList<Category>('categories', setCategories, refresh)
  const canReorder = !search && !filterFormType && !filterStatus

  const filteredCategories = useMemo(() => {
    let result = categories
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(c => c.name.toLowerCase().includes(q))
    }
    if (filterFormType) result = result.filter(c => c.form_type === filterFormType)
    if (filterStatus) result = result.filter(c => (filterStatus === 'active') === c.is_active)
    return result
  }, [categories, search, filterFormType, filterStatus])

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
          user_id: ownerId,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        })
      }
      setModalOpen(false)
      refresh()
      toast.success(editing ? 'Category updated' : 'Category created')
    } catch (error) {
      console.error('Error saving category:', error)
      toast.error('Failed to save category.')
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
      toast.success(!category.is_active ? 'Category activated' : 'Category deactivated')
    } catch (error) {
      console.error('Error toggling category status:', error)
      toast.error('Failed to update status.')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteDoc(doc(db, 'categories', deleteTarget.id))
      setDeleteTarget(null)
      refresh()
      toast.success('Category deleted')
    } catch (error) {
      console.error('Error deleting category:', error)
      toast.error('Failed to delete category.')
    } finally {
      setDeleting(false)
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
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="sm" aria-label={`Edit category ${row.name}`} onClick={(e) => { e.stopPropagation(); openEdit(row) }} className="p-2 h-auto rounded-full">
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="sm" aria-label={`Delete category ${row.name}`} onClick={(e) => { e.stopPropagation(); setDeleteTarget(row) }} className="p-2 h-auto text-slate-600 hover:text-danger hover:bg-danger-bg rounded-full">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
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

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-[14px] top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400/70" />
          <input
            type="search"
            placeholder="Search categories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-[46px] bg-[#fcfcfb] border border-[#e3e3de] rounded-[10px] pl-10 pr-[14px] text-[15px] text-ink placeholder:text-slate-400/70 focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary-bg transition-shadow"
          />
        </div>
        <Select
          aria-label="Filter by form type"
          value={filterFormType}
          onChange={(e) => setFilterFormType(e.target.value as FormType | '')}
          className="!w-auto min-w-[130px]"
        >
          <option value="">All Types</option>
          {Object.values(FormType).map(ft => (
            <option key={ft} value={ft}>{FORM_TYPE_LABELS[ft]}</option>
          ))}
        </Select>
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
        data={filteredCategories}
        columns={columns}
        keyField="id"
        onRowClick={(row) => openEdit(row)}
        onReorder={canReorder ? handleReorder : undefined}
        emptyMessage={
          loading
            ? 'Loading categories...'
            : filteredCategories.length === 0 && categories.length > 0
              ? 'No categories match your filters.'
              : 'No categories yet.'
        }
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={handleSave}
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

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete category"
        size="sm"
      >
        <p className="text-sm text-slate-600">
          Delete <span className="font-semibold text-ink">{deleteTarget?.name}</span>?
          This removes the category permanently. This cannot be undone.
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
