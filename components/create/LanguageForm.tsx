'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Textarea, FieldWrapper } from '@/components/ui/FormField'
import { TagInput } from '@/components/ui/TagInput'
import { LanguageSelector } from './LanguageSelector'
import { CategorySelector } from './CategorySelector'
import { CardTypeSelector } from './CardTypeSelector'
import { DeckSelector } from './DeckSelector'
import { SmartEnrichmentBanner } from './SmartEnrichmentBanner'
import { SectionDivider } from './SectionDivider'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { Button } from '@/components/ui/Button'
import { useSession } from '@/hooks/useSession'
import { FormType, LanguageType } from '@/types'
import { savePendingEntry } from '@/lib/pendingEntry'

type StepStatus = 'completed' | 'active' | 'pending'

interface LanguageFormProps {
  onGenerateStart?: () => void
  onStepUpdate?: (stepIndex: number, status: StepStatus) => void
  onGenerateEnd?: () => void
}

export function LanguageForm({ onGenerateStart, onStepUpdate, onGenerateEnd }: LanguageFormProps) {
  const router = useRouter()
  const { session, updateSession, resetContent, isLoaded } = useSession(FormType.LANGUAGE)

  const [vocabulary, setVocabulary] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  const language = (session?.language as LanguageType) || LanguageType.ENGLISH
  const deckId = session?.deckId || ''
  const category = session?.categoryId || ''
  const tags = session?.tags || []
  const cardTypes = session?.cardTypeIds || []

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
          word: vocabulary,
          form_type: FormType.LANGUAGE,
          language,
          note: notes || undefined,
        }),
      })

      if (!generateRes.ok) {
        const errData = await generateRes.json()
        throw new Error(errData.error || 'Failed to call Gemini API')
      }

      const { content: generatedContent } = await generateRes.json()
      onStepUpdate?.(0, 'completed')

      onStepUpdate?.(1, 'active')
      await new Promise(r => setTimeout(r, 500))
      onStepUpdate?.(1, 'completed')

      onStepUpdate?.(2, 'active')
      await new Promise(r => setTimeout(r, 400))
      onStepUpdate?.(2, 'completed')

      savePendingEntry({
        generatedContent,
        formType: FormType.LANGUAGE,
        language,
        deckId,
        categoryId: category,
        cardTypeIds: cardTypes,
        tags,
        savedAt: new Date().toISOString(),
      })

      resetContent()
      setVocabulary('')
      setNotes('')
      router.push('/preview')

    } catch (err) {
      console.error('Generate error:', err)
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      onGenerateEnd?.()
    }
  }

  if (!isLoaded) return null

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-0">

      <div className="grid grid-cols-3 gap-6 mb-6">
        <LanguageSelector value={language} onChange={(v) => updateSession({ language: v })} />
        <DeckSelector value={deckId} onChange={(id) => updateSession({ deckId: id })} />
        <CategorySelector formType="Language" value={category} onChange={(v) => updateSession({ categoryId: v })} />
      </div>

      <div className="mb-2">
        <FieldWrapper label="Tags">
          <TagInput tags={tags} onChange={(v) => updateSession({ tags: v })} />
        </FieldWrapper>
      </div>

      <SectionDivider label="Core Content" />

      <div className="mb-6">
        <label className="text-label-sm uppercase text-on-surface-var tracking-wider font-bold block mb-2">
          Vocabulary Item
        </label>
        <input
          type="text"
          value={vocabulary}
          onChange={(e) => setVocabulary(e.target.value)}
          className="w-full bg-surface-container hover:bg-surface-high transition-colors border border-transparent rounded-lg px-5 py-4 text-xl font-bold text-on-surface placeholder:text-on-surface-var/40 placeholder:font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 appearance-none shadow-none"
        />
      </div>

      <div className="mb-6">
        <label className="text-label-sm uppercase text-on-surface-var tracking-wider font-bold block mb-2">
          Contextual Note
        </label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="bg-surface-container hover:bg-surface-high transition-colors px-5 py-4 text-sm"
        />
      </div>

      <SectionDivider label="Card Generation Options" />

      <div className="mb-10">
        <CardTypeSelector
          formType="Language"
          language={language}
          selectedIds={cardTypes}
          onChange={(v) => updateSession({ cardTypeIds: v })}
        />
      </div>

      <SmartEnrichmentBanner>
        Our AI will automatically fetch{' '}
        <strong className="text-on-surface font-bold">native audio samples</strong>,{' '}
        <strong className="text-on-surface font-bold">stroke order diagrams</strong>, and{' '}
        <strong className="text-on-surface font-bold">3 context sentences</strong> based on your input.
      </SmartEnrichmentBanner>

      <ErrorMessage message={error} />

      <div className="flex justify-end mt-4">
        <Button type="submit" size="xl" disabled={!vocabulary.trim()} className="shadow-card">
          Generate
        </Button>
      </div>
    </form>
  )
}
