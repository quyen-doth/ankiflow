'use client'

import { useState, useEffect } from 'react'
import {
  collection, query, orderBy, getDocs,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Card } from '@/components/ui/Card'
import { DataTable } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input, FieldWrapper } from '@/components/ui/FormField'
import { Plus, Pencil, Trash2, Bell, Send } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import type { NotificationTrigger, DeckConfig } from '@/types'

interface TriggerDraft {
  name: string
  schedule_hours: number[]
  timezone: string
  deck_filter: string[]
  language_filter: string[]
  words_per_notification: number
  is_active: boolean
}

const EMPTY_DRAFT: TriggerDraft = {
  name: '',
  schedule_hours: [8, 12, 20],
  timezone: 'Asia/Ho_Chi_Minh',
  deck_filter: [],
  language_filter: [],
  words_per_notification: 3,
  is_active: true,
}

const HOURS = Array.from({ length: 17 }, (_, i) => i + 6) // 6-22

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'ja', label: 'Japanese' },
  { value: 'zh', label: 'Chinese' },
]

export function NotificationManager() {
  const [triggers, setTriggers] = useState<NotificationTrigger[]>([])
  const [decks, setDecks] = useState<DeckConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<NotificationTrigger | null>(null)
  const [draft, setDraft] = useState<TriggerDraft>(EMPTY_DRAFT)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<NotificationTrigger | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [testing, setTesting] = useState(false)
  const toast = useToast()
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const [triggerSnap, deckSnap] = await Promise.all([
          getDocs(query(collection(db, 'notification_triggers'), orderBy('name', 'asc'))),
          getDocs(query(collection(db, 'decks'), orderBy('sort_order', 'asc'))),
        ])
        setTriggers(triggerSnap.docs.map(d => ({ id: d.id, ...d.data() }) as NotificationTrigger))
        setDecks(deckSnap.docs.map(d => ({ id: d.id, ...d.data() }) as DeckConfig))
      } catch (error) {
        console.error('Error fetching triggers:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [refreshKey])

  const refresh = () => setRefreshKey(k => k + 1)

  const openCreate = () => {
    setEditing(null)
    setDraft(EMPTY_DRAFT)
    setModalOpen(true)
  }

  const openEdit = (trigger: NotificationTrigger) => {
    setEditing(trigger)
    setDraft({
      name: trigger.name,
      schedule_hours: trigger.schedule_hours,
      timezone: trigger.timezone,
      deck_filter: trigger.deck_filter,
      language_filter: trigger.language_filter,
      words_per_notification: trigger.words_per_notification,
      is_active: trigger.is_active,
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!draft.name.trim()) return
    setSaving(true)
    try {
      if (editing) {
        await updateDoc(doc(db, 'notification_triggers', editing.id), {
          ...draft,
          updated_at: serverTimestamp(),
        })
      } else {
        await addDoc(collection(db, 'notification_triggers'), {
          ...draft,
          type: 'vocab_review',
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        })
      }
      setModalOpen(false)
      refresh()
      toast.success(editing ? 'Trigger updated' : 'Trigger created')
    } catch (error) {
      console.error('Error saving trigger:', error)
      toast.error('Failed to save trigger.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteDoc(doc(db, 'notification_triggers', deleteTarget.id))
      setDeleteTarget(null)
      refresh()
      toast.success('Trigger deleted')
    } catch (error) {
      console.error('Error deleting trigger:', error)
      toast.error('Failed to delete trigger.')
    } finally {
      setDeleting(false)
    }
  }

  const handleToggleActive = async (trigger: NotificationTrigger) => {
    try {
      await updateDoc(doc(db, 'notification_triggers', trigger.id), {
        is_active: !trigger.is_active,
        updated_at: serverTimestamp(),
      })
      refresh()
      toast.success(!trigger.is_active ? 'Trigger activated' : 'Trigger deactivated')
    } catch (error) {
      console.error('Error toggling trigger:', error)
      toast.error('Failed to update status.')
    }
  }

  const handleTestSend = async () => {
    setTesting(true)
    try {
      const res = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 3 }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`Sent ${data.sent} words: ${data.words?.join(', ') ?? ''}`)
      } else {
        toast.error(data.error ?? 'Send failed')
      }
    } catch (error) {
      console.error('Test send error:', error)
      toast.error('Failed to send test notification.')
    } finally {
      setTesting(false)
    }
  }

  const toggleHour = (hour: number) => {
    setDraft(d => ({
      ...d,
      schedule_hours: d.schedule_hours.includes(hour)
        ? d.schedule_hours.filter(h => h !== hour)
        : [...d.schedule_hours, hour].sort((a, b) => a - b),
    }))
  }

  const toggleDeck = (deckName: string) => {
    setDraft(d => ({
      ...d,
      deck_filter: d.deck_filter.includes(deckName)
        ? d.deck_filter.filter(n => n !== deckName)
        : [...d.deck_filter, deckName],
    }))
  }

  const toggleLanguage = (lang: string) => {
    setDraft(d => ({
      ...d,
      language_filter: d.language_filter.includes(lang)
        ? d.language_filter.filter(l => l !== lang)
        : [...d.language_filter, lang],
    }))
  }

  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (_: unknown, row: NotificationTrigger) => (
        <div>
          <span className="font-semibold text-ink">{row.name}</span>
          <span className="block text-xs text-slate-400 mt-0.5">
            {row.schedule_hours.map(h => `${h}:00`).join(', ')}
          </span>
        </div>
      ),
    },
    {
      key: 'words',
      header: 'Words',
      render: (_: unknown, row: NotificationTrigger) => (
        <span className="text-slate-600">{row.words_per_notification}</span>
      ),
    },
    {
      key: 'filters',
      header: 'Filters',
      render: (_: unknown, row: NotificationTrigger) => {
        const parts: string[] = []
        if (row.deck_filter.length > 0) parts.push(`${row.deck_filter.length} decks`)
        if (row.language_filter.length > 0) parts.push(row.language_filter.join(', ').toUpperCase())
        return <span className="text-xs text-slate-400 font-mono">{parts.join(' · ') || 'All'}</span>
      },
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (_: unknown, row: NotificationTrigger) => (
        <button onClick={(e) => { e.stopPropagation(); handleToggleActive(row) }}>
          <Badge variant={row.is_active ? 'active' : 'inactive'}>{row.is_active ? 'Active' : 'Inactive'}</Badge>
        </button>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right' as const,
      render: (_: unknown, row: NotificationTrigger) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="sm" aria-label={`Edit trigger ${row.name}`} onClick={(e) => { e.stopPropagation(); openEdit(row) }} className="p-2 h-auto rounded-full">
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="sm" aria-label={`Delete trigger ${row.name}`} onClick={(e) => { e.stopPropagation(); setDeleteTarget(row) }} className="p-2 h-auto text-slate-600 hover:text-danger hover:bg-danger-bg rounded-full">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-slate-400" />
          <h2 className="text-body font-bold font-semibold text-slate-600">Notification Triggers</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" leftIcon={<Send className="w-3.5 h-3.5" />} onClick={handleTestSend} disabled={testing}>
            {testing ? 'Sending...' : 'Test Send'}
          </Button>
          <Button variant="primary" size="sm" leftIcon={<Plus className="w-4 h-4" />} onClick={openCreate}>
            Add Trigger
          </Button>
        </div>
      </div>

      <DataTable
        data={triggers}
        columns={columns}
        keyField="id"
        onRowClick={(row) => openEdit(row)}
        emptyMessage={loading ? 'Loading triggers...' : 'No notification triggers yet.'}
      />

      {/* Create/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} onConfirm={handleSave} title={editing ? 'Edit Trigger' : 'Add Trigger'} size="lg">
        <div className="flex flex-col gap-5">
          <FieldWrapper label="Name">
            <Input value={draft.name} onChange={(e) => setDraft(d => ({ ...d, name: e.target.value }))} placeholder="e.g. Morning Review" />
          </FieldWrapper>

          <FieldWrapper label="Words per notification">
            <Input
              type="number"
              min={1}
              max={10}
              value={draft.words_per_notification}
              onChange={(e) => setDraft(d => ({ ...d, words_per_notification: Number(e.target.value) }))}
            />
          </FieldWrapper>

          {/* Schedule hours */}
          <div>
            <label className="block text-sm font-semibold text-ink mb-2">Schedule Hours</label>
            <div className="flex flex-wrap gap-1.5">
              {HOURS.map(h => (
                <button
                  key={h}
                  type="button"
                  onClick={() => toggleHour(h)}
                  className={`px-2.5 py-1.5 text-xs font-mono rounded-lg border transition-colors ${
                    draft.schedule_hours.includes(h)
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white text-slate-600 border-[#e3e3de] hover:border-primary'
                  }`}
                >
                  {h}:00
                </button>
              ))}
            </div>
          </div>

          {/* Deck filter */}
          <div>
            <label className="block text-sm font-semibold text-ink mb-2">Deck Filter <span className="text-xs font-normal text-slate-400">(empty = all decks)</span></label>
            <div className="flex flex-wrap gap-1.5">
              {decks.filter(d => d.is_active).map(deck => (
                <button
                  key={deck.id}
                  type="button"
                  onClick={() => toggleDeck(deck.anki_deck_name)}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                    draft.deck_filter.includes(deck.anki_deck_name)
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white text-slate-600 border-[#e3e3de] hover:border-primary'
                  }`}
                >
                  {deck.display_name}
                </button>
              ))}
            </div>
          </div>

          {/* Language filter */}
          <div>
            <label className="block text-sm font-semibold text-ink mb-2">Language Filter <span className="text-xs font-normal text-slate-400">(empty = all languages)</span></label>
            <div className="flex gap-2">
              {LANGUAGES.map(lang => (
                <button
                  key={lang.value}
                  type="button"
                  onClick={() => toggleLanguage(lang.value)}
                  className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                    draft.language_filter.includes(lang.value)
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white text-slate-600 border-[#e3e3de] hover:border-primary'
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 justify-end mt-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSave} disabled={saving || !draft.name.trim()}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title="Delete trigger" size="sm">
        <p className="text-sm text-slate-600">
          Delete <span className="font-semibold text-ink">{deleteTarget?.name}</span>?
          This removes the trigger permanently. This cannot be undone.
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
