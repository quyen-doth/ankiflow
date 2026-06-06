'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Textarea, FieldWrapper } from '@/components/ui/FormField'
import { TagInput } from '@/components/ui/TagInput'
import { LanguageSelector } from './LanguageSelector'
import { CategorySelector } from './CategorySelector'
import { CardTypeSelector } from './CardTypeSelector'
import { DeckSelector } from './DeckSelector'
import { Button } from '@/components/ui/Button'
import { useSession } from '@/hooks/useSession'
import { FormType, LanguageType } from '@/types'
import { savePendingEntry } from '@/lib/pendingEntry'
import { Sparkles } from 'lucide-react'

type StepStatus = 'completed' | 'active' | 'pending'

interface LanguageFormProps {
  onGenerateStart?: () => void
  /** Callback cập nhật từng bước trong LoadingOverlay của trang cha */
  onStepUpdate?: (stepIndex: number, status: StepStatus) => void
  /** Callback khi kết thúc (lỗi) — để ẩn overlay */
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

    // 1. Thông báo bắt đầu → hiện LoadingOverlay
    onGenerateStart?.()

    try {
      // ─── Step 0: Gọi Gemini AI ─────────────────────────────────────────────
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
        throw new Error(errData.error || 'Lỗi khi gọi Gemini API')
      }

      const { content: generatedContent } = await generateRes.json()
      onStepUpdate?.(0, 'completed')

      // ─── Step 1: TTS (chạy background, không blocking) ────────────────────
      onStepUpdate?.(1, 'active')
      // TODO: gọi /api/audio khi đã có cấu hình TTS
      // Hiện tại mark completed sau 500ms để UX mượt
      await new Promise(r => setTimeout(r, 500))
      onStepUpdate?.(1, 'completed')

      // ─── Step 2: Unsplash images ───────────────────────────────────────────
      onStepUpdate?.(2, 'active')
      // TODO: gọi /api/image khi đã có Unsplash API key
      await new Promise(r => setTimeout(r, 400))
      onStepUpdate?.(2, 'completed')

      // ─── Lưu kết quả vào localStorage ──────────────────────────────────────
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

      // ─── Reset content fields (giữ session selectors) ──────────────────────
      resetContent()
      setVocabulary('')
      setNotes('')

      // ─── Navigate sang Preview ─────────────────────────────────────────────
      router.push('/preview')

    } catch (err) {
      console.error('Lỗi generate:', err)
      setError(err instanceof Error ? err.message : 'Đã xảy ra lỗi. Vui lòng thử lại.')
      onGenerateEnd?.() // Ẩn loading overlay khi lỗi
    }
  }

  if (!isLoaded) return null

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-0">

      {/* ── Row 1: Language + Deck + Category (3 cột) ── */}
      <div className="grid grid-cols-3 gap-6 mb-6">
        <LanguageSelector value={language} onChange={(v) => updateSession({ language: v })} />
        <DeckSelector
          value={deckId}
          onChange={(id) => updateSession({ deckId: id })}
        />
        <CategorySelector
          formType="Language"
          value={category}
          onChange={(v) => updateSession({ categoryId: v })}
        />
      </div>

      {/* ── Tags ── */}
      <div className="mb-2">
        <FieldWrapper
          label="TAGS"
          className="text-xs text-gray-400 tracking-wider font-normal"
        >
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

      {/* ── Vocabulary Item ── */}
      <div className="mb-6">
        <label className="text-xs uppercase text-on-surface-var tracking-wider font-bold block mb-2">
          Vocabulary Item
        </label>
        <input
          type="text"
          value={vocabulary}
          onChange={(e) => setVocabulary(e.target.value)}
          placeholder=""
          className="w-full bg-surface-container hover:bg-surface-high transition-colors border-none rounded-2xl px-5 py-4 text-xl font-bold text-gray-800 placeholder:text-gray-300 placeholder:font-bold focus:outline-none focus:ring-0 appearance-none shadow-none"
        />
      </div>

      {/* ── Contextual Note ── */}
      <div className="mb-6">
        <label className="text-xs uppercase text-on-surface-var tracking-wider font-bold block mb-2">
          Contextual Note
        </label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder=""
          rows={3}
          className="w-full bg-surface-container hover:bg-surface-high transition-colors border-none rounded-2xl px-5 py-4 text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-0 resize-none appearance-none shadow-none"
        />
      </div>

      {/* ── Divider: CARD GENERATION OPTIONS ── */}
      <div className="relative flex items-center gap-3 my-8">
        <div className="flex-1 border-t border-outline-var" />
        <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-gray-400">
          Card Generation Options
        </span>
        <div className="flex-1 border-t border-outline-var" />
      </div>

      {/* ── Card Type Selector ── */}
      <div className="mb-10">
        <CardTypeSelector
          formType="Language"
          language={language}
          selectedIds={cardTypes}
          onChange={(v) => updateSession({ cardTypeIds: v })}
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
            Our AI will automatically fetch <strong className="text-on-surface font-bold">native audio samples</strong>,{' '}
            <strong className="text-on-surface font-bold">stroke order diagrams</strong>, and{' '}
            <strong className="text-on-surface font-bold">3 context sentences</strong> based on your input.
          </p>
        </div>
      </div>

      {/* ── Error message ── */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-error-container border border-error/30 rounded-xl text-sm text-on-error">
          ⚠️ {error}
        </div>
      )}

      {/* ── Generate Button ── */}
      <div className="flex justify-end mt-4">
        <Button
          type="submit"
          disabled={!vocabulary.trim()}
          className="bg-primary hover:bg-primary-container text-white px-10 py-4 text-base font-bold rounded-full shadow-card transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Generate
        </Button>
      </div>
    </form>
  )
}