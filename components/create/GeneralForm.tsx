'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Textarea, FieldWrapper } from '@/components/ui/FormField'
import { TagInput } from '@/components/ui/TagInput'
import { DeckSelector } from './DeckSelector'
import { Button } from '@/components/ui/Button'
import { useSession } from '@/hooks/useSession'
import { FormType } from '@/types'
import { savePendingEntry } from '@/lib/pendingEntry'
import { Sparkles } from 'lucide-react'

type StepStatus = 'completed' | 'active' | 'pending'

interface GeneralFormProps {
  onGenerateStart?: () => void
  onStepUpdate?: (stepIndex: number, status: StepStatus) => void
  onGenerateEnd?: () => void
}

export function GeneralForm({ onGenerateStart, onStepUpdate, onGenerateEnd }: GeneralFormProps) {
  const router = useRouter()
  const { session, updateSession, resetContent, isLoaded } = useSession(FormType.GENERAL)

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)

  const deckId = session?.deckId || ''
  const tags = session?.tags || []
  const cardTypes = session?.cardTypeIds || []

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    onGenerateStart?.()

    try {
      // General form không có AI generate — dữ liệu do user nhập thủ công
      // Chỉ chạy qua các steps để UX nhất quán
      onStepUpdate?.(0, 'active')
      await new Promise(r => setTimeout(r, 300))
      onStepUpdate?.(0, 'completed')

      onStepUpdate?.(1, 'active')
      await new Promise(r => setTimeout(r, 200))
      onStepUpdate?.(1, 'completed')

      onStepUpdate?.(2, 'active')
      await new Promise(r => setTimeout(r, 200))
      onStepUpdate?.(2, 'completed')

      // ─── Tạo entry thủ công từ input ───────────────────────────────────────
      const generatedContent = {
        title,
        content,
        word: title, // dùng title như word để CardPreview render được
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
      console.error('Lỗi General form:', err)
      setError(err instanceof Error ? err.message : 'Đã xảy ra lỗi. Vui lòng thử lại.')
      onGenerateEnd?.()
    }
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
      <div className="relative flex items-center gap-3 my-8">
        <div className="flex-1 border-t border-outline-var" />
        <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-gray-400">
          Core Content
        </span>
        <div className="flex-1 border-t border-outline-var" />
      </div>

      {/* ── Card Title ── */}
      <div className="mb-4">
        <label className="text-xs uppercase text-on-surface-var tracking-wider font-bold block mb-2">
          Card Title
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Front side..."
          className="w-full bg-surface-container hover:bg-surface-high transition-colors border-none rounded-2xl px-5 py-4 text-xl font-bold text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-0 appearance-none shadow-none"
        />
      </div>

      {/* ── Content ── */}
      <div className="mb-5">
        <label className="text-xs uppercase text-on-surface-var tracking-wider font-bold block mb-2">
          Content
        </label>
        <Textarea
          placeholder="Back side..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={5}
          className="w-full bg-surface-container hover:bg-surface-high transition-colors border-none rounded-2xl px-5 py-4 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-0 resize-none appearance-none shadow-none"
        />
      </div>

      {/* ── Smart Enrichment Banner ── */}
      <div className="bg-tertiary-fixed/30 border border-tertiary-fixed border-l-[4px] border-l-tertiary rounded-xl p-5 flex items-start gap-4 mb-8">
        <div className="w-10 h-10 rounded-xl bg-tertiary flex items-center justify-center flex-shrink-0 mt-0.5">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-tertiary mb-1">Smart Enrichment Active</p>
          <p className="text-sm text-on-surface-var leading-relaxed">
            Our AI will automatically <strong className="text-on-surface font-bold">format content</strong> and{' '}
            <strong className="text-on-surface font-bold">suggest relevant tags</strong> based on your input.
          </p>
        </div>
      </div>

      {/* ── Error message ── */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-error-container border border-error/30 rounded-xl text-sm text-on-error">
          ⚠️ {error}
        </div>
      )}

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={!title.trim()}
          className="bg-primary hover:bg-primary-container text-white px-10 py-4 text-base font-bold rounded-full shadow-card transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Generate
        </Button>
      </div>
    </form>
  )
}
