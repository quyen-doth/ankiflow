'use client'

import { useState, useCallback, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { PageHeader } from '@/components/layout/PageHeader'
import { LanguageForm } from '@/components/create/LanguageForm'
import { ITForm } from '@/components/create/ITForm'
import { GeneralForm } from '@/components/create/GeneralForm'
import { DynamicForm } from '@/components/create/DynamicForm'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { Languages, Terminal, BookOpen, SlidersHorizontal, Check, Sparkles, CheckCircle, X } from 'lucide-react'
import { FormType } from '@/types'
import type { ContentType } from '@/types'

const ICON_MAP: Record<string, React.ElementType> = {
  Languages,
  Terminal,
  BookOpen,
  SlidersHorizontal,
}

const BUILTIN_ICONS: Record<string, React.ElementType> = {
  [FormType.LANGUAGE]: Languages,
  [FormType.IT]: Terminal,
  [FormType.GENERAL]: BookOpen,
}

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

function resolveIcon(contentType: ContentType): React.ElementType {
  if (BUILTIN_ICONS[contentType.code]) return BUILTIN_ICONS[contentType.code]
  if (contentType.icon && ICON_MAP[contentType.icon]) return ICON_MAP[contentType.icon]
  return BookOpen
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function CreatePage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [contentTypes, setContentTypes] = useState<ContentType[]>([])
  const [loadingTypes, setLoadingTypes] = useState(true)
  const [activeCode, setActiveCode] = useState<string>('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [loadingSteps, setLoadingSteps] = useState<LoadingStep[]>(INITIAL_STEPS)
  const [progress, setProgress] = useState(0)
  const [canSubmit, setCanSubmit] = useState(false)
  const [successBanner, setSuccessBanner] = useState<{ count: number } | null>(null)

  useEffect(() => {
    async function fetchContentTypes() {
      try {
        const q = query(
          collection(db, 'content_types'),
          where('is_active', '==', true),
          orderBy('sort_order', 'asc'),
        )
        const snapshot = await getDocs(q)
        const types = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ContentType))
        setContentTypes(types)
        if (types.length > 0 && !activeCode) {
          setActiveCode(types[0].code)
        }
      } catch (error) {
        console.error('Error fetching content types:', error)
      } finally {
        setLoadingTypes(false)
      }
    }
    fetchContentTypes()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (searchParams.get('exported') === '1') {
      const count = parseInt(searchParams.get('count') || '0', 10)
      setSuccessBanner({ count })
      router.replace('/create', { scroll: false })
      const timer = setTimeout(() => setSuccessBanner(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [searchParams, router])

  const activeType = contentTypes.find(t => t.code === activeCode)

  const handleStepUpdate = useCallback((stepIndex: number, status: StepStatus) => {
    setLoadingSteps(prev => prev.map((s, i) => (i === stepIndex ? { ...s, status } : s)))
    const completedSteps = stepIndex + (status === 'completed' ? 1 : 0)
    setProgress(Math.round((completedSteps / INITIAL_STEPS.length) * 100))
  }, [])

  const handleGenerateStart = useCallback(() => {
    setIsGenerating(true)
    setLoadingSteps(INITIAL_STEPS)
    setProgress(0)
  }, [])

  const handleGenerateEnd = useCallback(() => {
    setIsGenerating(false)
  }, [])

  const handleSelectType = useCallback((code: string) => {
    setActiveCode(code)
    setCanSubmit(false)
  }, [])

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

  const isBuiltIn = (code: string) =>
    code === FormType.LANGUAGE || code === FormType.IT || code === FormType.GENERAL

  return (
    <>
      <PageHeader
        crumbs={[
          { label: 'Create Card', href: '/create' },
          { label: `${activeType?.name ?? 'Card'} Flow` },
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

        {/* Content Type — pill row + Generate */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            {loadingTypes ? (
              <div className="h-10 w-48 bg-surface-container rounded-full animate-pulse" />
            ) : (
              <>
                {contentTypes.map((ct) => {
                  const Icon = resolveIcon(ct)
                  const isActive = activeCode === ct.code
                  return (
                    <button
                      key={ct.id}
                      type="button"
                      onClick={() => handleSelectType(ct.code)}
                      className={cn(
                        'relative flex items-center gap-2.5 pl-4 pr-5 py-2.5 rounded-full border transition-all duration-150 outline-none',
                        'focus-visible:ring-2 focus-visible:ring-primary/40',
                        isActive
                          ? 'border-primary bg-primary/10 text-primary font-bold shadow-card'
                          : 'border-transparent bg-surface-container text-on-surface-var hover:bg-surface-high',
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-sm">{ct.name}</span>
                      {isActive && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </button>
                  )
                })}
                <button
                  type="button"
                  onClick={() => router.push('/admin?tab=content-types')}
                  className={cn(
                    'relative flex items-center gap-2.5 pl-4 pr-5 py-2.5 rounded-full border transition-all duration-150 outline-none',
                    'focus-visible:ring-2 focus-visible:ring-primary/40',
                    'border-transparent bg-surface-container text-on-surface-var hover:bg-surface-high',
                  )}
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  <span className="text-sm">Custom</span>
                </button>
              </>
            )}
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

        {/* Workspace — Form */}
        <div>
          {activeCode === FormType.LANGUAGE && (
            <LanguageForm
              onGenerateStart={handleGenerateStart}
              onStepUpdate={handleStepUpdate}
              onGenerateEnd={handleGenerateEnd}
              onValidityChange={setCanSubmit}
              formId={FORM_ID}
            />
          )}
          {activeCode === FormType.IT && (
            <ITForm
              onGenerateStart={handleGenerateStart}
              onStepUpdate={handleStepUpdate}
              onGenerateEnd={handleGenerateEnd}
              onValidityChange={setCanSubmit}
              formId={FORM_ID}
            />
          )}
          {activeCode === FormType.GENERAL && (
            <GeneralForm
              onGenerateStart={handleGenerateStart}
              onStepUpdate={handleStepUpdate}
              onGenerateEnd={handleGenerateEnd}
              onValidityChange={setCanSubmit}
              formId={FORM_ID}
            />
          )}
          {activeType && !isBuiltIn(activeCode) && (
            <DynamicForm
              key={activeType.id}
              contentType={activeType}
              onGenerateStart={handleGenerateStart}
              onStepUpdate={handleStepUpdate}
              onGenerateEnd={handleGenerateEnd}
              onValidityChange={setCanSubmit}
              formId={FORM_ID}
            />
          )}
        </div>
      </div>

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
