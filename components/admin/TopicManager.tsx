'use client'

import { useState, useEffect } from 'react'
import {
  collection, query, where, orderBy, getDocs,
  addDoc, updateDoc, doc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Card } from '@/components/ui/Card'
import { DataTable } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input, FieldWrapper } from '@/components/ui/FormField'
import { Plus, Pencil } from 'lucide-react'
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
  const [refreshKey, setRefreshKey] = useState(0)

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
    } catch (error) {
      console.error('Error saving topic:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (topic: Topic) => {
    try {
      await updateDoc(doc(db, 'topics', topic.id), { is_active: !topic.is_active, updated_at: serverTimestamp() })
      refresh()
    } catch (error) {
      console.error('Error toggling topic status:', error)
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
        <Button variant="ghost" size="sm" aria-label={`Edit topic ${row.name}`} onClick={(e) => { e.stopPropagation(); openEdit(row) }} className="p-2 h-auto rounded-full">
          <Pencil className="w-3.5 h-3.5" />
        </Button>
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

      <DataTable
        data={topics}
        columns={columns}
        keyField="id"
        emptyMessage={loading ? 'Loading topics...' : 'No topics yet.'}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Topic' : 'Add Topic'} size="sm">
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
    </Card>
  )
}
