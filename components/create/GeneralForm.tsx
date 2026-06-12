'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Textarea, FieldWrapper } from '@/components/ui/FormField'
import { TagInput } from '@/components/ui/TagInput'
import { DeckSelector } from './DeckSelector'
import { SmartEnrichmentBanner } from './SmartEnrichmentBanner'
import { ColumnLabel } from './ColumnLabel'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { useSession } from '@/hooks/useSession'
import { FormType } from '@/types'
import { savePendingEntry } from '@/lib/pendingEntry'

type StepStatus = 'completed' | 'active' | 'pending'

interface GeneralFormProps {
  onGenerateStart?: () => void
  onStepUpdate?: (stepIndex: number, status: StepStatus) => void
  onGenerateEnd?: () => void
  onValidityChange?: (canSubmit: boolean) => void
  formId?: string
}

export function GeneralForm({ onGenerateStart, onStepUpdate, onGenerateEnd, onValidityChange, formId }: GeneralFormProps) {
  const router = useRouter()
  const { session, updateSession, resetContent, isLoaded } = useSession(FormType.GENERAL)

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)

  const deckId = session?.deckId || ''
  const tags = session?.tags || []
  const cardTypes = session?.cardTypeIds || []

  useEffect(() => {
    onValidityChange?.(title.trim().length > 0)
  }, [title, onValidityChange])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    onGenerateStart?.()

    try {
      onStepUpdate?.(0, 'active')
      await new Promise(r => setTimeout(r, 300))
      onStepUpdate?.(0, 'completed')

      onStepUpdate?.(1, 'active')
      await new Promise(r => setTimeout(r, 200))
      onStepUpdate?.(1, 'completed')

      onStepUpdate?.(2, 'active')
      await new Promise(r => setTimeout(r, 200))
      onStepUpdate?.(2, 'completed')

      const generatedContent = {
        title,
        content,
        word: title,
        meaning_vi: content,
      }

      savePendingEntry({
        generatedContent,
        formType: FormType.GENERAL,
        language: null,
        deckId,
        cardTypeIds: cardTypes,
        tags,
        savedAt: new Date().toISOString(),
      })

      resetContent()
      setTitle('')
      setContent('')
      router.push('/preview')

    } catch (err) {
      console.error('General form error:', err)
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      onGenerateEnd?.()
    }
  }

  if (!isLoaded) return null

  return (
    <form id={formId} onSubmit={handleSubmit} className="grid lg:grid-cols-12 gap-6">

      {/* Left — Core Content (focal) */}
      <div className="lg:col-span-7 flex flex-col bg-white rounded-xl shadow-card p-6 lg:p-8">
        <ColumnLabel label="Core Content" />

        <div className="mb-5">
          <label className="text-label-sm uppercase text-on-surface-var tracking-wider font-bold block mb-2">
            Card Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Front side..."
            className="w-full bg-surface-container hover:bg-surface-high transition-colors border border-transparent rounded-lg px-5 py-4 text-xl font-bold text-on-surface placeholder:text-on-surface-var/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 appearance-none shadow-none"
          />
        </div>

        <div className="mb-5">
          <label className="text-label-sm uppercase text-on-surface-var tracking-wider font-bold block mb-2">
            Content
          </label>
          <Textarea
            placeholder="Back side..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            className="bg-surface-container hover:bg-surface-high transition-colors px-5 py-4 text-sm"
          />
        </div>

        <SmartEnrichmentBanner>
          Our AI will automatically{' '}
          <strong className="text-on-surface font-bold">format content</strong> and{' '}
          <strong className="text-on-surface font-bold">suggest relevant tags</strong> based on your input.
        </SmartEnrichmentBanner>

        <ErrorMessage message={error} />
      </div>

      {/* Right — Configuration */}
      <div className="lg:col-span-5 flex flex-col bg-white rounded-xl shadow-card p-6 lg:p-8">
        <ColumnLabel label="Configuration" />

        <div className="flex flex-col gap-4">
          <DeckSelector value={deckId} onChangeId={(id) => updateSession({ deckId: id })} />
          <FieldWrapper label="Tags">
            <TagInput tags={tags} onChange={(v) => updateSession({ tags: v })} />
          </FieldWrapper>
        </div>
      </div>
    </form>
  )
}
