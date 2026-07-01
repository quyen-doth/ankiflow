'use client'

import { useState, useEffect } from 'react'
import { collection, getDocs, query, orderBy } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { FieldWrapper, Select } from '@/components/ui/FormField'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { RefreshCw } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

interface Option {
  value: string
  label: string
}

interface ResyncCardsProps {
  ankiConnected: boolean
}

export function ResyncCards({ ankiConnected }: ResyncCardsProps) {
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
    async function fetchOptions() {
      try {
        const [ctSnap, deckSnap, cardSnap] = await Promise.all([
          getDocs(query(collection(db, 'content_types'), orderBy('sort_order', 'asc'))),
          getDocs(query(collection(db, 'decks'), orderBy('sort_order', 'asc'))),
          getDocs(query(collection(db, 'card_types'), orderBy('sort_order', 'asc'))),
        ])
        // Filter theo form_type của entry — chính là DOC ID của content_type
        // (form_language/form_it/form_general), KHÔNG phải field `code`.
        setContentTypes(ctSnap.docs.map(d => {
          const data = d.data() as { name?: string }
          return { value: d.id, label: data.name || d.id }
        }).filter(o => o.label))
        setDecks(deckSnap.docs.map(d => {
          const data = d.data() as { anki_deck_name?: string; display_name?: string }
          return { value: data.anki_deck_name || '', label: data.display_name || data.anki_deck_name || d.id }
        }).filter(o => o.value))
        setCardTypes(cardSnap.docs.map(d => {
          const data = d.data() as { name?: string }
          return { value: d.id, label: data.name || d.id }
        }))
      } catch (error) {
        console.error('Error loading resync options:', error)
      }
    }
    fetchOptions()
  }, [])

  const handleRun = async () => {
    setConfirmOpen(false)
    setRunning(true)
    try {
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
      } else if (data.updated === 0 && data.scanned === 0) {
        toast.success('No exported cards matched the filters')
      } else {
        const parts = [`Updated ${data.updated}`]
        if (data.skipped) parts.push(`skipped ${data.skipped}`)
        if (data.failed) parts.push(`failed ${data.failed}`)
        toast.success(parts.join(', '))
      }
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
