'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Entry } from '@/types'

interface CardTypeItem {
  id: string
  name: string
  code?: string
}

interface AnkiNote {
  deckName: string
  modelName: string
  fields: Record<string, string>
  tags?: string[]
}

interface AnkiExportOptions {
  entry: Partial<Entry>
  selectedCardTypeIds: string[]
  cardTypes?: CardTypeItem[]
}

interface AnkiExportState {
  confirmOpen: boolean
  setConfirmOpen: React.Dispatch<React.SetStateAction<boolean>>
  isExporting: boolean
  handleConfirm: () => Promise<void>
}

export function buildNotes(entry: Partial<Entry>, cardTypes: CardTypeItem[], audioFilename?: string): AnkiNote[] {
  const deckName = entry.anki_deck || 'Default'
  const word = entry.word || entry.term || entry.title || ''
  const reading = entry.hiragana || entry.pinyin || entry.ipa || ''
  const meaning = entry.meaning_vi || entry.definition || ''
  const wordType = entry.word_type || ''
  const example = entry.example_sentence || ''
  const translation = entry.example_translation || ''
  const tags = entry.tags || []
  const imageHtml = entry.image_url && !entry.image_url.startsWith('data:')
    ? `<img src="${entry.image_url}" style="max-height:200px">`
    : ''

  const audioTag = audioFilename ? `[sound:${audioFilename}]` : ''

  return cardTypes.map(ct => {
    const code = ct.code || ct.id
    let front = ''
    let back = ''

    switch (code) {
      case 'word_to_meaning':
        front = reading ? `${word}<br><small>${reading}</small>` : word
        back = `${meaning}${wordType ? `<br><small>${wordType}</small>` : ''}${imageHtml ? `<br>${imageHtml}` : ''}`
        break
      case 'meaning_to_word':
        front = meaning
        back = reading ? `${word}<br><small>${reading}</small>` : word
        break
      case 'audio_to_word':
        front = audioTag || word
        back = `${word}<br>${meaning}`
        break
      case 'image_to_word':
        front = imageHtml || '[image]'
        back = `${word}<br>${meaning}`
        break
      case 'fill_in_blank':
        if (example) {
          front = example.replace(new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '______')
          back = `${example}<br><small>${translation}</small>`
        } else {
          front = `______ = ${meaning}`
          back = word
        }
        break
      case 'reading_to_word':
        front = reading
        back = word
        break
      case 'word_to_reading':
        front = word
        back = reading
        break
      case 'concept_to_def':
        front = word
        back = meaning
        break
      case 'def_to_concept':
        front = meaning
        back = word
        break
      case 'front_to_back':
        front = word
        back = meaning
        break
      default:
        front = word
        back = meaning
        break
    }

    if (code !== 'audio_to_word' && audioTag) {
      back = `${back}<br>${audioTag}`
    }

    return {
      deckName,
      modelName: 'AnkiFlow-Basic',
      fields: { Front: front, Back: back },
      tags: [...tags, ...(entry.language ? [entry.language] : [])],
    }
  })
}

export function useAnkiExport({ entry, selectedCardTypeIds, cardTypes = [] }: AnkiExportOptions): AnkiExportState {
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const handleConfirm = async () => {
    setIsExporting(true)
    setConfirmOpen(false)

    try {
      // Step 0: Ensure AnkiFlow-Basic model exists
      try {
        await fetch('/api/anki/ensure-model', { method: 'POST' })
      } catch (e) {
        console.warn('Could not ensure AnkiFlow-Basic model:', e)
      }

      const selectedTypes = cardTypes.filter(ct => selectedCardTypeIds.includes(ct.id))

      // Step 1: Store audio in Anki media folder
      let audioFilename: string | undefined
      if (entry.audio_url && entry.audio_url.startsWith('data:audio')) {
        const base64 = entry.audio_url.split(',')[1]
        if (base64) {
          const word = entry.word || entry.term || entry.title || 'audio'
          const fname = `ankiflow_${word.replace(/[\s/\\:*?"<>|]/g, '_')}.mp3`
          try {
            const storeRes = await fetch('/api/audio/store', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ base64, filename: fname }),
            })
            if (storeRes.ok) {
              const storeData = await storeRes.json()
              audioFilename = storeData.filename || fname
            } else {
              console.warn('Audio store returned non-OK status:', storeRes.status)
            }
          } catch (e) {
            console.warn('Failed to store audio in Anki media — cards will export without audio:', e)
          }
        }
      }

      // Step 2: Build notes with audio embedded in all card types
      const notes = buildNotes(entry, selectedTypes, audioFilename)

      const entryData = {
        ...entry,
        card_type_ids: selectedCardTypeIds,
        status: 'exported',
      }

      // Step 3: Create notes in Anki
      const res = await fetch('/api/anki/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes, entryData }),
      })

      const noteCount = selectedTypes.length

      if (!res.ok) {
        const err = await res.json()
        console.error('Anki export failed:', err)
        alert(`Export failed: ${err.error || 'Unknown error'}`)
      } else {
        router.push(`/create?exported=1&count=${noteCount}`)
      }
    } catch (err) {
      console.error('Anki connection error:', err)
      alert('Could not connect to AnkiConnect. Please make sure Anki is open.')
    } finally {
      setIsExporting(false)
    }
  }

  return { confirmOpen, setConfirmOpen, isExporting, handleConfirm }
}
