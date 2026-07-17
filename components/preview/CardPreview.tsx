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
  cardTypes?: CardTypeItem[]
  selectedCardTypeIds?: string[]
}

const DEFAULT_TAB: CardTypeItem = {
  id: '__default__',
  name: 'Word → Meaning',
  template: DEFAULT_TEMPLATES.word_to_meaning,
}

/**
 * Preview thẻ Anki ĐÚNG theo template của card type đã chọn (dùng chung renderSide + CSS với export).
 * Mỗi tab = một card type; bấm thẻ để lật xem mặt sau. Nếu chưa chọn card type nào → hiện 1 tab mặc định.
 */
export function CardPreview({ entry, audioUrl, cardTypes = [], selectedCardTypeIds = [] }: CardPreviewProps) {
  // Tabs = các card type đã chọn (giữ thứ tự trong cardTypes). Rỗng → 1 tab mặc định.
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
    const front = renderSide(template.front, entry, { side: 'front', audioFilename: 'preview', audioIcon: true })
    if (!flipped) return buildCardHtml(front)
    const back = renderSide(template.back, entry, { side: 'back', audioFilename: 'preview', audioIcon: true })
    return buildCardHtml(front, back)
  }, [template, entry, flipped])

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
      {/* Tabs — mỗi card type một tab */}
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

      {/* Thẻ render bằng iframe — bấm để lật mặt trước/sau */}
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

      {/* Nút phát audio (không thể tương tác trong iframe sandbox) */}
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
