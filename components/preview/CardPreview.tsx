'use client'

import { useState, useRef } from 'react'
import { cn } from '@/lib/utils'
import { Play, Square, RotateCw } from 'lucide-react'
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
  const hasAudio = !!(audioUrl || entry.audio_url)

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
    <div
      className="bg-[#faf3e6] border border-[#efe0c6] rounded-[14px] p-[22px]"
      {...verifyAttrs({ unit: 'CardPreview', tab: activeTab, flipped })}
    >
      {/* Tabs */}
      <div className="flex gap-1 bg-[rgba(184,117,20,0.1)] rounded-[8px] p-1">
        {TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => { setActiveTab(tab.id); setFlipped(false) }}
            className={cn(
              'flex-1 text-center text-[12px] font-bold py-[7px] rounded-[6px] transition-colors',
              activeTab === tab.id ? 'bg-primary text-white' : 'text-[#9a7a3f] hover:text-[#7a5f2f]'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Card with 3D flip */}
      <div
        className="cursor-pointer select-none mt-4"
        style={{ perspective: '1000px' }}
        onClick={() => setFlipped(f => !f)}
        title="Click to flip"
      >
        <div
          className="relative w-full transition-transform duration-500 ease-in-out"
          style={{ transformStyle: 'preserve-3d', transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
        >
          {/* Front */}
          <div
            className="bg-white rounded-[12px] p-6 min-h-[160px] flex flex-col items-center justify-center gap-2 text-center"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <p className="text-[10px] font-bold tracking-[0.1em] uppercase font-mono text-slate-400">Front</p>
            <p className="text-[30px] font-extrabold text-ink tracking-[-0.02em] leading-none">{front.primary || '—'}</p>
            {front.secondary && (
              <p className="text-[14px] text-slate-400 font-mono">{front.secondary}</p>
            )}
            {hasAudio && (
              <button
                type="button"
                onClick={toggleAudio}
                className="inline-flex items-center gap-1.5 mt-2 bg-[rgba(49,99,66,0.08)] text-primary text-[12.5px] font-bold px-4 py-2 rounded-full hover:bg-[rgba(49,99,66,0.14)] transition-colors"
              >
                {isPlaying ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                {isPlaying ? 'Stop' : 'Play audio'}
              </button>
            )}
          </div>

          {/* Back */}
          <div
            className="absolute inset-0 bg-white rounded-[12px] p-6 min-h-[160px] flex flex-col items-center justify-center gap-2 text-center"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            <p className="text-[10px] font-bold tracking-[0.1em] uppercase font-mono text-slate-400">Back</p>
            <p className="text-[22px] font-bold text-ink text-center">{back.primary || '—'}</p>
            {back.secondary && (
              <p className="text-[14px] text-slate-400">{back.secondary}</p>
            )}
            {entry.image_url && (
              <div className="w-full mt-2 rounded-[8px] overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={entry.image_url} alt="Illustration" className="w-full h-24 object-cover rounded-[8px]" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hint */}
      <p className="flex items-center justify-center gap-1.5 text-[11.5px] text-[#9a7a3f] mt-3">
        <RotateCw className="w-[13px] h-[13px]" />
        Click card to flip
      </p>
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
