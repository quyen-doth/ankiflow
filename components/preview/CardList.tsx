'use client'

import { Toggle } from '@/components/ui/Toggle'
import { cn } from '@/lib/utils'
import { verifyAttrs } from '@/verify/core/contract'

interface CardType {
  id: string
  name: string
  description?: string
}

interface CardListProps {
  cardTypes: CardType[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
}

export function CardList({ cardTypes, selectedIds, onChange }: CardListProps) {
  const toggle = (id: string, checked: boolean) => {
    onChange(checked ? [...selectedIds, id] : selectedIds.filter(v => v !== id))
  }

  return (
    <div {...verifyAttrs({ unit: 'CardList', count: cardTypes.length, selected: selectedIds.length })}>
      <p className="text-[11px] font-bold tracking-[0.04em] uppercase font-mono text-slate-400 mb-3">
        Card types to generate
      </p>

      <div className="flex flex-col gap-2.5">
        {cardTypes.map(ct => {
          const checked = selectedIds.includes(ct.id)
          return (
            <div
              key={ct.id}
              className={cn(
                'px-[13px] py-[11px] rounded-[10px] border transition-colors',
                checked ? 'border-[#cfe0d6] bg-[rgba(49,99,66,0.05)]' : 'border-border'
              )}
            >
              <Toggle
                bare
                label={ct.name}
                checked={checked}
                onChange={(v) => toggle(ct.id, v)}
              />
            </div>
          )
        })}
      </div>

      <div className="flex items-center justify-between mt-4 pt-3.5 border-t border-[#f0f0ec]">
        <span className="text-[12.5px] text-slate-400">Will create</span>
        <span className="text-[13px] font-bold text-primary font-mono">
          {selectedIds.length} card{selectedIds.length !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  )
}
