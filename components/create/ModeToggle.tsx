'use client'

import { Square, Layers } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ModeToggleProps {
  batch: boolean
  onChange: (batch: boolean) => void
}

const OPTIONS: { key: 'single' | 'batch'; label: string; icon: React.ElementType }[] = [
  { key: 'single', label: 'Single', icon: Square },
  { key: 'batch', label: 'Batch', icon: Layers },
]

/** Segmented control: tạo 1 thẻ (Single) hay nhiều thẻ 1 lượt (Batch). */
export function ModeToggle({ batch, onChange }: ModeToggleProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Creation mode"
      className="inline-flex gap-1 bg-[#ececea] rounded-[11px] p-1"
    >
      {OPTIONS.map(({ key, label, icon: Icon }) => {
        const isActive = (key === 'batch') === batch
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(key === 'batch')}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-[9px] rounded-[8px] text-[13.5px] font-bold transition-colors duration-150 outline-none',
              'focus-visible:ring-2 focus-visible:ring-primary/30',
              isActive
                ? 'bg-white text-primary shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
                : 'bg-transparent text-[#7c7f87] hover:text-ink',
            )}
          >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
          </button>
        )
      })}
    </div>
  )
}
