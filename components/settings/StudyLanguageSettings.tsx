'use client'

import { useState } from 'react'
import { ArrowDown, ArrowUp, Languages, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input, FieldWrapper } from '@/components/ui/FormField'
import { Modal } from '@/components/ui/Modal'
import { Toggle } from '@/components/ui/Toggle'
import { SectionHeader } from '@/components/settings/SettingsPrimitives'
import {
  addOrEnableStudyLanguage,
  canonicalizeLanguageCode,
  inferLanguageDisplayName,
} from '@/lib/studyLanguages'
import { verifyAttrs } from '@/verify/core/contract'
import type { StudyLanguage } from '@/types'

interface StudyLanguageSettingsProps {
  languages: StudyLanguage[]
  onChange: (languages: StudyLanguage[]) => void
}

function withSortOrder(languages: StudyLanguage[]): StudyLanguage[] {
  return languages.map((language, index) => ({ ...language, sort_order: index }))
}

export function StudyLanguageSettings({ languages, onChange }: StudyLanguageSettingsProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [code, setCode] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [nameEdited, setNameEdited] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const enabledCount = languages.filter(language => language.enabled).length

  const updateLanguage = (index: number, update: Partial<StudyLanguage>) => {
    onChange(languages.map((language, itemIndex) => (
      itemIndex === index ? { ...language, ...update } : language
    )))
  }

  const moveLanguage = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= languages.length) return
    const next = [...languages]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(withSortOrder(next))
  }

  const removeLanguage = (index: number) => {
    onChange(withSortOrder(languages.filter((_, itemIndex) => itemIndex !== index)))
  }

  const closeModal = () => {
    setModalOpen(false)
    setCode('')
    setDisplayName('')
    setNameEdited(false)
    setError(null)
  }

  const handleCodeChange = (value: string) => {
    setCode(value)
    setError(null)
    if (!nameEdited) setDisplayName(inferLanguageDisplayName(value))
  }

  const handleAdd = () => {
    const canonical = canonicalizeLanguageCode(code)
    if (!canonical) {
      setError('Enter a valid BCP 47 code, such as fr, ko, or pt-BR.')
      return
    }
    if (languages.some(language => canonicalizeLanguageCode(language.code) === canonical)) {
      setError(`${canonical} is already in your study languages.`)
      return
    }
    if (!displayName.trim()) {
      setError('Enter a display name.')
      return
    }

    onChange(addOrEnableStudyLanguage(languages, {
      code: canonical,
      display_name: displayName,
    }))
    closeModal()
  }

  return (
    <div {...verifyAttrs({ unit: 'StudyLanguageSettings', count: languages.length })}>
      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          <SectionHeader icon={Languages} label="Study Languages" tone="green" />
          <p className="text-sm text-slate-600 -mt-2 mb-4">
            Choose which languages appear when creating, filtering, and organizing language cards.
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
          const cannotDisable = language.enabled && enabledCount === 1
          const cannotRemove = languages.length === 1 || cannotDisable
          return (
            <div key={language.code} className="py-3.5 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0 grid grid-cols-[minmax(0,1fr)_90px] gap-3 items-center">
                <Input
                  aria-label={`Display name for ${language.code}`}
                  value={language.display_name}
                  onChange={event => updateLanguage(index, { display_name: event.target.value })}
                />
                <code className="text-center px-2 py-2 rounded-[8px] bg-surface text-[12px] font-mono text-slate-600">
                  {language.code}
                </code>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-2">
                <Toggle
                  bare
                  label={`${language.display_name || language.code} enabled`}
                  checked={language.enabled}
                  disabled={cannotDisable}
                  onChange={enabled => updateLanguage(index, { enabled })}
                />
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label={`Move ${language.display_name} up`}
                    disabled={index === 0}
                    onClick={() => moveLanguage(index, -1)}
                    className="w-8 h-8 inline-flex items-center justify-center rounded-[7px] text-slate-400 hover:text-ink hover:bg-surface disabled:opacity-30 disabled:pointer-events-none"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${language.display_name} down`}
                    disabled={index === languages.length - 1}
                    onClick={() => moveLanguage(index, 1)}
                    className="w-8 h-8 inline-flex items-center justify-center rounded-[7px] text-slate-400 hover:text-ink hover:bg-surface disabled:opacity-30 disabled:pointer-events-none"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${language.display_name}`}
                    title={cannotRemove ? 'Keep at least one study language enabled.' : undefined}
                    disabled={cannotRemove}
                    onClick={() => removeLanguage(index)}
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

      <Modal
        open={modalOpen}
        onClose={closeModal}
        onConfirm={handleAdd}
        title="Add study language"
        description="Use a canonical BCP 47 language code."
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <FieldWrapper label="Language code">
            <Input
              autoFocus
              aria-label="Language code"
              value={code}
              onChange={event => handleCodeChange(event.target.value)}
              placeholder="e.g. fr, ko, pt-BR"
            />
          </FieldWrapper>
          <FieldWrapper label="Display name">
            <Input
              aria-label="Language display name"
              value={displayName}
              onChange={event => {
                setNameEdited(true)
                setDisplayName(event.target.value)
                setError(null)
              }}
              placeholder="e.g. French"
            />
          </FieldWrapper>
          {error && <p className="text-[12.5px] text-danger">{error}</p>}
          <div className="flex justify-end gap-2 mt-1">
            <Button variant="ghost" onClick={closeModal}>Cancel</Button>
            <Button variant="primary" onClick={handleAdd}>Add language</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
