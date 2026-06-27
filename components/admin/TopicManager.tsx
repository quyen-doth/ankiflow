'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  collection, query, where, orderBy, getDocs,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Card } from '@/components/ui/Card'
import { DataTable } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input, FieldWrapper, Select } from '@/components/ui/FormField'
import { Plus, Pencil, Trash2, Search } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { verifyAttrs } from '@/verify/core/contract'
import { FormType } from '@/types'
import type { Topic } from '@/types'

interface TopicDraft {
  name: string
  sort_order: number
  is_active: boolean
}

const EMPTY_DRAFT: TopicDraft = { name: '', sort_order: 0, is_active: true }

export function TopicManager() {
  const [topics, setTopics] = useState<Topic[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Topic | null>(null)
  const [draft, setDraft] = useState<TopicDraft>(EMPTY_DRAFT)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Topic | null>(null)
  const [deleting, setDeleting] = useState(false)
  const toast = useToast()
  const [refreshKey, setRefreshKey] = useState(0)

  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'active' | 'inactive' | ''>('')

  useEffect(() => {
    async function fetchTopics() {
      setLoading(true)
      try {
        const q = query(collection(db, 'topics'), where('form_type', '==', FormType.IT), orderBy('sort_order', 'asc'))
        const snapshot = await getDocs(q)
        setTopics(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Topic)))
      } catch (error) {
        console.error('Error fetching topics:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchTopics()
  }, [refreshKey])

  const refresh = () => setRefreshKey(k => k + 1)

  const filteredTopics = useMemo(() => {
    let result = topics
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(t => t.name.toLowerCase().includes(q))
    }
    if (filterStatus) result = result.filter(t => (filterStatus === 'active') === t.is_active)
    return result
  }, [topics, search, filterStatus])

  const openCreate = () => {
    setEditing(null)
    setDraft(EMPTY_DRAFT)
    setModalOpen(true)
  }

  const openEdit = (topic: Topic) => {
    setEditing(topic)
    setDraft({ name: topic.name, sort_order: topic.sort_order, is_active: topic.is_active })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!draft.name.trim()) return
    setSaving(true)
    try {
      if (editing) {
        await updateDoc(doc(db, 'topics', editing.id), { ...draft, updated_at: serverTimestamp() })
      } else {
        await addDoc(collection(db, 'topics'), {
          ...draft,
          form_type: FormType.IT,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        })
      }
      setModalOpen(false)
      refresh()
      toast.success(editing ? 'Topic updated' : 'Topic created')
    } catch (error) {
      console.error('Error saving topic:', error)
      toast.error('Failed to save topic.')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (topic: Topic) => {
    try {
      await updateDoc(doc(db, 'topics', topic.id), { is_active: !topic.is_active, updated_at: serverTimestamp() })
      refresh()
      toast.success(!topic.is_active ? 'Topic activated' : 'Topic deactivated')
    } catch (error) {
      console.error('Error toggling topic status:', error)
      toast.error('Failed to update status.')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteDoc(doc(db, 'topics', deleteTarget.id))
      setDeleteTarget(null)
      refresh()
      toast.success('Topic deleted')
    } catch (error) {
      console.error('Error deleting topic:', error)
      toast.error('Failed to delete topic.')
    } finally {
      setDeleting(false)
    }
  }

  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (_: unknown, row: Topic) => <span className="font-semibold text-ink">{row.name}</span>,
    },
    {
      key: 'sort_order',
      header: 'Order',
      render: (_: unknown, row: Topic) => <span className="text-slate-600">{row.sort_order}</span>,
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (_: unknown, row: Topic) => (
        <button onClick={(e) => { e.stopPropagation(); handleToggleActive(row) }}>
          <Badge variant={row.is_active ? 'active' : 'inactive'}>{row.is_active ? 'Active' : 'Inactive'}</Badge>
        </button>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right' as const,
      render: (_: unknown, row: Topic) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="sm" aria-label={`Edit topic ${row.name}`} onClick={(e) => { e.stopPropagation(); openEdit(row) }} className="p-2 h-auto rounded-full">
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="sm" aria-label={`Delete topic ${row.name}`} onClick={(e) => { e.stopPropagation(); setDeleteTarget(row) }} className="p-2 h-auto text-slate-600 hover:text-danger hover:bg-danger-bg rounded-full">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <Card {...verifyAttrs({ unit: 'TopicManager', rows: topics.length, modalOpen, loading })}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-body font-bold font-semibold text-slate-600">Topics</h2>
        <Button variant="primary" size="sm" leftIcon={<Plus className="w-4 h-4" />} onClick={openCreate}>
          Add Topic
        </Button>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-[14px] top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400/70" />
          <input
            type="search"
            placeholder="Search topics..."
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
        data={filteredTopics}
        columns={columns}
        keyField="id"
        onRowClick={(row) => openEdit(row)}
        emptyMessage={
          loading
            ? 'Loading topics...'
            : filteredTopics.length === 0 && topics.length > 0
              ? 'No topics match your filters.'
              : 'No topics yet.'
        }
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} onConfirm={handleSave} title={editing ? 'Edit Topic' : 'Add Topic'} size="sm">
        <div className="flex flex-col gap-4">
          <FieldWrapper label="Name">
            <Input value={draft.name} onChange={(e) => setDraft(d => ({ ...d, name: e.target.value }))} placeholder="e.g. Frontend" />
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

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title="Delete topic" size="sm">
        <p className="text-sm text-slate-600">
          Delete <span className="font-semibold text-ink">{deleteTarget?.name}</span>?
          This removes the topic permanently. This cannot be undone.
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
