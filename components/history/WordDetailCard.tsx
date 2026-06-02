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
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 border-l-[6px] border-l-[#316342] p-6 lg:p-8">
      {/* Header: Status & Level */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-2">
          <Badge className={isSynced ? 'bg-[#E3F2E8] text-[#1B4D3E]' : 'bg-[#FFF3CD] text-[#856404]'}>
            {isSynced ? 'Đã đồng bộ' : 'Chờ đồng bộ'}
          </Badge>
          {entry.level && (
            <Badge className="bg-[#F6F4EF] text-gray-700">
              {entry.level}
            </Badge>
          )}
        </div>
        <span className="text-sm text-gray-400 font-medium">
          Deck: {entry.anki_deck || '—'}
        </span>
      </div>

      {/* Main Content */}
      <div className="flex flex-col gap-2 mb-8">
        {reading && (
          <span className="text-gray-500 font-medium tracking-wide">
            {reading}
          </span>
        )}
        <div className="flex items-center gap-4">
          <h1 className="text-4xl lg:text-5xl font-serif font-bold text-gray-900">
            {word}
          </h1>
          {entry.audio_url && (
            <Button
              variant="ghost"
              className="p-3 rounded-full bg-[#F6F4EF] text-[#316342] hover:bg-[#EFECE5]"
              onClick={() => {
                const audio = new Audio(entry.audio_url)
                audio.play()
              }}
              title="Phát âm thanh"
            >
              <Volume2 className="w-5 h-5" />
            </Button>
          )}
        </div>
        <p className="text-xl text-gray-700 mt-2">
          {meaning}
        </p>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-gray-100">
        {entry.word_type && (
          <div>
            <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Loại từ</span>
            <span className="text-gray-800">{entry.word_type}</span>
          </div>
        )}
        {entry.example_sentence && (
          <div className="md:col-span-2">
            <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Ví dụ</span>
            <div className="bg-[#FAF8F5] p-4 rounded-xl">
              <p className="text-gray-900 font-medium mb-1">{entry.example_sentence}</p>
              {entry.example_translation && (
                <p className="text-gray-600 text-sm">{entry.example_translation}</p>
              )}
            </div>
          </div>
        )}
        {entry.collocations && entry.collocations.length > 0 && (
          <div className="md:col-span-2">
            <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Collocations</span>
            <div className="flex flex-wrap gap-2">
              {entry.collocations.map((col, idx) => (
                <Badge key={idx} className="bg-white border border-gray-200 text-gray-700 px-3 py-1.5">
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
