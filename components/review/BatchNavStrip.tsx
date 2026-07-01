'use client'

import { motion } from 'framer-motion'
import { Check, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { staggerContainer, staggerItem } from '@/lib/motion'
import { validateCardEntry } from '@/lib/cardValidation'
import type { Entry } from '@/types'

interface BatchNavStripProps {
  entries: Partial<Entry>[]
  selectedCardTypeIds: string[]
  activeIndex: number
  onSelect: (index: number) => void
}

/**
 * Thanh chip điều hướng các thẻ trong batch. Mỗi chip hiển thị số thứ tự + trạng thái
 * hợp lệ (xanh = đủ field / đỏ = thiếu) theo validateCardEntry. Chip hiện tại nổi bật.
 */
export function BatchNavStrip({ entries, selectedCardTypeIds, activeIndex, onSelect }: BatchNavStripProps) {
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
          </motion.button>
        )
      })}
    </motion.div>
  )
}
