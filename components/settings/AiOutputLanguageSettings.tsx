'use client'

import { useState } from 'react'
import { ArrowDown, ArrowUp, Languages, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input, FieldWrapper, Select } from '@/components/ui/FormField'
import { LanguagePicker } from '@/components/ui/LanguagePicker'
import { Modal } from '@/components/ui/Modal'
import { Toggle } from '@/components/ui/Toggle'
import { SectionHeader } from '@/components/settings/SettingsPrimitives'
import { addOrEnableAiOutputLanguage } from '@/lib/aiOutputLanguages'
import { canonicalizeLanguageCode } from '@/lib/studyLanguages'
import { verifyAttrs } from '@/verify/core/contract'
import type { AiOutputLanguage, LanguageCode } from '@/types'

interface AiOutputLanguageSettingsProps {
  languages: AiOutputLanguage[]
  defaultLanguage: LanguageCode
  onLanguagesChange: (languages: AiOutputLanguage[]) => void
  onDefaultLanguageChange: (language: LanguageCode) => void
}

function withSortOrder(languages: AiOutputLanguage[]): AiOutputLanguage[] {
  return languages.map((language, index) => ({ ...language, sort_order: index }))
}

export function AiOutputLanguageSettings({
  languages,
  defaultLanguage,
  onLanguagesChange,
  onDefaultLanguageChange,
}: AiOutputLanguageSettingsProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [confirmRemoveIndex, setConfirmRemoveIndex] = useState<number | null>(null)
  const [code, setCode] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const enabledLanguages = languages.filter(language => language.enabled)
  const canonicalDefault = canonicalizeLanguageCode(defaultLanguage)
  const defaultIsEnabled = Boolean(canonicalDefault && enabledLanguages.some(language => (
    canonicalizeLanguageCode(language.code) === canonicalDefault
  )))

  const updateLanguage = (index: number, update: Partial<AiOutputLanguage>) => {
    onLanguagesChange(languages.map((language, itemIndex) => (
      itemIndex === index ? { ...language, ...update } : language
    )))
  }

  const moveLanguage = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= languages.length) return
    const next = [...languages]
    ;[next[index], next[target]] = [next[target], next[index]]
    onLanguagesChange(withSortOrder(next))
  }

  const removeLanguage = (index: number) => {
    onLanguagesChange(withSortOrder(languages.filter((_, itemIndex) => itemIndex !== index)))
  }

  const removeTarget = confirmRemoveIndex !== null ? languages[confirmRemoveIndex] ?? null : null

  const handleConfirmRemove = () => {
    if (confirmRemoveIndex !== null) removeLanguage(confirmRemoveIndex)
    setConfirmRemoveIndex(null)
  }

  const closeModal = () => {
    setModalOpen(false)
    setCode('')
    setDisplayName('')
    setError(null)
  }

  const handleAdd = () => {
    const canonical = canonicalizeLanguageCode(code)
    if (!canonical) {
      setError('Enter a valid BCP 47 code, such as vi, ja, or pt-BR.')
      return
    }
    if (languages.some(language => canonicalizeLanguageCode(language.code) === canonical)) {
      setError(`${canonical} is already in your AI output languages.`)
      return
    }
    if (!displayName.trim()) {
      setError('Enter a display name.')
      return
    }

    onLanguagesChange(addOrEnableAiOutputLanguage(languages, {
      code: canonical,
      display_name: displayName,
    }))
    closeModal()
  }

  return (
    <div
      {...verifyAttrs({
        unit: 'AiOutputLanguageSettings',
        count: languages.length,
        defaultLanguage: defaultIsEnabled ? canonicalDefault : '',
      })}
    >
      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          <SectionHeader icon={Languages} label="AI Output Languages" tone="amber" />
          <p className="text-sm text-slate-600 -mt-2 mb-4">
            Choose the languages used for AI-generated meanings, explanations, and translations.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<Plus className="w-3.5 h-3.5" />}
          onClick={() => setModalOpen(true)}
        >
          Add language
        </Button>
      </div>

      <div className="flex flex-col divide-y divide-border">
        {languages.map((language, index) => {
          const cannotDisable = language.enabled && enabledLanguages.length === 1
          const cannotRemove = languages.length === 1 || cannotDisable
          const isDefault = canonicalizeLanguageCode(language.code) === canonicalDefault
          return (
            <div key={language.code} className="py-3.5 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0 grid grid-cols-[minmax(0,1fr)_90px] gap-3 items-center">
                <div className="relative">
                  <Input
                    aria-label={`Display name for AI output ${language.code}`}
                    value={language.display_name}
                    onChange={event => updateLanguage(index, { display_name: event.target.value })}
                    className={isDefault ? 'pr-20' : undefined}
                  />
                  {isDefault && (
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full bg-amber-bg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber">
                      Default
                    </span>
                  )}
                </div>
                <code className="text-center px-2 py-2 rounded-[8px] bg-surface text-[12px] font-mono text-slate-600">
                  {language.code}
                </code>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-2">
                <Toggle
                  bare
                  hideLabel
                  label={`${language.display_name || language.code} AI output enabled`}
                  checked={language.enabled}
                  disabled={cannotDisable}
                  onChange={enabled => updateLanguage(index, { enabled })}
                />
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label={`Move AI output ${language.display_name} up`}
                    disabled={index === 0}
                    onClick={() => moveLanguage(index, -1)}
                    className="w-8 h-8 inline-flex items-center justify-center rounded-[7px] text-slate-400 hover:text-ink hover:bg-surface disabled:opacity-30 disabled:pointer-events-none"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move AI output ${language.display_name} down`}
                    disabled={index === languages.length - 1}
                    onClick={() => moveLanguage(index, 1)}
                    className="w-8 h-8 inline-flex items-center justify-center rounded-[7px] text-slate-400 hover:text-ink hover:bg-surface disabled:opacity-30 disabled:pointer-events-none"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove AI output ${language.display_name}`}
                    title={cannotRemove ? 'Keep at least one AI output language enabled.' : undefined}
                    disabled={cannotRemove}
                    onClick={() => setConfirmRemoveIndex(index)}
                    className="w-8 h-8 inline-flex items-center justify-center rounded-[7px] text-slate-400 hover:text-danger hover:bg-danger-bg disabled:opacity-30 disabled:pointer-events-none"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-4 border-t border-border pt-4">
        <FieldWrapper
          label="Default AI output language"
          error={defaultIsEnabled
            ? undefined
            : 'Choose an enabled AI output language before saving.'}
        >
          <Select
            aria-label="Default AI output language"
            value={defaultIsEnabled ? canonicalDefault ?? '' : ''}
            onChange={event => onDefaultLanguageChange(event.target.value)}
            error={!defaultIsEnabled}
            aria-invalid={!defaultIsEnabled}
          >
            <option value="" disabled>Choose a default language…</option>
            {enabledLanguages.map(language => (
              <option key={language.code} value={language.code}>
                {language.display_name} ({language.code})
              </option>
            ))}
          </Select>
        </FieldWrapper>
        <p className="text-[12.5px] text-slate-500 mt-1.5">
          Preselected when creating cards. You can switch languages temporarily on the Create page.
        </p>
      </div>

      <Modal
        open={modalOpen}
        onClose={closeModal}
        onConfirm={handleAdd}
        title="Add AI output language"
        description="Search the language catalog or enter a valid BCP 47 code."
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <FieldWrapper label="Language">
            <LanguagePicker
              value={code || null}
              excludeCodes={languages.map(language => language.code)}
              onChange={language => {
                setCode(language.code)
                setDisplayName(language.display_name)
                setError(null)
              }}
            />
          </FieldWrapper>
          <FieldWrapper label="Display name">
            <Input
              aria-label="AI output language display name"
              value={displayName}
              onChange={event => {
                setDisplayName(event.target.value)
                setError(null)
              }}
              placeholder="e.g. Japanese"
            />
          </FieldWrapper>
          {error && <p className="text-[12.5px] text-danger">{error}</p>}
          <div className="flex justify-end gap-2 mt-1">
            <Button variant="ghost" onClick={closeModal}>Cancel</Button>
            <Button variant="primary" onClick={handleAdd}>Add language</Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={removeTarget !== null}
        onClose={() => setConfirmRemoveIndex(null)}
        onConfirm={handleConfirmRemove}
        title={`Remove ${removeTarget?.display_name || removeTarget?.code || 'language'}?`}
        description="Existing cards keep their output language. If this is the default, choose a new default before saving."
        size="sm"
      >
        <div className="flex justify-end gap-2 mt-1">
          <Button variant="ghost" onClick={() => setConfirmRemoveIndex(null)}>Cancel</Button>
          <Button variant="destructive" onClick={handleConfirmRemove}>Remove</Button>
        </div>
      </Modal>
    </div>
  )
}
