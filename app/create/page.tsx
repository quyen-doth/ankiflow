'use client'

import { useState, useCallback, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { LanguageForm } from '@/components/create/LanguageForm'
import { ITForm } from '@/components/create/ITForm'
import { GeneralForm } from '@/components/create/GeneralForm'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { Languages, Terminal, BookOpen, SlidersHorizontal, Check, Sparkles, CheckCircle, X } from 'lucide-react'

// ─── Content Type ────────────────────────────────────────────────────────────
type ContentType = 'Language' | 'IT' | 'General' | 'Custom'

const CONTENT_TYPES: {
  id: ContentType
  label: string
  icon: React.ElementType
  href?: string
}[] = [
  { id: 'Language', label: 'Language',  icon: Languages },
  { id: 'IT',       label: 'IT & Dev',  icon: Terminal },
  { id: 'General',  label: 'General',   icon: BookOpen },
  { id: 'Custom',   label: 'Custom',    icon: SlidersHorizontal, href: '/admin?tab=content-types' },
]

// ─── Step types cho Loading Overlay ─────────────────────────────────────────
type StepStatus = 'completed' | 'active' | 'pending'

interface LoadingStep {
  label: string
  description?: string
  status: StepStatus
}

const INITIAL_STEPS: LoadingStep[] = [
  { label: 'Calling Claude AI', status: 'active' },
  { label: 'Generating audio (TTS)', status: 'pending' },
  { label: 'Finding images (Unsplash)', status: 'pending' },
]

const FORM_ID = 'create-form'

// ─── Page ────────────────────────────────────────────────────────────────────
export default function CreatePage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [formType, setFormType] = useState<ContentType>('Language')
  const [isGenerating, setIsGenerating] = useState(false)
  const [loadingSteps, setLoadingSteps] = useState<LoadingStep[]>(INITIAL_STEPS)
  const [progress, setProgress] = useState(0)
  const [canSubmit, setCanSubmit] = useState(false)
  const [successBanner, setSuccessBanner] = useState<{ count: number } | null>(null)

  useEffect(() => {
    if (searchParams.get('exported') === '1') {
      const count = parseInt(searchParams.get('count') || '0', 10)
      setSuccessBanner({ count })
      router.replace('/create', { scroll: false })
      const timer = setTimeout(() => setSuccessBanner(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [searchParams, router])

  const activeType = CONTENT_TYPES.find(t => t.id === formType)

  /** Callback nhận từ form — cập nhật step trong LoadingOverlay */
  const handleStepUpdate = useCallback((stepIndex: number, status: StepStatus) => {
    setLoadingSteps(prev => prev.map((s, i) => (i === stepIndex ? { ...s, status } : s)))
    // Tính progress: mỗi step hoàn thành = 33%
    const completedSteps = stepIndex + (status === 'completed' ? 1 : 0)
    setProgress(Math.round((completedSteps / INITIAL_STEPS.length) * 100))
  }, [])

  /** Bắt đầu loading — gọi từ form ngay khi submit */
  const handleGenerateStart = useCallback(() => {
    setIsGenerating(true)
    setLoadingSteps(INITIAL_STEPS)
    setProgress(0)
  }, [])

  /** Kết thúc loading (lỗi hoặc navigate) */
  const handleGenerateEnd = useCallback(() => {
    setIsGenerating(false)
  }, [])

  // Đổi loại nội dung → form mount lại, validity reset cho tới khi form báo lại
  const handleSelectType = useCallback((id: ContentType) => {
    setFormType(id)
    setCanSubmit(false)
  }, [])

  // Shortcut Cmd+Enter (Mac) / Ctrl+Enter (Win) để submit form đang active
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        if (!canSubmit || isGenerating) return
        const form = document.getElementById(FORM_ID) as HTMLFormElement | null
        form?.requestSubmit()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [canSubmit, isGenerating])

  return (
    <>
      <PageHeader
        crumbs={[
          { label: 'Create Card', href: '/create' },
          { label: `${activeType?.label ?? formType} Flow` },
        ]}
        title=""
      />

      {successBanner && (
        <div className="max-w-6xl mx-auto w-full px-0 mb-2">
          <div className="flex items-center gap-3 bg-primary/10 border border-primary/30 rounded-xl px-5 py-3">
            <CheckCircle className="w-5 h-5 text-primary flex-shrink-0" />
            <p className="text-sm font-medium text-on-surface flex-1">
              Successfully exported {successBanner.count} card{successBanner.count !== 1 ? 's' : ''} to Anki!
            </p>
            <button type="button" onClick={() => setSuccessBanner(null)} className="text-on-surface-var hover:text-on-surface">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto w-full pb-6 flex flex-col gap-6">

        {/* Content Type — pill row + Generate (same row, same height) */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            {CONTENT_TYPES.map(({ id, label, icon: Icon, href }) => {
              const isActive = formType === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => href ? router.push(href) : handleSelectType(id)}
                  className={cn(
                    'relative flex items-center gap-2.5 pl-4 pr-5 py-2.5 rounded-full border transition-all duration-150 outline-none',
                    'focus-visible:ring-2 focus-visible:ring-primary/40',
                    isActive
                      ? 'border-primary bg-primary/10 text-primary font-bold shadow-card'
                      : 'border-transparent bg-surface-container text-on-surface-var hover:bg-surface-high',
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm">{label}</span>
                  {isActive && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </button>
              )
            })}
          </div>

          <Button
            type="submit"
            form={FORM_ID}
            size="md"
            disabled={!canSubmit || isGenerating}
            leftIcon={<Sparkles className="w-4 h-4" />}
            className="shadow-card"
          >
            Generate
            <kbd className="ml-2 text-xs font-semibold opacity-70 tracking-wide">⌘⏎</kbd>
          </Button>
        </div>

        {/* Workspace — Core Content (left) + Configuration (right), each its own section */}
        <div>
          {formType === 'Language' && (
            <LanguageForm
              onGenerateStart={handleGenerateStart}
              onStepUpdate={handleStepUpdate}
              onGenerateEnd={handleGenerateEnd}
              onValidityChange={setCanSubmit}
              formId={FORM_ID}
            />
          )}
          {formType === 'IT' && (
            <ITForm
              onGenerateStart={handleGenerateStart}
              onStepUpdate={handleStepUpdate}
              onGenerateEnd={handleGenerateEnd}
              onValidityChange={setCanSubmit}
              formId={FORM_ID}
            />
          )}
          {formType === 'General' && (
            <GeneralForm
              onGenerateStart={handleGenerateStart}
              onStepUpdate={handleStepUpdate}
              onGenerateEnd={handleGenerateEnd}
              onValidityChange={setCanSubmit}
              formId={FORM_ID}
            />
          )}
        </div>
      </div>

      {/* Loading Overlay — hiển thị tiến trình generate thực tế */}
      <LoadingOverlay
        open={isGenerating}
        title="Generating Cognitive Asset"
        steps={loadingSteps}
        progress={progress}
        flowTip="Tip: Short example sentences help your brain retain words 3-5x faster than long definitions."
      />
    </>
  )
}
