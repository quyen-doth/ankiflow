'use client'

import { X } from 'lucide-react'

interface ClearSelectButtonProps {
  show: boolean
  onClear?: () => void
  label: string
}

/** dropdown の選択を解除する × ボタン (Select の chevron の隣に配置)。 */
export function ClearSelectButton({ show, onClear, label }: ClearSelectButtonProps) {
  if (!show || !onClear) return null
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation()
        onClear()
      }}
      className="absolute right-9 top-1/2 -translate-y-1/2 z-10 text-slate-400 hover:text-ink transition-colors"
    >
      <X className="w-3.5 h-3.5" />
    </button>
  )
}
