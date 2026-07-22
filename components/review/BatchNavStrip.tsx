'use client'

import { motion } from 'framer-motion'
import { Check, AlertCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { staggerContainer, staggerItem } from '@/lib/motion'
import { validateCardEntry } from '@/lib/cardValidation'
import type { Entry } from '@/types'

interface BatchNavStripProps {
  entries: Partial<Entry>[]
  selectedCardTypeIds: string[]
  activeIndex: number
  onSelect: (index: number) => void
  /** chip の × から該当カードの破棄を要求する (確認は呼び出し側)。 */
  onDiscard?: (index: number) => void
}

/**
 * batch 内カードのナビゲーション chip バー。各 chip は番号 + validateCardEntry による
 * 有効状態 (緑 = field 充足 / 赤 = 不足) を表示。現在の chip は強調される。
 */
export function BatchNavStrip({ entries, selectedCardTypeIds, activeIndex, onSelect, onDiscard }: BatchNavStripProps) {
  return (
    <motion.div
      className="flex flex-wrap items-center gap-2"
      role="tablist"
      aria-label="Batch cards"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      {entries.map((entry, index) => {
        const isValid = validateCardEntry(entry, selectedCardTypeIds).length === 0
        const isActive = index === activeIndex
        const label = entry.word || entry.term || entry.title || `Card ${index + 1}`
        return (
          <motion.button
            key={index}
            type="button"
            role="tab"
            variants={staggerItem}
            whileTap={{ scale: 0.96 }}
            aria-selected={isActive}
            aria-label={`Card ${index + 1}: ${label}${isValid ? '' : ' (incomplete)'}`}
            onClick={() => onSelect(index)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12.5px] font-bold border transition-colors max-w-[180px]',
              isActive
                ? 'border-primary bg-primary-bg text-primary'
                : isValid
                  ? 'border-border bg-white text-slate-600 hover:border-primary/40'
                  : 'border-danger/50 bg-danger-bg/40 text-danger hover:border-danger',
            )}
          >
            <span
              className={cn(
                'inline-flex items-center justify-center w-4 h-4 rounded-full flex-shrink-0',
                isValid ? 'text-primary' : 'text-danger',
              )}
            >
              {isValid ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
            </span>
            <span className="truncate">
              {index + 1}. {label}
            </span>
            {onDiscard && (
              // button 内に button は置けない (invalid HTML) → span[role=button] で代替。
              <span
                role="button"
                aria-label={`Discard card ${index + 1}`}
                onClick={(e) => {
                  e.stopPropagation()
                  onDiscard(index)
                }}
                className="inline-flex items-center justify-center w-4 h-4 rounded-full flex-shrink-0 text-slate-400 hover:text-danger hover:bg-danger-bg transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </span>
            )}
          </motion.button>
        )
      })}
    </motion.div>
  )
}
