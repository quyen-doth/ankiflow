'use client'

import { useState, useCallback } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { LanguageForm } from '@/components/create/LanguageForm'
import { ITForm } from '@/components/create/ITForm'
import { GeneralForm } from '@/components/create/GeneralForm'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import { cn } from '@/lib/utils'
import { Languages, Terminal, BookOpen, SlidersHorizontal, Check } from 'lucide-react'

// ─── Content Type ────────────────────────────────────────────────────────────
type ContentType = 'Language' | 'IT' | 'General' | 'Custom'

const CONTENT_TYPES: {
  id: ContentType
  label: string
  icon: React.ElementType
  disabled?: boolean
}[] = [
  { id: 'Language', label: 'Language',  icon: Languages },
  { id: 'IT',       label: 'IT & Dev',  icon: Terminal },
  { id: 'General',  label: 'General',   icon: BookOpen },
  { id: 'Custom',   label: 'Custom',    icon: SlidersHorizontal, disabled: true },
]

// ─── Step types cho Loading Overlay ─────────────────────────────────────────
type StepStatus = 'completed' | 'active' | 'pending'

interface LoadingStep {
  label: string
  description?: string
  status: StepStatus
}

const INITIAL_STEPS: LoadingStep[] = [
  { label: 'Calling Gemini AI', status: 'active' },
  { label: 'Generating audio (TTS)', status: 'pending' },
  { label: 'Finding images (Unsplash)', status: 'pending' },
]

// ─── Step Badge ──────────────────────────────────────────────────────────────
function StepBadge({ number, label }: { number: number; label: string }) {
  return (
    <div className="flex items-center gap-4 mb-6">
      <span className="w-8 h-8 rounded-full bg-primary/10 text-primary text-base font-bold flex items-center justify-center flex-shrink-0">
        {number}
      </span>
      <h2 className="text-xl font-bold text-primary">{label}</h2>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function CreatePage() {
  const [formType, setFormType] = useState<ContentType>('Language')
  const [isGenerating, setIsGenerating] = useState(false)
  const [loadingSteps, setLoadingSteps] = useState<LoadingStep[]>(INITIAL_STEPS)
  const [progress, setProgress] = useState(0)

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

  return (
    <>
      <PageHeader
        crumbs={[
          { label: 'Create Card', href: '/create' },
          { label: `${activeType?.label ?? formType} Flow` },
        ]}
      />

      <div className="max-w-4xl flex flex-col gap-10 mx-auto w-full pb-12">

        {/* Step 1 — Select Content Type */}
        <section className="px-2">
          <StepBadge number={1} label="Select Content Type" />

          <div className="grid grid-cols-4 gap-4">
            {CONTENT_TYPES.map(({ id, label, icon: Icon, disabled }) => {
              const isActive = formType === id
              return (
                <button
                  key={id}
                  type="button"
                  disabled={disabled}
                  onClick={() => !disabled && setFormType(id)}
                  className={cn(
                    'relative flex flex-col items-center justify-center gap-4 py-8 px-4 rounded-xl border-2 transition-all duration-200 outline-none',
                    isActive
                      ? 'border-primary bg-white text-primary shadow-card'
                      : 'border-transparent bg-surface-container text-on-surface-var hover:bg-surface-high',
                    disabled && 'opacity-40 cursor-not-allowed'
                  )}
                >
                  {isActive && (
                    <span className="absolute top-3 right-3 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-card">
                      <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                    </span>
                  )}
                  <div className={cn(
                    'w-14 h-14 rounded-full flex items-center justify-center transition-colors',
                    isActive ? 'bg-primary/10' : 'bg-on-surface/5'
                  )}>
                    <Icon className={cn('w-6 h-6', isActive ? 'text-primary' : 'text-on-surface-var')} />
                  </div>
                  <span className="text-base font-bold">{label}</span>
                </button>
              )
            })}
          </div>
        </section>

        {/* Step 2 — Configure Form */}
        <section className="bg-white rounded-xl shadow-card p-8 lg:p-10">
          <StepBadge
            number={2}
            label={`Configure ${activeType?.label ?? formType} Card`}
          />

          <div className="mt-6">
            {formType === 'Language' && (
              <LanguageForm
                onGenerateStart={handleGenerateStart}
                onStepUpdate={handleStepUpdate}
                onGenerateEnd={handleGenerateEnd}
              />
            )}
            {formType === 'IT' && (
              <ITForm
                onGenerateStart={handleGenerateStart}
                onStepUpdate={handleStepUpdate}
                onGenerateEnd={handleGenerateEnd}
              />
            )}
            {formType === 'General' && (
              <GeneralForm
                onGenerateStart={handleGenerateStart}
                onStepUpdate={handleStepUpdate}
                onGenerateEnd={handleGenerateEnd}
              />
            )}
          </div>
        </section>
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