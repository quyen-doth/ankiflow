'use client'

import { useId, useMemo, useRef, useState, useEffect } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  canonicalizeLanguageCode,
  inferLanguageDisplayName,
} from '@/lib/studyLanguages'
import { listLanguageCatalog } from '@/lib/languageCatalog'
import { verifyAttrs } from '@/verify/core/contract'
import type { CatalogLanguage } from '@/lib/languageCatalog'

interface LanguagePickerProps {
  value: string | null
  onChange: (language: CatalogLanguage) => void
  placeholder?: string
  excludeCodes?: string[]
}

export function LanguagePicker({
  value,
  onChange,
  placeholder = 'Search languages or enter a BCP 47 code…',
  excludeCodes = [],
}: LanguagePickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const listboxId = useId()

  const excluded = useMemo(() => new Set(
    excludeCodes
      .map(code => canonicalizeLanguageCode(code)?.toLowerCase())
      .filter((code): code is string => Boolean(code)),
  ), [excludeCodes])

  const catalog = useMemo(
    () => listLanguageCatalog().filter(language => !excluded.has(language.code.toLowerCase())),
    [excluded],
  )

  const selected = useMemo<CatalogLanguage | null>(() => {
    if (!value) return null
    const code = canonicalizeLanguageCode(value)
    if (!code) return null
    return listLanguageCatalog().find(language => language.code === code) ?? {
      code,
      display_name: inferLanguageDisplayName(code),
    }
  }, [value])

  const normalizedQuery = query.trim().toLowerCase()
  const filtered = normalizedQuery
    ? catalog.filter(language => (
      language.display_name.toLowerCase().includes(normalizedQuery)
      || language.code.toLowerCase().includes(normalizedQuery)
    ))
    : catalog

  const customCode = canonicalizeLanguageCode(query)
  const canUseCustomCode = Boolean(
    normalizedQuery
    && customCode
    && !excluded.has(customCode.toLowerCase())
    // pt-br のような非 canonical 表記でも、明示的に正規化した code を選択できる。
    && (filtered.length === 0 || /[-_]/.test(normalizedQuery)),
  )
  const customLanguage = canUseCustomCode && customCode
    ? { code: customCode, display_name: inferLanguageDisplayName(customCode) }
    : null
  const options = customLanguage ? [...filtered, customLanguage] : filtered
  const safeHighlightedIndex = Math.min(highlightedIndex, Math.max(options.length - 1, 0))

  useEffect(() => {
    if (!open) return
    const handleMouseDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [open])

  const selectLanguage = (language: CatalogLanguage) => {
    onChange(language)
    setQuery('')
    setOpen(false)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setQuery('')
      setOpen(false)
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!open) setOpen(true)
      setHighlightedIndex(index => Math.min(index + 1, Math.max(options.length - 1, 0)))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) setOpen(true)
      setHighlightedIndex(index => Math.max(index - 1, 0))
      return
    }
    if (event.key === 'Enter' && open && options.length > 0) {
      event.preventDefault()
      selectLanguage(options[safeHighlightedIndex])
    }
  }

  const displayValue = open
    ? query
    : selected ? `${selected.display_name} (${selected.code})` : ''

  return (
    <div
      ref={rootRef}
      className="relative"
      {...verifyAttrs({
        unit: 'LanguagePicker',
        open,
        value: selected?.code ?? '',
        count: options.length,
      })}
    >
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={open}
          aria-activedescendant={open && options.length > 0
            ? `${listboxId}-option-${safeHighlightedIndex}`
            : undefined}
          value={displayValue}
          placeholder={placeholder}
          onFocus={() => {
            setQuery('')
            setHighlightedIndex(0)
            setOpen(true)
          }}
          onChange={event => {
            setQuery(event.target.value)
            setHighlightedIndex(0)
            setOpen(true)
          }}
          onKeyDown={handleKeyDown}
          className={cn(
            'w-full h-[42px] bg-[#FCFCFB] rounded-[9px] pl-10 pr-10',
            'text-body text-ink placeholder:text-slate-400/60',
            'border border-[#E3E3DE] focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary-bg',
            'transition-shadow duration-150',
          )}
        />
        <ChevronDown
          className={cn(
            'absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none transition-transform',
            open && 'rotate-180',
          )}
        />
      </div>

      {open && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute z-40 mt-1 w-full max-h-[260px] overflow-y-auto bg-white border border-border rounded-[9px] shadow-modal py-1"
        >
          {filtered.map((language, index) => (
            <button
              key={language.code}
              id={`${listboxId}-option-${index}`}
              type="button"
              role="option"
              aria-selected={selected?.code === language.code}
              data-language-code={language.code}
              onMouseEnter={() => setHighlightedIndex(index)}
              onClick={() => selectLanguage(language)}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 text-sm text-left',
                index === safeHighlightedIndex ? 'bg-primary-bg' : 'hover:bg-canvas',
              )}
            >
              <Check className={cn(
                'w-3.5 h-3.5 flex-shrink-0',
                selected?.code === language.code ? 'text-primary' : 'text-transparent',
              )} />
              <span className="flex-1 truncate text-ink">{language.display_name}</span>
              <code className="text-[11px] text-slate-400">{language.code}</code>
            </button>
          ))}

          {customLanguage && (
            <button
              id={`${listboxId}-option-${filtered.length}`}
              type="button"
              role="option"
              aria-selected={false}
              data-language-code={customLanguage.code}
              data-language-picker-custom="true"
              onMouseEnter={() => setHighlightedIndex(filtered.length)}
              onClick={() => selectLanguage(customLanguage)}
              className={cn(
                'w-full px-3 py-2 text-sm text-left text-primary font-semibold border-t border-border',
                filtered.length === safeHighlightedIndex ? 'bg-primary-bg' : 'hover:bg-canvas',
              )}
            >
              Use code &quot;{customLanguage.code}&quot;
              <span className="ml-2 font-normal text-slate-500">({customLanguage.display_name})</span>
            </button>
          )}

          {options.length === 0 && (
            <p className="px-3 py-3 text-[13px] text-slate-400 text-center">No matching languages.</p>
          )}
        </div>
      )}
    </div>
  )
}
