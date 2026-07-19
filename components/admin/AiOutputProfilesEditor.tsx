'use client'

import { useState } from 'react'
import { ArrowDown, ArrowUp, LockKeyhole, Play, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { FieldWrapper, Input, Select, Textarea } from '@/components/ui/FormField'
import { useStudyLanguages } from '@/components/providers/StudyLanguageProvider'
import { isBuiltinRenderedOutputKey } from '@/lib/anki/cardTemplateFields'
import { getFieldLabel } from '@/lib/anki/renderCard'
import { resolveContentTypeFormType } from '@/lib/contentTypes'
import {
  buildTestGenerationRequest,
  type TestGenerationContentTypeDraft,
} from '@/lib/ai-agent/testGeneration'
import { cn } from '@/lib/utils'
import { FormType } from '@/types'
import type { AiOutputField, AiOutputProfile } from '@/types'

interface AiOutputProfilesEditorProps {
  profiles: AiOutputProfile[]
  primaryFieldKey: string | null
  disabledReason?: string
  contentType?: TestGenerationContentTypeDraft
  onInitialize: () => void
  onChange: (profiles: AiOutputProfile[]) => void
}

const PROFILE_LABELS: Readonly<Record<string, string>> = {
  default: 'Default',
  en: 'English',
  zh: 'Chinese',
  ja: 'Japanese',
}

function profileLabel(profile: string): string {
  return PROFILE_LABELS[profile] ?? (profile ? profile.toUpperCase() : 'New profile')
}

export function AiOutputProfilesEditor({
  profiles,
  primaryFieldKey,
  disabledReason,
  contentType,
  onInitialize,
  onChange,
}: AiOutputProfilesEditorProps) {
  const { enabledLanguages, aiOutputLanguage } = useStudyLanguages()
  const [activeIndex, setActiveIndex] = useState(0)
  const [testSample, setTestSample] = useState('')
  const [testLanguage, setTestLanguage] = useState(enabledLanguages[0]?.code ?? 'en')
  const [testLoading, setTestLoading] = useState(false)
  const [testError, setTestError] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<Record<string, unknown> | null>(null)
  const resolvedActiveIndex = profiles.length > 0
    ? Math.min(activeIndex, profiles.length - 1)
    : 0
  const activeProfile = profiles[resolvedActiveIndex]
  const defaultProfileIndex = profiles.findIndex(profile => profile.profile === 'default')
  const isDefaultProfile = resolvedActiveIndex === defaultProfileIndex
  const primaryFieldIndex = activeProfile?.fields.findIndex(field => field.key === primaryFieldKey) ?? -1
  const isLanguageContentType = contentType
    ? resolveContentTypeFormType(contentType.code.trim()) === FormType.LANGUAGE
    : false
  const resolvedTestLanguage = enabledLanguages.some(language => language.code === testLanguage)
    ? testLanguage
    : enabledLanguages[0]?.code ?? 'en'

  const replaceProfile = (next: AiOutputProfile) => {
    onChange(profiles.map((profile, index) => index === resolvedActiveIndex ? next : profile))
  }

  const updateField = (fieldIndex: number, next: AiOutputField) => {
    if (!activeProfile) return
    replaceProfile({
      ...activeProfile,
      fields: activeProfile.fields.map((field, index) => index === fieldIndex ? next : field),
    })
  }

  const moveField = (fieldIndex: number, direction: -1 | 1) => {
    if (!activeProfile) return
    const targetIndex = fieldIndex + direction
    if (targetIndex < 0 || targetIndex >= activeProfile.fields.length) return
    const nextFields = activeProfile.fields.slice()
    ;[nextFields[fieldIndex], nextFields[targetIndex]] = [nextFields[targetIndex], nextFields[fieldIndex]]
    replaceProfile({ ...activeProfile, fields: nextFields })
  }

  const addProfile = () => {
    if (!primaryFieldKey) return
    const defaultFields = profiles.find(profile => profile.profile === 'default')?.fields ?? []
    onChange([
      ...profiles,
      {
        profile: '',
        fields: defaultFields.map(field => ({ ...field })),
      },
    ])
    setActiveIndex(profiles.length)
  }

  const removeActiveProfile = () => {
    if (!activeProfile || isDefaultProfile) return
    onChange(profiles.filter((_, index) => index !== resolvedActiveIndex))
    setActiveIndex(0)
  }

  const runTestGeneration = async () => {
    if (!contentType || !testSample.trim()) return
    const studyLanguage = isLanguageContentType
      ? enabledLanguages.find(language => language.code === resolvedTestLanguage)
      : undefined
    setTestLoading(true)
    setTestError(null)
    setTestResult(null)
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildTestGenerationRequest({
          contentType,
          profiles,
          sample: testSample,
          studyLanguage,
          outputLanguage: aiOutputLanguage,
        })),
      })
      const payload = await response.json().catch(() => null) as unknown
      if (!response.ok) {
        const message = payload && typeof payload === 'object' && 'error' in payload
          ? String(payload.error)
          : 'Test generation failed.'
        throw new Error(message)
      }
      if (!payload || typeof payload !== 'object' || !('content' in payload)
        || !payload.content || typeof payload.content !== 'object' || Array.isArray(payload.content)) {
        throw new Error('Test generation returned an invalid response.')
      }
      setTestResult(payload.content as Record<string, unknown>)
    } catch (error) {
      setTestError(error instanceof Error ? error.message : 'Test generation failed.')
    } finally {
      setTestLoading(false)
    }
  }

  if (disabledReason) {
    return (
      <section className="rounded-[9px] border border-border bg-surface px-4 py-3">
        <h3 className="text-body font-semibold text-slate-600">AI output profiles</h3>
        <p className="text-[12.5px] text-slate-500 mt-1">{disabledReason}</p>
      </section>
    )
  }

  if (profiles.length === 0 || !activeProfile) {
    return (
      <section className="rounded-[9px] border border-primary/20 bg-primary-bg px-4 py-3 flex items-center justify-between gap-4">
        <div>
          <h3 className="text-body font-semibold text-slate-600">AI output profiles</h3>
          <p className="text-[12.5px] text-slate-500 mt-1">
            Add a valid primary form field, then initialize a safe default output profile.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={onInitialize} disabled={!primaryFieldKey}>
          Initialize profiles
        </Button>
      </section>
    )
  }

  return (
    <section className="rounded-card border border-border/60 p-4 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-body font-semibold text-slate-600">AI output profiles</h3>
          <p className="text-[12px] text-slate-400 mt-1">
            The server uses these fields to build the AI tool schema. The primary field is always locked.
          </p>
        </div>
        <Button variant="ghost" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={addProfile}>
          Add Profile
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-3 items-end">
        <FieldWrapper label="Profile">
          <Select
            aria-label="AI output profile"
            value={resolvedActiveIndex}
            onChange={(event) => setActiveIndex(Number(event.target.value))}
          >
            {profiles.map((profile, index) => (
              <option key={`${profile.profile}-${index}`} value={index}>
                {profileLabel(profile.profile)}
              </option>
            ))}
          </Select>
        </FieldWrapper>
        <FieldWrapper label="Profile key">
          <Input
            aria-label="AI profile key"
            value={activeProfile.profile}
            disabled={isDefaultProfile}
            onChange={(event) => replaceProfile({ ...activeProfile, profile: event.target.value })}
            placeholder="e.g. fr"
          />
        </FieldWrapper>
        <Button
          variant="ghost"
          size="sm"
          onClick={removeActiveProfile}
          disabled={isDefaultProfile}
          aria-label={`Remove AI profile ${activeProfile.profile || 'new'}`}
          className="text-danger"
        >
          Remove
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        {activeProfile.fields.map((field, fieldIndex) => {
          const isPrimary = fieldIndex === primaryFieldIndex
          return (
            <div key={`${field.key}-${fieldIndex}`} className="rounded-[9px] border border-border/60 bg-surface/40 p-3 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[12px] font-semibold text-slate-600">
                    {field.key || `output_${fieldIndex}`}
                  </span>
                  {isPrimary && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary-bg px-2 py-0.5 text-[10px] font-bold text-primary">
                      <LockKeyhole className="w-3 h-3" /> Primary
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="p-1.5 h-auto"
                    aria-label={`Move AI output ${field.key || fieldIndex} up`}
                    disabled={fieldIndex === 0}
                    onClick={() => moveField(fieldIndex, -1)}
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="p-1.5 h-auto"
                    aria-label={`Move AI output ${field.key || fieldIndex} down`}
                    disabled={fieldIndex === activeProfile.fields.length - 1}
                    onClick={() => moveField(fieldIndex, 1)}
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </Button>
                  {!isPrimary && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="p-1.5 h-auto text-danger"
                      aria-label={`Remove AI output ${field.key || fieldIndex}`}
                      onClick={() => replaceProfile({
                        ...activeProfile,
                        fields: activeProfile.fields.filter((_, index) => index !== fieldIndex),
                      })}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FieldWrapper label="Output key">
                  <Input
                    aria-label={`AI output key ${fieldIndex}`}
                    value={field.key}
                    disabled={isPrimary}
                    onChange={(event) => updateField(fieldIndex, { ...field, key: event.target.value })}
                  />
                </FieldWrapper>
                <FieldWrapper label="Type">
                  <Select
                    aria-label={`AI output type ${fieldIndex}`}
                    value={field.type}
                    onChange={(event) => {
                      const type = event.target.value as AiOutputField['type']
                      updateField(fieldIndex, {
                        ...field,
                        type,
                        ...(type === 'string' ? { max_items: undefined } : {}),
                      })
                    }}
                  >
                    <option value="string">String</option>
                    <option value="string_array">String array</option>
                  </Select>
                </FieldWrapper>
              </div>

              <FieldWrapper label="Instruction">
                <Textarea
                  aria-label={`AI output instruction ${fieldIndex}`}
                  rows={2}
                  value={field.instruction}
                  onChange={(event) => updateField(fieldIndex, { ...field, instruction: event.target.value })}
                />
              </FieldWrapper>

              <div className={cn('grid grid-cols-1 gap-3', field.type === 'string_array' && 'sm:grid-cols-2')}>
                <FieldWrapper label="Include when">
                  <Select
                    aria-label={`AI output condition ${fieldIndex}`}
                    value={field.include_when ?? 'always'}
                    onChange={(event) => updateField(fieldIndex, {
                      ...field,
                      include_when: event.target.value as AiOutputField['include_when'],
                    })}
                  >
                    <option value="always">Always</option>
                    <option value="output_vi">Output language is Vietnamese</option>
                  </Select>
                </FieldWrapper>
                {field.type === 'string_array' && (
                  <FieldWrapper label="Maximum items">
                    <Input
                      type="number"
                      min={1}
                      max={20}
                      aria-label={`AI output maximum items ${fieldIndex}`}
                      value={field.max_items ?? 10}
                      onChange={(event) => updateField(fieldIndex, {
                        ...field,
                        max_items: Number(event.target.value),
                      })}
                    />
                  </FieldWrapper>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <Button
        variant="ghost"
        size="sm"
        leftIcon={<Plus className="w-3.5 h-3.5" />}
        onClick={() => replaceProfile({
          ...activeProfile,
          fields: [...activeProfile.fields, { key: '', type: 'string', instruction: '' }],
        })}
        className="self-start"
      >
        Add Output Field
      </Button>

      {contentType && (
        <div className="border-t border-border/60 pt-4 flex flex-col gap-3">
          <div>
            <h4 className="text-body font-semibold text-slate-600">Test with a sample word</h4>
            <p className="text-[12px] text-slate-400 mt-1">
              Run the unsaved fields and instructions without changing this Content Type.
            </p>
          </div>
          <div className={cn('grid grid-cols-1 gap-3 items-end', isLanguageContentType && 'sm:grid-cols-2')}>
            <FieldWrapper label={resolveContentTypeFormType(contentType.code.trim()) === FormType.IT ? 'Sample term' : 'Sample value'}>
              <Input
                aria-label="AI test sample"
                value={testSample}
                maxLength={500}
                onChange={event => setTestSample(event.target.value)}
                onKeyDown={event => {
                  if (event.key !== 'Enter') return
                  event.preventDefault()
                  event.stopPropagation()
                  void runTestGeneration()
                }}
                placeholder="Enter a value to generate…"
              />
            </FieldWrapper>
            {isLanguageContentType && (
              <FieldWrapper label="Study language">
                <Select
                  aria-label="AI test study language"
                  value={resolvedTestLanguage}
                  onChange={event => setTestLanguage(event.target.value)}
                >
                  {enabledLanguages.map(language => (
                    <option key={language.code} value={language.code}>{language.display_name}</option>
                  ))}
                </Select>
              </FieldWrapper>
            )}
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="self-start"
            leftIcon={<Play className="w-3.5 h-3.5" />}
            loading={testLoading}
            disabled={!testSample.trim()}
            onClick={runTestGeneration}
          >
            Run test
          </Button>

          {testError && <p role="alert" className="text-[12.5px] text-danger">{testError}</p>}
          {testResult && (
            <div aria-label="AI test result" className="rounded-[9px] border border-primary/20 bg-primary-bg/40 p-3 flex flex-col gap-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.05em] font-mono text-primary">Test result</p>
              {Object.entries(testResult).map(([key, value]) => {
                const isCustom = !isBuiltinRenderedOutputKey(key)
                const labels = Object.fromEntries(contentType.fields.map(field => [field.field_key, field.label]))
                const label = getFieldLabel(`custom:${key}`, labels)
                const renderedValue = Array.isArray(value)
                  ? value.join(', ')
                  : typeof value === 'string'
                    ? value
                    : JSON.stringify(value)
                return (
                  <div key={key} className="rounded-[7px] border border-border/60 bg-white px-3 py-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-[11px] font-semibold text-slate-600">{label}</span>
                      {isCustom && (
                        <span className="rounded-full bg-primary-bg px-2 py-0.5 text-[9px] font-bold uppercase text-primary">
                          Custom
                        </span>
                      )}
                    </div>
                    <p className="text-[13px] text-ink whitespace-pre-wrap">{renderedValue}</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
