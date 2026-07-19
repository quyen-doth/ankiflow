'use client'

import { AlertTriangle, X } from 'lucide-react'
import type { InvalidCard } from '@/lib/cardValidation'

interface ValidationBannerProps {
  invalid: InvalidCard[]
  /** click でエラーカードへジャンプ。 */
  onJump: (index: number) => void
  onDismiss?: () => void
  /** カード番号を隠す (単体 preview 用 — 1 枚のみ)。 */
  singleCard?: boolean
}

export function ValidationBanner({ invalid, onJump, onDismiss, singleCard }: ValidationBannerProps) {
  if (invalid.length === 0) return null

  return (
    <div className="rounded-[11px] border border-danger/40 bg-danger-bg px-4 py-3.5 mb-5" role="alert">
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="w-[18px] h-[18px] text-danger flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-[13.5px] font-bold text-danger mb-1.5">
            {singleCard
              ? "This card can't be exported yet"
              : `${invalid.length} card${invalid.length > 1 ? 's' : ''} can't be exported yet`}
          </p>
          <ul className="flex flex-col gap-1">
            {invalid.map(card => (
              <li key={card.index}>
                <button
                  type="button"
                  onClick={() => onJump(card.index)}
                  className="text-[12.5px] text-danger/90 hover:text-danger hover:underline text-left"
                >
                  {!singleCard && <span className="font-bold font-mono">Card #{card.index + 1}</span>}
                  {!singleCard && ' — '}
                  {card.errors.map(e => e.label).join(', ')}
                </button>
              </li>
            ))}
          </ul>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="text-danger/60 hover:text-danger flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}
