'use client'

import { useState, useRef, useEffect } from 'react'
import { Input } from '@/components/ui/FormField'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

interface EditableFieldProps {
  value: string
  onSave: (value: string) => void
  multiline?: boolean
  className?: string
  placeholder?: string
}

export function EditableField({ value, onSave, multiline = false, className, placeholder }: EditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  useEffect(() => {
    setDraft(value)
  }, [value])

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus()
    }
  }, [isEditing])

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
      <div className="flex flex-col gap-2">
        {multiline ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={3}
            className="w-full text-sm text-on-surface bg-surface-low border border-primary/40 rounded-lg px-3 py-2 ring-2 ring-primary/30 focus:outline-none resize-none"
            placeholder={placeholder}
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full text-sm text-on-surface bg-surface-low border border-primary/40 rounded-lg px-3 py-2 ring-2 ring-primary/30 focus:outline-none"
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

  return (
    <span
      onClick={() => setIsEditing(true)}
      className={cn(
        'cursor-pointer rounded-md px-1 -mx-1 transition-colors hover:bg-primary/5 border border-transparent hover:border-primary/20',
        !value && 'text-on-surface-var italic',
        className
      )}
      title="Click to edit"
    >
      {value || placeholder || 'Click to edit...'}
    </span>
  )
}
