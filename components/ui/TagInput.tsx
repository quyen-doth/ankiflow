'use client'

import { useState, type KeyboardEvent } from 'react'
import { Badge } from './Badge'
import { verifyAttrs } from '@/verify/core/contract'

interface TagInputProps {
  tags: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
  maxTags?: number
}

export function TagInput({ tags, onChange, placeholder = '+ Add Tag', maxTags = 10 }: TagInputProps) {
  const [inputValue, setInputValue] = useState('')

  const addTag = (value: string) => {
    const trimmed = value.trim()
    if (trimmed && !tags.includes(trimmed) && tags.length < maxTags) {
      onChange([...tags, trimmed])
    }
    setInputValue('')
  }

  const removeTag = (tag: string) => onChange(tags.filter((t) => t !== tag))

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(inputValue)
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      removeTag(tags[tags.length - 1])
    }
  }

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      {...verifyAttrs({ unit: 'TagInput', count: tags.length, max: maxTags })}
    >
      {tags.map((tag) => (
        <Badge key={tag} variant="neutral" onRemove={() => removeTag(tag)}>
          {tag}
        </Badge>
      ))}
      {tags.length < maxTags && (
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => addTag(inputValue)}
          placeholder={placeholder}
          className="text-sm text-slate-600 placeholder:text-slate-400/60 border border-dashed border-border rounded-pill px-3 py-2 focus:outline-none focus:border-primary min-w-20 bg-transparent"
        />
      )}
    </div>
  )
}
