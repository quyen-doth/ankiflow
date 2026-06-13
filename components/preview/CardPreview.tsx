'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
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
}

export function CardPreview({ entry }: CardPreviewProps) {
  const [activeTab, setActiveTab] = useState<CardTab>('word_to_meaning')
  const [flipped, setFlipped] = useState(false)

  const front = getFront(activeTab, entry)
  const back = getBack(activeTab, entry)

  return (
    <div className="flex flex-col gap-4" {...verifyAttrs({ unit: 'CardPreview', tab: activeTab, flipped })}>
      {/* Tabs */}
      <div className="flex gap-1 bg-surface-low rounded-lg p-1">
        {TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => { setActiveTab(tab.id); setFlipped(false) }}
            className={cn(
              'flex-1 text-label-sm font-medium py-1.5 rounded-md transition-colors',
              activeTab === tab.id
                ? 'bg-white text-primary shadow-card'
                : 'text-on-surface-var hover:text-on-surface'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Card */}
      <div
        className="cursor-pointer select-none"
        onClick={() => setFlipped(f => !f)}
        title="Click to flip"
      >
        {!flipped ? (
          // Front card
          <div className="bg-white rounded-xl shadow-card border border-outline-var/30 p-6 min-h-36 flex flex-col items-center justify-center gap-2">
            <p className="text-label-sm text-on-surface-var uppercase tracking-wider mb-1">Front</p>
            <p className="text-2xl font-serif text-on-surface text-center">{front.primary || '—'}</p>
            {front.secondary && (
              <p className="text-sm text-on-surface-var text-center">{front.secondary}</p>
            )}
          </div>
        ) : (
          // Back card
          <div className="bg-surface-low rounded-xl border border-outline-var/30 p-6 min-h-36 flex flex-col items-center justify-center gap-2">
            <p className="text-label-sm text-on-surface-var uppercase tracking-wider mb-1">Back</p>
            <p className="text-xl font-semibold text-on-surface text-center">{back.primary || '—'}</p>
            {back.secondary && (
              <p className="text-sm text-on-surface-var text-center">{back.secondary}</p>
            )}
          </div>
        )}
      </div>
      <p className="text-label-sm text-center text-on-surface-var">Click card to flip</p>
    </div>
  )
}

// Helper: tạo nội dung front/back theo tab
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
