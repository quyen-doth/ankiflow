'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Plus, Check, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { dropdownPanel } from '@/lib/motion'

export interface CreatableOption {
  id: string
  label: string
}

interface CreatableSelectProps {
  options: CreatableOption[]
  value: string
  onChange: (id: string) => void
  /** user が `query` から新規選択肢の作成を要求した時に呼ばれる。 */
  onCreate: (query: string) => void | Promise<void>
  onClear?: () => void
  placeholder?: string
  /** "作成" 行のラベル (例: "deck"、"category")。 */
  createNoun?: string
  /** true = キーワード入力必須で作成可能 (例: category は即作成に名前が必要)。 */
  createNeedsQuery?: boolean
  loading?: boolean
  disabled?: boolean
  creating?: boolean
  ariaLabel?: string
}

/**
 * 検索 + その場で新規作成できる pulldown (creatable combobox)。
 * - 既存の選択肢を表示し、キーワードで filter。
 * - どの選択肢にも一致しない入力 → "+ Create '<word>'" 行を表示。
 * - キーボード: ↑/↓ 移動、Enter 選択/作成、Esc 閉じる。
 */
export function CreatableSelect({
  options,
  value,
  onChange,
  onCreate,
  onClear,
  placeholder = 'Select…',
  createNoun = 'item',
  createNeedsQuery = false,
  loading = false,
  disabled = false,
  creating = false,
  ariaLabel,
}: CreatableSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = options.find(o => o.id === value)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter(o => o.label.toLowerCase().includes(q))
  }, [options, query])

  const exactMatch = useMemo(
    () => options.some(o => o.label.trim().toLowerCase() === query.trim().toLowerCase()),
    [options, query],
  )
  const canCreate = query.trim().length > 0 && !exactMatch

  // 外側 click で閉じる。
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // 開いた時に検索欄へ focus (DOM side-effect のみ、setState なし)。
  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus())
  }, [open])

  const openPanel = () => {
    setQuery('')
    setHighlight(0)
    setOpen(true)
  }

  const selectOption = (id: string) => {
    onChange(id)
    setOpen(false)
  }

  const doCreate = async () => {
    if (!canCreate) return
    await onCreate(query.trim())
    setOpen(false)
  }

  // "New …" ボタンは常時表示: キーワードあり → その語で作成; 空欄 → blank 作成
  // (deck は popup を開く) または検索欄へ focus (名前必須の場合、例: category)。
  const handleNewClick = async () => {
    const q = query.trim()
    if (q && !exactMatch) {
      await doCreate()
      return
    }
    if (createNeedsQuery) {
      inputRef.current?.focus()
      return
    }
    await onCreate(q)
    setOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight(h => Math.min(filtered.length - 1, h + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight(h => Math.max(0, h - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered.length > 0 && highlight < filtered.length) {
        selectOption(filtered[highlight].id)
      } else if (canCreate) {
        doCreate()
      }
    }
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled || loading}
        onClick={() => (open ? setOpen(false) : openPanel())}
        className="w-full flex items-center bg-surface hover:bg-canvas transition-colors border border-transparent rounded-lg px-4 py-3 text-sm text-ink focus-visible:ring-2 focus-visible:ring-primary-bg cursor-pointer disabled:opacity-60"
      >
        <span className={cn('flex-1 text-left truncate', !selected && 'text-slate-400')}>
          {loading ? 'Loading…' : selected ? selected.label : placeholder}
        </span>
        {value && onClear && (
          <span
            role="button"
            tabIndex={-1}
            aria-label="Clear selection"
            onClick={(e) => { e.stopPropagation(); onClear() }}
            className="mr-1 text-slate-400 hover:text-ink"
          >
            <X className="w-3.5 h-3.5" />
          </span>
        )}
        <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
      </button>

      <AnimatePresence>
        {open && (
        <motion.div
          role="listbox"
          className="absolute z-30 mt-1 w-full bg-white border border-border rounded-lg shadow-modal overflow-hidden origin-top"
          variants={dropdownPanel}
          initial="hidden"
          animate="show"
          exit="exit"
        >
          <div className="flex items-center gap-2 px-3 py-2 border-b border-[#f0f0ec]">
            <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setHighlight(0) }}
              onKeyDown={handleKeyDown}
              placeholder="Search or type to create…"
              className="flex-1 bg-transparent text-sm text-ink placeholder:text-slate-400 focus:outline-none"
            />
          </div>

          {/* 作成ボタンは常時表示 (検索欄が空でも)。 */}
          <button
            type="button"
            onClick={handleNewClick}
            disabled={creating}
            aria-label={`Create new ${createNoun}`}
            title={canCreate ? `Create ${createNoun} “${query.trim()}”` : `Create new ${createNoun}`}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left border-b border-[#f0f0ec] text-primary font-bold hover:bg-primary-bg disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">
              {creating ? 'Creating…' : canCreate ? `Create “${query.trim()}”` : `New ${createNoun}`}
            </span>
          </button>

          <div className="max-h-[220px] overflow-y-auto py-1">
            {filtered.map((opt, i) => (
              <button
                key={opt.id}
                type="button"
                role="option"
                aria-selected={opt.id === value}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => selectOption(opt.id)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 text-sm text-left',
                  i === highlight ? 'bg-primary-bg' : 'hover:bg-canvas',
                )}
              >
                <Check className={cn('w-3.5 h-3.5 flex-shrink-0', opt.id === value ? 'text-primary' : 'text-transparent')} />
                <span className="flex-1 truncate text-ink">{opt.label}</span>
              </button>
            ))}

            {filtered.length === 0 && (
              <p className="px-3 py-3 text-[13px] text-slate-400 text-center">
                {query.trim() ? 'No matches — use “New” above to create.' : 'No items yet.'}
              </p>
            )}
          </div>
        </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
