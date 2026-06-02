'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input, Textarea, FieldWrapper, Select } from '@/components/ui/FormField'
import { TopicSelector } from './TopicSelector'
import { DeckSelector } from './DeckSelector'
import { Button } from '@/components/ui/Button'
import { useSession } from '@/hooks/useSession'
import { FormType } from '@/types'
import { savePendingEntry } from '@/lib/pendingEntry'
import { Sparkles } from 'lucide-react'

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
      // ─── Step 0: Gọi Gemini AI ─────────────────────────────────────────────
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

      // ─── Step 1: TTS (placeholder) ─────────────────────────────────────────
      onStepUpdate?.(1, 'active')
      await new Promise(r => setTimeout(r, 400))
      onStepUpdate?.(1, 'completed')

      // ─── Step 2: Images (placeholder) ─────────────────────────────────────
      onStepUpdate?.(2, 'active')
      await new Promise(r => setTimeout(r, 300))
      onStepUpdate?.(2, 'completed')

      // ─── Lưu kết quả ──────────────────────────────────────────────────────
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
      <div className="relative flex items-center gap-3 my-8">
        <div className="flex-1 border-t border-gray-200" />
        <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-gray-400">
          Core Content
        </span>
        <div className="flex-1 border-t border-gray-200" />
      </div>

      {/* ── Technical Term ── */}
      <div className="mb-4">
        <label className="text-xs uppercase text-gray-400 tracking-wider font-bold block mb-2">
          Technical Term
        </label>
        <input
          type="text"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="E.g., Event Loop, Closure..."
          className="w-full bg-[#F6F4EF] hover:bg-[#EFECE5] transition-colors border-none rounded-2xl px-5 py-4 text-xl font-bold text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-0 appearance-none shadow-none"
        />
      </div>

      {/* ── Definition (ghi chú — không phải definition từ AI) ── */}
      <div className="mb-4">
        <label className="text-xs uppercase text-gray-400 tracking-wider font-bold block mb-2">
          Your Definition (optional)
        </label>
        <Textarea
          placeholder="Định nghĩa theo cách hiểu của bạn..."
          value={definition}
          onChange={(e) => setDefinition(e.target.value)}
          rows={3}
          className="w-full bg-[#F6F4EF] hover:bg-[#EFECE5] transition-colors border-none rounded-2xl px-5 py-4 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-0 resize-none appearance-none shadow-none"
        />
      </div>

      {/* ── Keywords ── */}
      <div className="mb-5">
        <label className="text-xs uppercase text-gray-400 tracking-wider font-bold block mb-2">
          Keywords (comma separated)
        </label>
        <Input
          placeholder="E.g., async, callback, event..."
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
        />
      </div>

      {/* ── Smart Enrichment Banner ── */}
      <div className="bg-[#FAF8F5] border border-[#EBE6DD] border-l-[6px] border-l-[#8C7A61] rounded-2xl p-6 flex items-center gap-5 mb-8 shadow-sm">
        <div className="w-12 h-12 rounded-full bg-[#8C7A61] flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <div>
          <p className="text-base font-bold text-[#8C7A61] leading-none mb-2">
            Smart Enrichment Active
          </p>
          <p className="text-sm text-gray-600 leading-relaxed">
            Our AI will automatically generate <strong className="text-gray-900 font-bold">analogies</strong>,{' '}
            <strong className="text-gray-900 font-bold">code examples</strong>, and{' '}
            <strong className="text-gray-900 font-bold">related concepts</strong> based on your input.
          </p>
        </div>
      </div>

      {/* ── Error message ── */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          ⚠️ {error}
        </div>
      )}

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={!term.trim()}
          className="bg-[#1B4D3E] hover:bg-[#14392e] text-white px-10 py-4 text-base font-bold rounded-[1.5rem] shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Generate
        </Button>
      </div>
    </form>
  )
}
