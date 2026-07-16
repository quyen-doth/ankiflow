'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/components/providers/AuthProvider'
import { FieldWrapper, Select } from '@/components/ui/FormField'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { RefreshCw } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { getAnkiClientFromSettings } from '@/lib/flashcard-service/client'
import { regenerateNotesForEntry } from '@/lib/flashcard-service/client-ops'
import {
  prepareRuntimeContentTypes,
  resolveRuntimeContentTypeCode,
} from '@/lib/contentTypes'
import { loadUserContentTypes } from '@/lib/userContentTypes'
import { verifyAttrs } from '@/verify/core/contract'
import type { CardTypeItem } from '@/lib/buildNotes'
import type { Entry, UserContentType } from '@/types'

interface Option {
  value: string
  label: string
}

export interface ResyncOptions {
  contentTypes: UserContentType[]
  decks: Option[]
  cardTypes: Option[]
}

export type ResyncOptionsLoader = (uid: string) => Promise<ResyncOptions>

interface ResyncCardsProps {
  ankiConnected: boolean
  loadOptions?: ResyncOptionsLoader
}

const loadResyncOptions: ResyncOptionsLoader = async uid => {
  const [contentTypes, deckSnap, cardSnap] = await Promise.all([
    loadUserContentTypes(uid),
    getDocs(query(collection(db, 'decks'), where('user_id', '==', uid))),
    getDocs(query(collection(db, 'card_types'), where('user_id', '==', uid))),
  ])

  return {
    contentTypes,
    decks: deckSnap.docs.map(document => {
      const data = document.data() as {
        anki_deck_name?: string
        display_name?: string
        sort_order?: number
      }
      return {
        value: data.anki_deck_name || '',
        label: data.display_name || data.anki_deck_name || document.id,
        sort: data.sort_order || 0,
      }
    }).filter(option => option.value).sort((a, b) => a.sort - b.sort),
    cardTypes: cardSnap.docs.map(document => {
      const data = document.data() as { name?: string; sort_order?: number }
      return {
        value: document.id,
        label: data.name || document.id,
        sort: data.sort_order || 0,
      }
    }).sort((a, b) => a.sort - b.sort),
  }
}

export function ResyncCards({ ankiConnected, loadOptions = loadResyncOptions }: ResyncCardsProps) {
  const { user, loading: authLoading } = useAuth()
  const uid = user?.uid
  const [contentTypes, setContentTypes] = useState<Option[]>([])
  const [contentTypesLoading, setContentTypesLoading] = useState(true)
  const [contentTypeError, setContentTypeError] = useState<string | null>(null)
  const [contentTypeWarning, setContentTypeWarning] = useState<string | null>(null)
  const [decks, setDecks] = useState<Option[]>([])
  const [cardTypes, setCardTypes] = useState<Option[]>([])

  const [formType, setFormType] = useState('')
  const [deckName, setDeckName] = useState('')
  const [cardTypeId, setCardTypeId] = useState('')

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [running, setRunning] = useState(false)
  const toast = useToast()

  useEffect(() => {
    if (authLoading || !uid) return

    let cancelled = false
    const currentUid = uid

    async function fetchOptions() {
      try {
        setContentTypesLoading(true)
        setContentTypeError(null)
        // すべて user scope で読み込み、sort は composite index を避けるため client 側で行う。
        const loaded = await loadOptions(currentUid)
        if (cancelled) return

        const prepared = prepareRuntimeContentTypes(loaded.contentTypes)
        // 競合分だけ除外し、残りは再同期に使える。競合は非ブロッキング警告で通知。
        setContentTypeWarning(
          prepared.conflictingCodes.length > 0
            ? `Some Content Types share a routing code and were hidden: ${prepared.conflictingCodes.join(', ')}. Fix them in Settings.`
            : null,
        )
        const options = prepared.contentTypes.map(contentType => ({
          value: resolveRuntimeContentTypeCode(contentType.code),
          label: contentType.name || contentType.code,
        }))
        setContentTypes(options)
        setFormType(current => (
          current && !options.some(option => option.value === current) ? '' : current
        ))
        setDecks(loaded.decks)
        setCardTypes(loaded.cardTypes)
      } catch (error) {
        console.error('Error loading resync options:', error)
        if (!cancelled) {
          setContentTypes([])
          setFormType('')
          setContentTypeWarning(null)
          setContentTypeError('Unable to load your Content Types. Please try again or review them in Settings.')
        }
      } finally {
        if (!cancelled) setContentTypesLoading(false)
      }
    }
    void fetchOptions()

    return () => {
      cancelled = true
    }
  }, [uid, authLoading, loadOptions])

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
    <div
      {...verifyAttrs({
        unit: 'ResyncCards',
        contentTypesLoading,
        contentTypeState: contentTypeError ? 'error' : contentTypes.length > 0 ? 'ready' : 'empty',
        contentTypeWarning: !!contentTypeWarning,
      })}
    >
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

      {!contentTypesLoading && contentTypeWarning && (
        <p className="text-xs text-[#b87514] mb-3">
          {contentTypeWarning}{' '}
          <Link href="/settings" className="font-semibold underline underline-offset-2">
            Open Settings
          </Link>
        </p>
      )}

      {contentTypesLoading ? (
        <p className="text-xs text-slate-400 mb-3">Loading Content Types...</p>
      ) : contentTypeError ? (
        <p className="text-xs text-red-600 mb-3">
          {contentTypeError}{' '}
          <Link href="/settings" className="font-semibold underline underline-offset-2">
            Open Settings
          </Link>
        </p>
      ) : contentTypes.length === 0 ? (
        <p className="text-xs text-slate-500 mb-3">
          No active Content Types are configured.{' '}
          <Link href="/settings" className="font-semibold text-primary underline underline-offset-2">
            Manage them in Settings
          </Link>
        </p>
      ) : null}

      <Button
        variant="primary"
        size="sm"
        leftIcon={<RefreshCw className={running ? 'w-4 h-4 animate-spin' : 'w-4 h-4'} />}
        disabled={running || !ankiConnected || Boolean(contentTypeError)}
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
    </div>
  )
}
