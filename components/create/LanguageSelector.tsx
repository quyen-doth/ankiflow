'use client'

import { Select, FieldWrapper } from '@/components/ui/FormField'
import { ClearSelectButton } from '@/components/create/ClearSelectButton'
import { DEFAULT_STUDY_LANGUAGES } from '@/lib/studyLanguages'
import { verifyAttrs } from '@/verify/core/contract'
import type { LanguageCode, StudyLanguage } from '@/types'

interface LanguageSelectorProps {
  value: LanguageCode | ''
  languages?: StudyLanguage[]
  onChange: (value: LanguageCode) => void
  onClear?: () => void
}

export function LanguageSelector({
  value,
  languages = DEFAULT_STUDY_LANGUAGES.map(language => ({ ...language })),
  onChange,
  onClear,
}: LanguageSelectorProps) {
  const enabledLanguages = languages.filter(language => language.enabled)
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
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-surface hover:bg-canvas transition-colors border border-transparent rounded-lg px-4 py-3 text-sm text-ink focus-visible:ring-2 focus-visible:ring-primary-bg cursor-pointer appearance-none"
        >
          <option value="" disabled>Select language...</option>
          {enabledLanguages.map(lang => (
            <option key={lang.code} value={lang.code}>
              {lang.display_name}
            </option>
          ))}
        </Select>
        <ClearSelectButton show={!!value && !!onClear} onClear={onClear} label="Clear selected language" />
      </div>
    </FieldWrapper>
  )
}
