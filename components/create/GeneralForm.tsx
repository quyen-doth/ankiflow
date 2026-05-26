'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Textarea, FieldWrapper } from '@/components/ui/FormField'
import { TagInput } from '@/components/ui/TagInput'
import { DeckSelector } from './DeckSelector'
import { Button } from '@/components/ui/Button'
import { useSession } from '@/hooks/useSession'
import { Sparkles } from 'lucide-react'

interface GeneralFormProps {
  onGenerateStart?: () => void
}

export function GeneralForm({ onGenerateStart }: GeneralFormProps) {
  const router = useRouter()
  const { session, updateSession, resetContent, isLoaded } = useSession('General')
  
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  
  const deckId = session?.deckId || ''
  const tags = session?.tags || []

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onGenerateStart?.()
    resetContent()
    setTitle('')
    setContent('')
    router.push('/preview')
  }

  if (!isLoaded) return null

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-0">
      
      {/* ── Deck & Tags (2 cột) ── */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        <DeckSelector
          value={deckId}
          onChangeId={(id) => updateSession({ deckId: id })}
        />
        <FieldWrapper label="Tags">
          <TagInput tags={tags} onChange={(v) => updateSession({ tags: v })} />
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

      {/* ── Card Title ── */}
      <div className="mb-4">
        <label className="text-label-sm uppercase tracking-wide text-on-surface-var block mb-1.5">
          Card Title
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Front side..."
          className="w-full bg-surface-container rounded px-4 py-4 text-base text-on-surface placeholder:text-on-surface-var/40 border border-transparent focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
        />
      </div>

      {/* ── Content ── */}
      <div className="mb-5">
        <label className="text-label-sm uppercase tracking-wide text-on-surface-var block mb-1.5">
          Content
        </label>
        <Textarea 
          placeholder="Back side..." 
          value={content} 
          onChange={(e) => setContent(e.target.value)} 
          rows={5} 
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
            Our AI will automatically <strong className="text-inverse-on">format content</strong> and{' '}
            <strong className="text-inverse-on">suggest relevant tags</strong> based on your input.
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" variant="primary" className="rounded-full px-8 py-3 text-base font-bold" disabled={!title.trim()}>
          Generate
        </Button>
      </div>
    </form>
  )
}
