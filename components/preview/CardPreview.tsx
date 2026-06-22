'use client'

import { useState, useRef } from 'react'
import { cn } from '@/lib/utils'
import { Play, Square } from 'lucide-react'
import { verifyAttrs } from '@/verify/core/contract'
import type { Entry } from '@/types'

type CardTab = 'word_to_meaning' | 'meaning_to_word' | 'sentence'

const TABS: { id: CardTab; label: string }[] = [
  { id: 'word_to_meaning', label: 'Word → Meaning' },
  { id: 'meaning_to_word', label: 'Meaning → Word' },
  { id: 'sentence', label: 'Sentence' },
]

interface CardPreviewProps {
  entry: Partial<Entry>
  audioUrl?: string | null
}

export function CardPreview({ entry, audioUrl }: CardPreviewProps) {
  const [activeTab, setActiveTab] = useState<CardTab>('word_to_meaning')
  const [flipped, setFlipped] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const front = getFront(activeTab, entry)
  const back = getBack(activeTab, entry)

  const toggleAudio = (e: React.MouseEvent) => {
    e.stopPropagation()
    const url = audioUrl || entry.audio_url
    if (!url) return

    if (!audioRef.current) {
      audioRef.current = new Audio(url)
      audioRef.current.onended = () => setIsPlaying(false)
    }

    if (isPlaying) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      setIsPlaying(false)
    } else {
      audioRef.current.play()
      setIsPlaying(true)
    }
  }

  return (
    <div className="flex flex-col gap-4" {...verifyAttrs({ unit: 'CardPreview', tab: activeTab, flipped })}>
      {/* Tabs */}
      <div className="flex gap-1 bg-surface rounded-lg p-1">
        {TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => { setActiveTab(tab.id); setFlipped(false) }}
            className={cn(
              'flex-1 text-overline font-medium py-1.5 rounded-md transition-colors',
              activeTab === tab.id
                ? 'bg-white text-primary'
                : 'text-slate-600 hover:text-ink'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Card with 3D flip */}
      <div
        className="cursor-pointer select-none"
        style={{ perspective: '1000px' }}
        onClick={() => setFlipped(f => !f)}
        title="Click to flip"
      >
        <div
          className="relative w-full transition-transform duration-500 ease-in-out"
          style={{
            transformStyle: 'preserve-3d',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}
        >
          {/* Front */}
          <div
            className="bg-white rounded-card border border-border/30 p-6 min-h-36 flex flex-col items-center justify-center gap-2"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <p className="text-overline text-slate-600 uppercase tracking-wider mb-1">Front</p>
            <p className="text-2xl font-extrabold text-ink text-center">{front.primary || '—'}</p>
            {front.secondary && (
              <p className="text-sm text-slate-600 text-center">{front.secondary}</p>
            )}
            {(audioUrl || entry.audio_url) && (
              <button
                type="button"
                onClick={toggleAudio}
                className={cn(
                  'flex items-center gap-1.5 text-overline px-3 py-1 rounded-full border transition-colors mt-2',
                  isPlaying
                    ? 'border-primary text-primary bg-primary-bg'
                    : 'border-border/50 text-slate-600 hover:border-primary hover:text-primary'
                )}
              >
                {isPlaying ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                {isPlaying ? 'Stop' : 'Play'}
              </button>
            )}
          </div>

          {/* Back */}
          <div
            className="absolute inset-0 bg-surface rounded-card border border-border/30 p-6 min-h-36 flex flex-col items-center justify-center gap-2"
            style={{
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
            }}
          >
            <p className="text-overline text-slate-600 uppercase tracking-wider mb-1">Back</p>
            <p className="text-xl font-semibold text-ink text-center">{back.primary || '—'}</p>
            {back.secondary && (
              <p className="text-sm text-slate-600 text-center">{back.secondary}</p>
            )}

            {entry.image_url && (
              <div className="w-full mt-2 rounded-lg overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={entry.image_url}
                  alt="Illustration"
                  className="w-full h-24 object-cover rounded-lg"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hint */}
      <p className="text-overline text-slate-600 text-center">Click card to flip</p>
    </div>
  )
}

function getFront(tab: CardTab, e: Partial<Entry>): { primary: string; secondary?: string } {
  const word = e.word || e.term || e.title || ''
  switch (tab) {
    case 'word_to_meaning': return { primary: word, secondary: e.hiragana || e.pinyin || e.ipa }
    case 'meaning_to_word': return { primary: e.meaning_vi || e.definition || '' }
    case 'sentence':        return { primary: e.example_sentence || '' }
  }
}

function getBack(tab: CardTab, e: Partial<Entry>): { primary: string; secondary?: string } {
  const word = e.word || e.term || e.title || ''
  switch (tab) {
    case 'word_to_meaning': return { primary: e.meaning_vi || e.definition || '', secondary: e.word_type }
    case 'meaning_to_word': return { primary: word, secondary: e.hiragana || e.pinyin || e.ipa }
    case 'sentence':        return { primary: e.example_translation || '', secondary: word }
  }
}
