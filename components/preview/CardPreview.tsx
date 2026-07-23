'use client'

import { useState, useRef, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Play, Square, RotateCw } from 'lucide-react'
import { verifyAttrs } from '@/verify/core/contract'
import { renderSide, DEFAULT_TEMPLATES } from '@/lib/anki/renderCard'
import { buildCardHtml, CardIframe } from '@/components/preview/CardHtmlPreview'
import type { Entry, CardTemplate } from '@/types'

interface CardTypeItem {
  id: string
  name: string
  template?: CardTemplate
}

interface CardPreviewProps {
  entry: Partial<Entry>
  audioUrl?: string | null
  audioExampleUrl?: string | null
  cardTypes?: CardTypeItem[]
  selectedCardTypeIds?: string[]
}

const DEFAULT_TAB: CardTypeItem = {
  id: '__default__',
  name: 'Word → Meaning',
  template: DEFAULT_TEMPLATES.word_to_meaning,
}

/**
 * 選択した card type の template どおりの Anki カード preview (renderSide + CSS を export と共用)。
 * 各 tab = 1 card type; カードをクリックで裏面へ反転。card type 未選択 → 既定 tab を 1 つ表示。
 */
export function CardPreview({
  entry,
  audioUrl,
  audioExampleUrl,
  cardTypes = [],
  selectedCardTypeIds = [],
}: CardPreviewProps) {
  // Tabs = 選択済み card type (cardTypes の順序を維持)。空 → 既定 tab 1 つ。
  const tabs = useMemo<CardTypeItem[]>(() => {
    const selected = cardTypes.filter(ct => selectedCardTypeIds.includes(ct.id))
    return selected.length > 0 ? selected : [DEFAULT_TAB]
  }, [cardTypes, selectedCardTypeIds])

  const [activeId, setActiveId] = useState<string>(tabs[0].id)
  const [flipped, setFlipped] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const active = tabs.find(t => t.id === activeId) ?? tabs[0]
  const template = active.template ?? DEFAULT_TEMPLATES.word_to_meaning

  const html = useMemo(() => {
    const media = {
      audioFilename: 'preview',
      audioExampleFilename: audioExampleUrl || entry.audio_example_url ? 'preview' : undefined,
      audioIcon: true,
    }
    const front = renderSide(template.front, entry, { ...media, side: 'front' })
    if (!flipped) return buildCardHtml(front)
    const back = renderSide(template.back, entry, { ...media, side: 'back' })
    return buildCardHtml(front, back)
  }, [template, entry, audioExampleUrl, flipped])

  const hasAudio = !!(audioUrl || entry.audio_url)

  const toggleAudio = () => {
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
      {...verifyAttrs({ unit: 'CardPreview', tab: activeId, flipped })}
    >
      {/* Tabs — card type ごとに 1 tab */}
      {tabs.length > 1 && (
        <div className="flex flex-wrap gap-1 bg-[rgba(184,117,20,0.1)] rounded-[8px] p-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => { setActiveId(tab.id); setFlipped(false) }}
              className={cn(
                'flex-1 text-center text-[12px] font-bold py-[7px] px-2 rounded-[6px] transition-colors truncate min-w-0',
                activeId === tab.id ? 'bg-primary text-white' : 'text-[#9a7a3f] hover:text-[#7a5f2f]',
              )}
            >
              {tab.name}
            </button>
          ))}
        </div>
      )}

      {/* iframe で render するカード — クリックで表裏を反転 */}
      <div
        className="relative select-none mt-4 rounded-[12px] overflow-hidden border border-[#efe0c6]"
      >
        <CardIframe html={html} />
        {/* iframe 内の click は親へ bubble しないため、透明な button で全面を覆う。 */}
        <button
          type="button"
          className="absolute inset-0 z-[1] cursor-pointer rounded-[12px] bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
          onClick={() => setFlipped(f => !f)}
          title="Click to flip"
          aria-label={flipped ? 'Show card front' : 'Reveal card answer'}
          aria-pressed={flipped}
        />
      </div>

      {/* audio 再生ボタン (iframe sandbox 内では操作できないため外に配置) */}
      {hasAudio && (
        <button
          type="button"
          onClick={toggleAudio}
          className="w-full inline-flex items-center justify-center gap-1.5 mt-3 bg-[rgba(49,99,66,0.08)] text-primary text-[12.5px] font-bold px-4 py-2 rounded-full hover:bg-[rgba(49,99,66,0.14)] transition-colors"
        >
          {isPlaying ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          {isPlaying ? 'Stop' : 'Play audio'}
        </button>
      )}

      {/* Hint */}
      <p className="flex items-center justify-center gap-1.5 text-[11.5px] text-[#9a7a3f] mt-3">
        <RotateCw className="w-[13px] h-[13px]" />
        {flipped ? 'Click card to show front' : 'Click card to reveal answer'}
      </p>
    </div>
  )
}
