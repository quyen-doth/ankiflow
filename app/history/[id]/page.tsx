'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { FlashcardReviewLayout } from '@/components/review/FlashcardReviewLayout'
import { Button } from '@/components/ui/Button'
import { useEntryEdit } from '@/hooks/useEntryEdit'
import { useCardMedia } from '@/hooks/useCardMedia'
import { useToast } from '@/components/ui/Toast'
import { ArrowLeft, Check } from 'lucide-react'
import type { Entry } from '@/types'

interface CardTypeItem {
  id: string
  name: string
  description?: string
}

export default function HistoryDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [entry, setEntry] = useState<Partial<Entry>>({})
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [cardTypes, setCardTypes] = useState<CardTypeItem[]>([])
  const [selectedCardTypeIds, setSelectedCardTypeIds] = useState<string[]>([])
  const [selectedDeckId, setSelectedDeckId] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  const { saveEntry } = useEntryEdit()
  const toast = useToast()

  useEffect(() => {
    async function load() {
      if (!id) return
      try {
        const snap = await getDoc(doc(db, 'entries', id))
        if (!snap.exists()) {
          setNotFound(true)
          return
        }
        const data = { id: snap.id, ...snap.data() } as Entry
        setEntry(data)

        // Card types theo form_type + language của entry
        try {
          const q = query(collection(db, 'card_types'), where('form_type', '==', data.form_type))
          const ctSnap = await getDocs(q)
          type Fetched = { id: string; name: string; description?: string; sort_order?: number; is_active?: boolean; language?: string | null }
          const fetched: Fetched[] = ctSnap.docs
            .map(d => ({ id: d.id, ...(d.data() as Omit<Fetched, 'id'>) }))
            .filter(ct => ct.is_active !== false && (!data.language || !ct.language || ct.language === data.language))
            .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
          setCardTypes(fetched.map(ct => ({ id: ct.id, name: ct.name, description: ct.description })))
          const preset = data.card_type_ids?.length
            ? data.card_type_ids.filter(cid => fetched.some(ct => ct.id === cid))
            : fetched.map(ct => ct.id)
          setSelectedCardTypeIds(preset)
        } catch (e) {
          console.error('Error fetching card types:', e)
        }
      } catch (error) {
        console.error('Failed to fetch entry detail:', error)
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  const handleDeckChange = useCallback(async (deckId: string) => {
    setSelectedDeckId(deckId)
    try {
      const deckSnap = await getDoc(doc(db, 'decks', deckId))
      if (deckSnap.exists()) {
        const ankiDeckName = (deckSnap.data() as Record<string, string>).anki_deck_name || deckId
        setEntry(prev => ({ ...prev, anki_deck: ankiDeckName }))
      }
    } catch (e) {
      console.error('Error fetching deck:', e)
    }
  }, [])

  const media = useCardMedia(entry, setEntry, !loading && !notFound && !!entry.id)

  const updateField = (field: keyof Entry, value: unknown) => {
    setEntry(prev => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    if (!entry.id) return
    setSaving(true)
    setSavedAt(null)
    try {
      const raw: Partial<Entry> = {
        word: entry.word,
        term: entry.term,
        title: entry.title,
        meaning_vi: entry.meaning_vi,
        definition: entry.definition,
        word_type: entry.word_type,
        hiragana: entry.hiragana,
        pinyin: entry.pinyin,
        ipa: entry.ipa,
        example_sentence: entry.example_sentence,
        example_translation: entry.example_translation,
        collocations: entry.collocations,
        image_url: entry.image_url,
        image_credit: entry.image_credit,
        audio_url: media.audioUrl ?? entry.audio_url,
        anki_deck: entry.anki_deck,
        card_type_ids: selectedCardTypeIds,
        category_id: entry.category_id ?? null,
      }
      // Firestore không nhận undefined — lọc bỏ
      const updates = Object.fromEntries(
        Object.entries(raw).filter(([, v]) => v !== undefined),
      ) as Partial<Entry>

      await saveEntry(entry as Entry, updates)
      setEntry(prev => ({ ...prev, ...updates }))
      setSavedAt(Date.now())
      toast.success('Đã lưu thay đổi')
    } catch (e) {
      console.error('Save error:', e)
      toast.error('Không lưu được thay đổi. Vui lòng thử lại.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-xl font-bold text-ink mb-2">Card not found</p>
          <p className="text-slate-600">This card may have been deleted or doesn&apos;t exist.</p>
        </div>
      </div>
    )
  }

  return (
    <FlashcardReviewLayout
      headerLabel="Card details"
      headerActions={
        <>
          {savedAt && <span className="text-[12px] text-primary font-medium mr-1">Saved</span>}
          <Button variant="secondary" onClick={() => router.push('/history')} leftIcon={<ArrowLeft className="w-4 h-4" />}>
            Back
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving} leftIcon={<Check className="w-4 h-4" />}>
            {saving ? 'Saving...' : 'Save changes'}
          </Button>
        </>
      }
      entry={entry}
      updateField={updateField}
      images={media.images}
      imageLoading={media.imageLoading}
      onImageSelect={media.handleImageSelect}
      onImageUpload={media.handleImageUpload}
      onImageRefetch={() => media.fetchImages()}
      audioUrl={media.audioUrl}
      audioLoading={media.audioLoading}
      onAudioRegenerate={media.generateAudio}
      audioSubtitle={`Google TTS · ${entry.language || 'en'}`}
      selectedDeckId={selectedDeckId}
      onDeckChange={handleDeckChange}
      cardTypes={cardTypes}
      selectedCardTypeIds={selectedCardTypeIds}
      onCardTypesChange={setSelectedCardTypeIds}
    />
  )
}
