'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input, Textarea, FieldWrapper, Select } from '@/components/ui/FormField'
import { TopicSelector } from './TopicSelector'
import { DeckSelector } from './DeckSelector'
import { Button } from '@/components/ui/Button'
import { useSession } from '@/hooks/useSession'
import { Sparkles } from 'lucide-react'

interface ITFormProps {
  onGenerateStart?: () => void
}

export function ITForm({ onGenerateStart }: ITFormProps) {
  const router = useRouter()
  const { session, updateSession, resetContent, isLoaded } = useSession('IT')
  
  const [term, setTerm] = useState('')
  const [definition, setDefinition] = useState('')
  const [keywords, setKeywords] = useState('')

  const deckId = session?.deckId || ''
  const topics = session?.topicIds || []
  const difficulty = session?.difficulty || 'intermediate'

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onGenerateStart?.()
    resetContent()
    setTerm('')
    setDefinition('')
    setKeywords('')
    router.push('/preview')
  }

  if (!isLoaded) return null

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-0">
      
      {/* ── Row 1: Deck + Topics + Difficulty (3 cột) ── */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <DeckSelector
          value={deckId}
          onChangeId={(id) => updateSession({ deckId: id })}
        />
        <TopicSelector selectedIds={topics} onChange={(v) => updateSession({ topicIds: v })} />
        <FieldWrapper label="Difficulty">
          <Select value={difficulty} onChange={(e) => updateSession({ difficulty: e.target.value })}>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </Select>
        </FieldWrapper>
      </div>

      {/* ── Divider: CORE CONTENT ── */}
      <div className="relative flex items-center gap-3 my-2 mb-5">
        <div className="flex-1 border-t border-outline-var/50" />
        <span className="text-label-sm uppercase tracking-widest text-on-surface-var/60 text-[10px]">
          Core Content
        </span>
        <div className="flex-1 border-t border-outline-var/50" />
      </div>

      {/* ── Technical Term ── */}
      <div className="mb-4">
        <label className="text-label-sm uppercase tracking-wide text-on-surface-var block mb-1.5">
          Technical Term
        </label>
        <input
          type="text"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="E.g., Event Loop, Closure..."
          className="w-full bg-surface-container rounded px-4 py-4 text-base text-on-surface placeholder:text-on-surface-var/40 border border-transparent focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
        />
      </div>

      {/* ── Definition ── */}
      <div className="mb-4">
        <label className="text-label-sm uppercase tracking-wide text-on-surface-var block mb-1.5">
          Definition
        </label>
        <Textarea 
          placeholder="Definition or concept explanation..." 
          value={definition} 
          onChange={(e) => setDefinition(e.target.value)} 
          rows={3} 
        />
      </div>

      {/* ── Keywords ── */}
      <div className="mb-5">
        <label className="text-label-sm uppercase tracking-wide text-on-surface-var block mb-1.5">
          Keywords
        </label>
        <Input 
          placeholder="Keywords (comma separated)..." 
          value={keywords} 
          onChange={(e) => setKeywords(e.target.value)} 
        />
      </div>

      {/* ── Smart Enrichment Banner ── */}
      <div className="bg-inverse-surface rounded-lg p-4 flex items-start gap-3 mb-6">
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-0.5">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold text-inverse-on leading-none mb-1">
            Smart Enrichment Active
          </p>
          <p className="text-xs text-inverse-on/70 leading-relaxed">
            Our AI will automatically fetch <strong className="text-inverse-on">analogies</strong>,{' '}
            <strong className="text-inverse-on">code examples</strong>, and{' '}
            <strong className="text-inverse-on">related concepts</strong> based on your input.
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" variant="primary" className="rounded-full px-8 py-3 text-base font-bold" disabled={!term.trim()}>
          Generate
        </Button>
      </div>
    </form>
  )
}
