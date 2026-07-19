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
  label?: string
  placeholder?: string
}

export function LanguageSelector({
  value,
  languages = DEFAULT_STUDY_LANGUAGES.map(language => ({ ...language })),
  onChange,
  onClear,
  label = 'Language',
  placeholder = 'Select language...',
}: LanguageSelectorProps) {
  const enabledLanguages = languages.filter(language => language.enabled)
  return (
    <FieldWrapper
      label={label}
      className="text-overline uppercase text-slate-600 tracking-wider font-bold"
      {...verifyAttrs({ unit: 'LanguageSelector', value })}
    >
      <div className="relative">
        <Select
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          // h-auto で base Select の h-[42px] を打ち消す — 残すと py-3 により content-box (16px) が
          // line-height (20px) より低くなり文字が欠ける。固定高を外す → CreatableSelect (deck) と揃う。
          className="w-full h-auto bg-surface hover:bg-canvas transition-colors border border-transparent rounded-lg px-4 py-3 text-sm text-ink focus-visible:ring-2 focus-visible:ring-primary-bg cursor-pointer appearance-none"
        >
          <option value="" disabled>{placeholder}</option>
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
