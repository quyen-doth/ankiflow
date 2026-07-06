'use client'

import { useState, useEffect } from 'react'
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/components/providers/AuthProvider'
import { FieldWrapper, Select } from '@/components/ui/FormField'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { RefreshCw } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { getAnkiClientFromSettings } from '@/lib/flashcard-service/client'
import { regenerateNotesForEntry } from '@/lib/flashcard-service/client-ops'
import type { CardTypeItem } from '@/lib/buildNotes'
import type { Entry } from '@/types'

interface Option {
  value: string
  label: string
}

interface ResyncCardsProps {
  ankiConnected: boolean
}

export function ResyncCards({ ankiConnected }: ResyncCardsProps) {
  const { user, loading: authLoading } = useAuth()
  const [contentTypes, setContentTypes] = useState<Option[]>([])
  const [decks, setDecks] = useState<Option[]>([])
  const [cardTypes, setCardTypes] = useState<Option[]>([])

  const [formType, setFormType] = useState('')
  const [deckName, setDeckName] = useState('')
  const [cardTypeId, setCardTypeId] = useState('')

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [running, setRunning] = useState(false)
  const toast = useToast()

  useEffect(() => {
    if (authLoading || !user) return
    const uid = user.uid
    async function fetchOptions() {
      try {
        // content_types SHARED (doc id = form_type routing); decks/card_types per-user
        // → sort in-memory để tránh composite index (user_id, sort_order)
        const [ctSnap, deckSnap, cardSnap] = await Promise.all([
          getDocs(query(collection(db, 'content_types'), orderBy('sort_order', 'asc'))),
          getDocs(query(collection(db, 'decks'), where('user_id', '==', uid))),
          getDocs(query(collection(db, 'card_types'), where('user_id', '==', uid))),
        ])
        // Filter theo form_type của entry — chính là DOC ID của content_type
        // (form_language/form_it/form_general), KHÔNG phải field `code`.
        setContentTypes(ctSnap.docs.map(d => {
          const data = d.data() as { name?: string }
          return { value: d.id, label: data.name || d.id }
        }).filter(o => o.label))
        setDecks(deckSnap.docs.map(d => {
          const data = d.data() as { anki_deck_name?: string; display_name?: string; sort_order?: number }
          return { value: data.anki_deck_name || '', label: data.display_name || data.anki_deck_name || d.id, sort: data.sort_order || 0 }
        }).filter(o => o.value).sort((a, b) => a.sort - b.sort))
        setCardTypes(cardSnap.docs.map(d => {
          const data = d.data() as { name?: string; sort_order?: number }
          return { value: d.id, label: data.name || d.id, sort: data.sort_order || 0 }
        }).sort((a, b) => a.sort - b.sort))
      } catch (error) {
        console.error('Error loading resync options:', error)
      }
    }
    fetchOptions()
  }, [user, authLoading])

  const handleRun = async () => {
    setConfirmOpen(false)
    setRunning(true)
    try {
      // 1. Lấy entry đã synced (theo filter) + card_types từ server (server không đụng Anki).
      const res = await fetch('/api/anki/resync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formType: formType || undefined,
          deckName: deckName || undefined,
          cardTypeId: cardTypeId || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Re-sync failed')
        return
      }

      const entries = (data.entries || []) as (Partial<Entry> & {
        anki_note_ids?: number[]
        card_type_ids?: string[]
      })[]
      const cardTypes = (data.cardTypes || []) as CardTypeItem[]

      if (entries.length === 0) {
        toast.success('No exported cards matched the filters')
        return
      }

      // 2. Sinh lại note trong Anki (browser → AnkiConnect) cho từng entry.
      const client = await getAnkiClientFromSettings()
      let updated = 0
      let skipped = 0
      let failed = 0
      for (const entry of entries) {
        try {
          const r = await regenerateNotesForEntry(client, entry, cardTypes, cardTypeId || undefined)
          updated += r.updated
          skipped += r.skipped
          failed += r.failed
        } catch {
          failed += entry.anki_note_ids?.length || 0
        }
      }

      const parts = [`Updated ${updated}`]
      if (skipped) parts.push(`skipped ${skipped}`)
      if (failed) parts.push(`failed ${failed}`)
      toast.success(parts.join(', '))
    } catch {
      toast.error('Cannot connect to AnkiConnect. Make sure Anki is open.')
    } finally {
      setRunning(false)
    }
  }

  return (
    <>
      <p className="text-sm text-slate-600 mb-4">
        Re-generate the Front/Back of already-exported cards to match the latest card type layout.
        Review history (SRS) and existing audio/images are preserved. Requires Anki Desktop to be open.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <FieldWrapper label="Content type">
          <Select aria-label="Content type" value={formType} onChange={(e) => setFormType(e.target.value)}>
            <option value="">All</option>
            {contentTypes.map(o => (<option key={o.value} value={o.value}>{o.label}</option>))}
          </Select>
        </FieldWrapper>
        <FieldWrapper label="Deck">
          <Select aria-label="Deck" value={deckName} onChange={(e) => setDeckName(e.target.value)}>
            <option value="">All</option>
            {decks.map(o => (<option key={o.value} value={o.value}>{o.label}</option>))}
          </Select>
        </FieldWrapper>
        <FieldWrapper label="Card type">
          <Select aria-label="Card type" value={cardTypeId} onChange={(e) => setCardTypeId(e.target.value)}>
            <option value="">All</option>
            {cardTypes.map(o => (<option key={o.value} value={o.value}>{o.label}</option>))}
          </Select>
        </FieldWrapper>
      </div>

      <Button
        variant="primary"
        size="sm"
        leftIcon={<RefreshCw className={running ? 'w-4 h-4 animate-spin' : 'w-4 h-4'} />}
        disabled={running || !ankiConnected}
        onClick={() => setConfirmOpen(true)}
      >
        {running ? 'Re-syncing...' : 'Re-sync cards'}
      </Button>
      {!ankiConnected && (
        <p className="text-xs text-slate-400 mt-2">Anki Desktop must be running to re-sync.</p>
      )}

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={handleRun} title="Re-sync cards" size="sm">
        <p className="text-sm text-slate-600">
          This overwrites the Front/Back of all matched exported cards in Anki with the latest layout.
          Review scheduling and existing media are kept. Continue?
        </p>
        <div className="flex gap-3 justify-end mt-5">
          <Button variant="ghost" onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button variant="primary" onClick={handleRun}>Re-sync</Button>
        </div>
      </Modal>
    </>
  )
}
