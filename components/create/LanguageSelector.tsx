'use client'

import { Select, FieldWrapper } from '@/components/ui/FormField'
import { LANGUAGE_OPTIONS } from '@/lib/constants'
import { verifyAttrs } from '@/verify/core/contract'
import type { LanguageType } from '@/types'

interface LanguageSelectorProps {
  value: LanguageType | ''
  onChange: (value: LanguageType) => void
}

export function LanguageSelector({ value, onChange }: LanguageSelectorProps) {
  return (
    <FieldWrapper
      label="Language"
      className="text-label-sm uppercase text-on-surface-var tracking-wider font-bold"
      {...verifyAttrs({ unit: 'LanguageSelector', value })}
    >
      <Select
        aria-label="Language"
        value={value}
        onChange={(e) => onChange(e.target.value as LanguageType)}
        className="w-full bg-surface-container hover:bg-surface-high transition-colors border border-transparent rounded-lg px-4 py-3 text-sm text-on-surface focus-visible:ring-2 focus-visible:ring-primary/40 cursor-pointer appearance-none"
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