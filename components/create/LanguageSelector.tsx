'use client'

import { Select, FieldWrapper } from '@/components/ui/FormField'
import { LANGUAGE_OPTIONS } from '@/lib/constants'
import type { LanguageType } from '@/types'

interface LanguageSelectorProps {
  value: LanguageType | ''
  onChange: (value: LanguageType) => void
}

export function LanguageSelector({ value, onChange }: LanguageSelectorProps) {
  return (
    <FieldWrapper 
      label="LANGUAGE"
      className="text-xs uppercase text-gray-400 tracking-wider font-bold"
    >
      <Select
        value={value}
        onChange={(e) => onChange(e.target.value as LanguageType)}
        className="w-full bg-[#F6F4EF] hover:bg-[#EFECE5] transition-colors border-none rounded-4xl px-4 py-3 text-sm text-gray-800 focus:ring-0 cursor-pointer appearance-none"
      >
        <option value="" disabled>Select language...</option>
        {LANGUAGE_OPTIONS.map(lang => (
          <option key={lang.id} value={lang.id}>
            {lang.flag ? `${lang.flag} ` : ''}{lang.name}
          </option>
        ))}
      </Select>
    </FieldWrapper>
  )
}