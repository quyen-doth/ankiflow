'use client'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Volume2 } from 'lucide-react'
import type { Entry } from '@/types'

interface WordDetailCardProps {
  entry: Entry
}

export function WordDetailCard({ entry }: WordDetailCardProps) {
  const word = entry.word || entry.term || entry.title || '—'
  const reading = entry.hiragana || entry.pinyin || entry.ipa
  const meaning = entry.meaning_vi || entry.definition || entry.content || '—'
  const isSynced = entry.status === 'synced'

  return (
    <div className="bg-white rounded-xl shadow-card border border-outline-var/40 border-l-[4px] border-l-primary p-6 lg:p-8">
      {/* Header: Status & Level */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-2">
          <Badge className={isSynced
            ? 'bg-primary/10 text-primary'
            : 'bg-tertiary-fixed text-on-tertiary-fixed'
          }>
            {isSynced ? 'Synced' : 'Pending sync'}
          </Badge>
          {entry.level && (
            <Badge className="bg-surface-high text-on-surface-var">
              {entry.level}
            </Badge>
          )}
        </div>
        <span className="text-sm text-on-surface-var font-medium">
          Deck: {entry.anki_deck || '—'}
        </span>
      </div>

      {/* Main Content */}
      <div className="flex flex-col gap-2 mb-8">
        {reading && (
          <span className="text-on-surface-var font-medium tracking-wide">
            {reading}
          </span>
        )}
        <div className="flex items-center gap-4">
          <h1 className="text-4xl lg:text-5xl font-serif font-bold text-on-surface">
            {word}
          </h1>
          {entry.audio_url && (
            <Button
              variant="ghost"
              className="p-3 rounded-full bg-surface-container text-primary hover:bg-surface-high"
              onClick={() => {
                const audio = new Audio(entry.audio_url)
                audio.play()
              }}
              title="Play audio"
            >
              <Volume2 className="w-5 h-5" />
            </Button>
          )}
        </div>
        <p className="text-xl text-on-surface-var mt-2">
          {meaning}
        </p>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-outline-var">
        {entry.word_type && (
          <div>
            <span className="block text-label-sm font-bold text-on-surface-var uppercase tracking-wider mb-1">Word Type</span>
            <span className="text-on-surface">{entry.word_type}</span>
          </div>
        )}
        {entry.example_sentence && (
          <div className="md:col-span-2">
            <span className="block text-label-sm font-bold text-on-surface-var uppercase tracking-wider mb-2">Example</span>
            <div className="bg-surface-container p-4 rounded-xl">
              <p className="text-on-surface font-medium mb-1">{entry.example_sentence}</p>
              {entry.example_translation && (
                <p className="text-on-surface-var text-sm">{entry.example_translation}</p>
              )}
            </div>
          </div>
        )}
        {entry.collocations && entry.collocations.length > 0 && (
          <div className="md:col-span-2">
            <span className="block text-label-sm font-bold text-on-surface-var uppercase tracking-wider mb-2">Collocations</span>
            <div className="flex flex-wrap gap-2">
              {entry.collocations.map((col, idx) => (
                <Badge key={idx} className="bg-white border border-outline-var text-on-surface-var px-3 py-1.5">
                  {col}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
