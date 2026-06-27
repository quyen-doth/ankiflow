'use client'

import { useEffect } from 'react'
import { TriangleAlert, X } from 'lucide-react'
import { verifyAttrs } from '@/verify/core/contract'

interface DuplicateEntry {
  id: string
  word: string
  anki_deck: string
}

interface DuplicateModalProps {
  open: boolean
  onClose: () => void
  onProceed: () => void
  word: string
  /** Language code of the current flow (en/ja/zh); omit for non-language flows. */
  language?: string
  duplicates: DuplicateEntry[]
}

const LANG_LABELS: Record<string, string> = { en: 'EN', ja: 'JA', zh: 'ZH' }

function langBadge(language?: string): string | null {
  if (!language) return null
  return LANG_LABELS[language] || language.toUpperCase().slice(0, 2)
}

export function DuplicateModal({
  open,
  onClose,
  onProceed,
  word,
  language,
  duplicates,
}: DuplicateModalProps) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Enter' && !e.isComposing) {
        e.preventDefault()
        onProceed()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose, onProceed])

  if (!open) return null

  const badge = langBadge(language)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(20, 22, 24, 0.4)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      {...verifyAttrs({ unit: 'DuplicateModal', open, count: duplicates.length })}
    >
      <div className="w-[440px] max-w-full bg-white rounded-[16px] shadow-modal overflow-hidden">
        {/* Body */}
        <div className="px-6 pt-[22px] pb-[18px]">
          <div className="flex items-start gap-[14px]">
            <span className="w-[42px] h-[42px] rounded-[11px] bg-[rgba(184,117,20,0.1)] flex items-center justify-center flex-shrink-0">
              <TriangleAlert className="w-5 h-5 text-[#b87514]" />
            </span>
            <div className="flex-1 min-w-0">
              <h2 className="text-[16px] font-extrabold text-ink">Duplicate found</h2>
              <p className="text-[13.5px] text-[#7c7f87] mt-1 leading-[1.5]">
                &ldquo;{word}&rdquo; already exists in your collection. You can
                edit the existing card instead, or generate a new one anyway.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="w-[30px] h-[30px] rounded-[8px] bg-canvas text-slate-400 hover:text-ink flex items-center justify-center flex-shrink-0"
            >
              <X className="w-[17px] h-[17px]" />
            </button>
          </div>

          <div className="mt-[18px] flex flex-col gap-2">
            {duplicates.map((d) => (
              <div
                key={d.id}
                className="flex items-center gap-3 px-[14px] py-[13px] border border-[#eceae4] rounded-[11px] bg-[#fcfcfb]"
              >
                {badge && (
                  <span className="text-[10px] font-bold text-primary font-mono bg-[rgba(49,99,66,0.09)] rounded-[5px] px-2 py-[3px] flex-shrink-0">
                    {badge}
                  </span>
                )}
                <span className="text-[14px] font-bold text-ink truncate">{d.word}</span>
                <span className="ml-auto text-[12px] text-slate-400 font-mono truncate">{d.anki_deck}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-[10px] px-6 py-4 bg-[#fbfbfa] border-t border-[#f0f0ec]">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 text-center text-[13.5px] font-bold text-slate-600 bg-white border border-[#e3e3de] py-[11px] rounded-[9px] hover:bg-canvas transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onProceed}
            className="flex-1 text-center text-[13.5px] font-bold text-white bg-primary py-[11px] rounded-[9px] shadow-button hover:bg-primary-hover transition-colors"
          >
            Generate anyway
          </button>
        </div>
      </div>
    </div>
  )
}
