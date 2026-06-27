'use client'

import { Select, FieldWrapper } from '@/components/ui/FormField'
import { ClearSelectButton } from '@/components/create/ClearSelectButton'
import { LANGUAGE_OPTIONS } from '@/lib/constants'
import { verifyAttrs } from '@/verify/core/contract'
import type { LanguageType } from '@/types'

interface LanguageSelectorProps {
  value: LanguageType | ''
  onChange: (value: LanguageType) => void
  onClear?: () => void
}

export function LanguageSelector({ value, onChange, onClear }: LanguageSelectorProps) {
  return (
    <FieldWrapper
      label="Language"
      className="text-overline uppercase text-slate-600 tracking-wider font-bold"
      {...verifyAttrs({ unit: 'LanguageSelector', value })}
    >
      <div className="relative">
        <Select
          aria-label="Language"
          value={value}
          onChange={(e) => onChange(e.target.value as LanguageType)}
          className="w-full bg-surface hover:bg-canvas transition-colors border border-transparent rounded-lg px-4 py-3 text-sm text-ink focus-visible:ring-2 focus-visible:ring-primary-bg cursor-pointer appearance-none"
        >
          <option value="" disabled>Select language...</option>
          {LANGUAGE_OPTIONS.map(lang => (
            <option key={lang.id} value={lang.id}>
              {lang.flag ? `${lang.flag} ` : ''}{lang.name}
            </option>
          ))}
        </Select>
        <ClearSelectButton show={!!value && !!onClear} onClear={onClear} label="Xóa ngôn ngữ đã chọn" />
      </div>
    </FieldWrapper>
  )
}