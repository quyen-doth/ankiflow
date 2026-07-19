'use client'

import { useRef, useEffect } from 'react'
import { Plus, X } from 'lucide-react'
import { verifyAttrs } from '@/verify/core/contract'

interface BatchItemListProps {
  /** メイン item 一覧 (各要素 = 作成される 1 カード)。 */
  items: string[]
  onChange: (items: string[]) => void
  label: string
  placeholder?: string
  hint?: string
}

/**
 * batch モード用のメイン入力 field リスト。キーボードだけで完結:
 * - 行内で Enter → 下に空行を追加 + focus。
 * - 空行で Backspace (>1 行の時) → 行を削除 + 前の行へ focus。
 * - "+ Add item" ボタンと × でマウス操作の追加/削除も可能。
 */
export function BatchItemList({ items, onChange, label, placeholder, hint }: BatchItemListProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const focusTarget = useRef<number | null>(null)

  // mount 時 (batch モード開始): カーソルを最初の入力行へ。
  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  // リスト変更後、マークされた行 (追加/削除) へ focus。
  useEffect(() => {
    if (focusTarget.current !== null) {
      inputRefs.current[focusTarget.current]?.focus()
      focusTarget.current = null
    }
  }, [items])

  const setItem = (index: number, value: string) => {
    const next = [...items]
    next[index] = value
    onChange(next)
  }

  const addItemAfter = (index: number) => {
    const next = [...items]
    next.splice(index + 1, 0, '')
    focusTarget.current = index + 1
    onChange(next)
  }

  const removeItem = (index: number) => {
    if (items.length <= 1) {
      onChange([''])
      focusTarget.current = 0
      return
    }
    const next = items.filter((_, i) => i !== index)
    focusTarget.current = Math.max(0, index - 1)
    onChange(next)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    // Generate shortcut は page 側の window handler に渡し、行追加として扱わない。
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) return

    if (e.key === 'Enter') {
      e.preventDefault()
      addItemAfter(index)
    } else if (e.key === 'Backspace' && items[index] === '' && items.length > 1) {
      e.preventDefault()
      removeItem(index)
    }
  }

  const nonEmptyCount = items.filter((it) => it.trim().length > 0).length

  return (
    <div {...verifyAttrs({ unit: 'BatchItemList', count: items.length, nonEmptyCount })}>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-[13px] font-bold text-ink">
          {label} <span className="text-danger">*</span>
        </label>
        <span className="text-[12px] font-mono text-slate-400">
          {nonEmptyCount} card{nonEmptyCount !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <span className="w-6 text-[12px] font-mono text-slate-400 text-right flex-shrink-0">
              {index + 1}.
            </span>
            <input
              ref={(el) => {
                inputRefs.current[index] = el
              }}
              type="text"
              aria-label={`${label} ${index + 1}`}
              value={item}
              onChange={(e) => setItem(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              placeholder={placeholder}
              className="flex-1 h-[44px] bg-[#fcfcfb] border border-[#e3e3de] rounded-[10px] px-[14px] text-[15px] font-semibold text-ink placeholder:text-slate-400/70 placeholder:font-normal focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary-bg transition-shadow"
            />
            <button
              type="button"
              aria-label={`Remove item ${index + 1}`}
              onClick={() => removeItem(index)}
              className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-[8px] text-slate-400 hover:text-danger hover:bg-danger-bg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => addItemAfter(items.length - 1)}
        className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-bold text-primary hover:text-primary/80 transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add item
      </button>

      {hint && <p className="text-[12px] text-slate-400 mt-2.5">{hint}</p>}
      <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px] text-slate-400 mt-3">
        <kbd className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[5px] border border-[#e3e3de] bg-[#fcfcfb] font-mono text-[11px] font-semibold text-slate-500">
          ⏎ Enter
        </kbd>
        <span>adds a row · shared config applies to all cards.</span>
      </p>
    </div>
  )
}
