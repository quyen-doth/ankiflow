'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Input, Textarea, FieldWrapper, Select } from '@/components/ui/FormField'
import { TopicSelector } from './TopicSelector'
import { DeckSelector } from './DeckSelector'
import { SmartEnrichmentBanner } from './SmartEnrichmentBanner'
import { ColumnLabel } from './ColumnLabel'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { useSession } from '@/hooks/useSession'
import { FormType } from '@/types'
import { savePendingEntry } from '@/lib/pendingEntry'

type StepStatus = 'completed' | 'active' | 'pending'

interface ITFormProps {
  onGenerateStart?: () => void
  onStepUpdate?: (stepIndex: number, status: StepStatus) => void
  onGenerateEnd?: () => void
  onValidityChange?: (canSubmit: boolean) => void
  formId?: string
}

export function ITForm({ onGenerateStart, onStepUpdate, onGenerateEnd, onValidityChange, formId }: ITFormProps) {
  const router = useRouter()
  const { session, updateSession, resetContent, isLoaded } = useSession(FormType.IT)

  const [term, setTerm] = useState('')
  const [definition, setDefinition] = useState('')
  const [keywords, setKeywords] = useState('')
  const [error, setError] = useState<string | null>(null)

  const deckId = session?.deckId || ''
  const topics = session?.topicIds || []
  const difficulty = session?.difficulty || 'intermediate'
  const cardTypes = session?.cardTypeIds || []
  const tags = session?.tags || []

  useEffect(() => {
    onValidityChange?.(term.trim().length > 0)
  }, [term, onValidityChange])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    onGenerateStart?.()

    try {
      onStepUpdate?.(0, 'active')

      const generateRes = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          term,
          form_type: FormType.IT,
          topics,
          definition: definition || undefined,
          keywords: keywords ? keywords.split(',').map(k => k.trim()).filter(Boolean) : undefined,
        }),
      })

      if (!generateRes.ok) {
        const errData = await generateRes.json()
        throw new Error(errData.error || 'Failed to call Gemini API')
      }

      const { content: generatedContent } = await generateRes.json()
      onStepUpdate?.(0, 'completed')

      onStepUpdate?.(1, 'active')
      await new Promise(r => setTimeout(r, 400))
      onStepUpdate?.(1, 'completed')

      onStepUpdate?.(2, 'active')
      await new Promise(r => setTimeout(r, 300))
      onStepUpdate?.(2, 'completed')

      savePendingEntry({
        generatedContent,
        formType: FormType.IT,
        language: null,
        deckId,
        cardTypeIds: cardTypes,
        tags,
        savedAt: new Date().toISOString(),
      })

      resetContent()
      setTerm('')
      setDefinition('')
      setKeywords('')
      router.push('/preview')

    } catch (err) {
      console.error('IT generate error:', err)
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
            Technical Term
          </label>
          <input
            type="text"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="E.g., Event Loop, Closure..."
            className="w-full bg-surface-container hover:bg-surface-high transition-colors border border-transparent rounded-lg px-5 py-4 text-xl font-bold text-on-surface placeholder:text-on-surface-var/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 appearance-none shadow-none"
          />
        </div>

        <div className="mb-5">
          <label className="text-label-sm uppercase text-on-surface-var tracking-wider font-bold block mb-2">
            Your Definition (optional)
          </label>
          <Textarea
            placeholder="Describe it in your own words..."
            value={definition}
            onChange={(e) => setDefinition(e.target.value)}
            rows={3}
            className="bg-surface-container hover:bg-surface-high transition-colors px-5 py-4 text-sm"
          />
        </div>

        <SmartEnrichmentBanner>
          Our AI will automatically generate{' '}
          <strong className="text-on-surface font-bold">analogies</strong>,{' '}
          <strong className="text-on-surface font-bold">code examples</strong>, and{' '}
          <strong className="text-on-surface font-bold">related concepts</strong> based on your input.
        </SmartEnrichmentBanner>

        <ErrorMessage message={error} />
      </div>

      {/* Right — Configuration */}
      <div className="lg:col-span-5 flex flex-col bg-white rounded-xl shadow-card p-6 lg:p-8">
        <ColumnLabel label="Configuration" />

        <div className="flex flex-col gap-4 mb-6">
          <DeckSelector value={deckId} onChangeId={(id) => updateSession({ deckId: id })} />
          <TopicSelector selectedIds={topics} onChange={(v) => updateSession({ topicIds: v })} />
          <FieldWrapper label="Difficulty">
            <Select value={difficulty} onChange={(e) => updateSession({ difficulty: e.target.value })}>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </Select>
          </FieldWrapper>
          <FieldWrapper label="Keywords (comma separated)">
            <Input
              placeholder="E.g., async, callback, event..."
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
            />
          </FieldWrapper>
        </div>
      </div>
    </form>
  )
}
