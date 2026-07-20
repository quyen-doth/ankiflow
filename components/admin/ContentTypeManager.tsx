'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  collection, query, where, getDocs,
  updateDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Card } from '@/components/ui/Card'
import { DataTable } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/FormField'
import { ContentTypeEditor } from '@/components/admin/ContentTypeEditor'
import { Pencil, Plus, Trash2, Search } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/components/providers/AuthProvider'
import { useSortableList } from '@/hooks/useSortableList'
import { verifyAttrs } from '@/verify/core/contract'
import { isProtectedGlobalContentTypeId } from '@/lib/contentTypes'
import {
  GLOBAL_CONTENT_TYPES_COLLECTION,
  USER_CONTENT_TYPES_COLLECTION,
} from '@/lib/constants'
import type { ContentType } from '@/types'

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
    setModalOpen(true)
  }

  const openEdit = (contentType: ContentType) => {
    setEditing(contentType)
    setModalOpen(true)
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
        title={editing ? `Edit — ${editing.name}` : 'Add Content Type'}
        size="lg"
      >
        <div className="flex flex-col gap-4 max-h-[60vh] overflow-y-auto pr-1">
          <ContentTypeEditor
            key={editing?.id ?? 'new'}
            contentType={editing}
            scope={isGlobalScope ? 'global-defaults' : 'workspace'}
            existingCodes={contentTypes.map(ct => ct.code)}
            onSaved={() => {
              setModalOpen(false)
              refresh()
            }}
            onCancel={() => setModalOpen(false)}
          />
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
