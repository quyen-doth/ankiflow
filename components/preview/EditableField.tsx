'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { verifyAttrs } from '@/verify/core/contract'

interface EditableFieldProps {
  value: string
  onSave: (value: string) => void
  multiline?: boolean
  className?: string
  placeholder?: string
  /** 表示モード時、このキーワードを内容中でハイライトする (case-insensitive)。 */
  highlight?: string
}

export function EditableField({ value, onSave, multiline = false, className, placeholder, highlight }: EditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  const handleStartEdit = () => {
    setDraft(value)
    setIsEditing(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const handleSave = () => {
    onSave(draft)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setDraft(value)
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!multiline && e.key === 'Enter') handleSave()
    if (e.key === 'Escape') handleCancel()
  }

  if (isEditing) {
    return (
      <div className="flex flex-col gap-2" {...verifyAttrs({ unit: 'EditableField', editing: true })}>
        {multiline ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            aria-label="Edit value"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={3}
            className="w-full text-sm text-ink bg-surface border border-primary/40 rounded-lg px-3 py-2 ring-2 ring-primary-bg focus:outline-none resize-none"
            placeholder={placeholder}
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            aria-label="Edit value"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full text-sm text-ink bg-surface border border-primary/40 rounded-lg px-3 py-2 ring-2 ring-primary-bg focus:outline-none"
            placeholder={placeholder}
          />
        )}
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={handleCancel}>Cancel</Button>
          <Button type="button" variant="primary" size="sm" onClick={handleSave}>Save</Button>
        </div>
      </div>
    )
  }

  const renderDisplay = () => {
    if (!value) return placeholder || 'Click to edit...'
    if (!highlight) return value
    const idx = value.toLowerCase().indexOf(highlight.toLowerCase())
    if (idx === -1) return value
    return (
      <>
        {value.slice(0, idx)}
        <mark className="bg-[rgba(49,99,66,0.12)] text-primary font-semibold px-1 py-0.5 rounded-[4px]">
          {value.slice(idx, idx + highlight.length)}
        </mark>
        {value.slice(idx + highlight.length)}
      </>
    )
  }

  return (
    <span
      onClick={handleStartEdit}
      {...verifyAttrs({ unit: 'EditableField', editing: false, empty: !value })}
      className={cn(
        'cursor-pointer rounded-md px-1 -mx-1 transition-colors hover:bg-primary-bg border border-transparent hover:border-primary/20',
        !value && 'text-slate-600 italic',
        className
      )}
      title="Click to edit"
    >
      {renderDisplay()}
    </span>
  )
}
