'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input, Textarea, FieldWrapper, Select } from '@/components/ui/FormField'
import { TopicSelector } from './TopicSelector'
import { DeckSelector } from './DeckSelector'
import { SmartEnrichmentBanner } from './SmartEnrichmentBanner'
import { SectionDivider } from './SectionDivider'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { Button } from '@/components/ui/Button'
import { useSession } from '@/hooks/useSession'
import { FormType } from '@/types'
import { savePendingEntry } from '@/lib/pendingEntry'

type StepStatus = 'completed' | 'active' | 'pending'

interface ITFormProps {
  onGenerateStart?: () => void
  onStepUpdate?: (stepIndex: number, status: StepStatus) => void
  onGenerateEnd?: () => void
}

export function ITForm({ onGenerateStart, onStepUpdate, onGenerateEnd }: ITFormProps) {
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
        throw new Error(errData.error || 'Lỗi khi gọi Gemini API')
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
      console.error('Lỗi generate IT:', err)
      setError(err instanceof Error ? err.message : 'Đã xảy ra lỗi. Vui lòng thử lại.')
      onGenerateEnd?.()
    }
  }

  if (!isLoaded) return null

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-0">

      <div className="grid grid-cols-3 gap-4 mb-5">
        <DeckSelector value={deckId} onChangeId={(id) => updateSession({ deckId: id })} />
        <TopicSelector selectedIds={topics} onChange={(v) => updateSession({ topicIds: v })} />
        <FieldWrapper label="Difficulty">
          <Select value={difficulty} onChange={(e) => updateSession({ difficulty: e.target.value })}>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </Select>
        </FieldWrapper>
      </div>

      <SectionDivider label="Core Content" />

      <div className="mb-4">
        <label className="text-xs uppercase text-on-surface-var tracking-wider font-bold block mb-2">
          Technical Term
        </label>
        <input
          type="text"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="E.g., Event Loop, Closure..."
          className="w-full bg-surface-container hover:bg-surface-high transition-colors border-none rounded-2xl px-5 py-4 text-xl font-bold text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-0 appearance-none shadow-none"
        />
      </div>

      <div className="mb-4">
        <label className="text-xs uppercase text-on-surface-var tracking-wider font-bold block mb-2">
          Your Definition (optional)
        </label>
        <Textarea
          placeholder="Định nghĩa theo cách hiểu của bạn..."
          value={definition}
          onChange={(e) => setDefinition(e.target.value)}
          rows={3}
          className="w-full bg-surface-container hover:bg-surface-high transition-colors border-none rounded-2xl px-5 py-4 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-0 resize-none appearance-none shadow-none"
        />
      </div>

      <div className="mb-5">
        <label className="text-xs uppercase text-on-surface-var tracking-wider font-bold block mb-2">
          Keywords (comma separated)
        </label>
        <Input
          placeholder="E.g., async, callback, event..."
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
        />
      </div>

      <SmartEnrichmentBanner>
        Our AI will automatically generate{' '}
        <strong className="text-on-surface font-bold">analogies</strong>,{' '}
        <strong className="text-on-surface font-bold">code examples</strong>, and{' '}
        <strong className="text-on-surface font-bold">related concepts</strong> based on your input.
      </SmartEnrichmentBanner>

      <ErrorMessage message={error} />

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={!term.trim()}
          className="bg-primary hover:bg-primary-container text-white px-10 py-4 text-base font-bold rounded-full shadow-card transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Generate
        </Button>
      </div>
    </form>
  )
}
