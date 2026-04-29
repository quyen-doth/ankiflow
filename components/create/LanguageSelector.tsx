'use client'

import { Badge } from '@/components/ui/Badge'
import { FieldWrapper } from '@/components/ui/FormField'
import { LANGUAGE_OPTIONS } from '@/lib/constants'
import type { LanguageType } from '@/types'

interface LanguageSelectorProps {
  value: LanguageType | ''
  onChange: (value: LanguageType) => void
}

// Dùng LANGUAGE_OPTIONS từ constants — không hardcode danh sách ngôn ngữ ở đây
export function LanguageSelector({ value, onChange }: LanguageSelectorProps) {
  return (
    <FieldWrapper label="Language">
      <div className="flex gap-2">
        {LANGUAGE_OPTIONS.map(lang => (
          <button
            key={lang.id}
            type="button"
            onClick={() => onChange(lang.id)}
            className="transition-transform active:scale-95"
          >
            <Badge variant={value === lang.id ? 'language' : 'neutral'} className="px-3 py-1.5 text-sm">
              <span className="mr-1">{lang.flag}</span>
              {lang.name}
            </Badge>
          </button>
        ))}
      </div>
    </FieldWrapper>
  )
}
