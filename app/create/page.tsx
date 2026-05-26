'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { LanguageForm } from '@/components/create/LanguageForm'
import { ITForm } from '@/components/create/ITForm'
import { GeneralForm } from '@/components/create/GeneralForm'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import { cn } from '@/lib/utils'
import { Languages, Terminal, BookOpen, SlidersHorizontal, Check } from 'lucide-react'

// ─── Content Type Selector ─────────────────────────────────────────────────
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

// ─── Step Badge ─────────────────────────────────────────────────────────────
function StepBadge({ number, label }: { number: number; label: string }) {
  return (
    <div className="flex items-center gap-4 mb-6">
      <span className="w-8 h-8 rounded-full bg-[#F6F4EF] text-[#316342] text-lg font-bold flex items-center justify-center flex-shrink-0">
        {number}
      </span>
      <h2 className="text-xl font-bold text-[#316342]">{label}</h2>
    </div>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────
export default function CreatePage() {
  const router = useRouter()
  const [formType, setFormType] = useState<ContentType>('Language')
  const [isGenerating, setIsGenerating] = useState(false)

  const activeType = CONTENT_TYPES.find(t => t.id === formType)

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
                    'relative flex flex-col items-center justify-center gap-4 py-8 px-4 rounded-[1.5rem] border-2 transition-all duration-200 outline-none',
                    isActive
                      ? 'border-[#316342] bg-white text-[#316342] shadow-sm'
                      : 'border-transparent bg-[#F6F4EF] text-gray-700 hover:bg-[#EFECE5]',
                    disabled && 'opacity-40 cursor-not-allowed'
                  )}
                >
                  {isActive && (
                    <span className="absolute top-4 right-4 w-6 h-6 rounded-full bg-[#316342] flex items-center justify-center shadow-sm">
                      <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                    </span>
                  )}
                  {/* Vòng tròn bọc Icon */}
                  <div className={cn(
                    'w-14 h-14 rounded-full flex items-center justify-center transition-colors',
                    isActive ? 'bg-[#316342]/10' : 'bg-black/5'
                  )}>
                    <Icon className={cn('w-6 h-6', isActive ? 'text-[#316342]' : 'text-gray-600')} />
                  </div>
                  <span className="text-base font-bold">{label}</span>
                </button>
              )
            })}
          </div>
        </section>

        {/* Step 2 — Configure Form */}
        <section className="bg-white rounded-[2rem] shadow-sm p-8 lg:p-10">
          <StepBadge
            number={2}
            label={`Configure ${activeType?.label ?? formType} Card`}
          />

          <div className="mt-6">
            {formType === 'Language' && (
              <LanguageForm onGenerateStart={() => setIsGenerating(true)} />
            )}
            {formType === 'IT' && (
              <ITForm onGenerateStart={() => setIsGenerating(true)} />
            )}
            {formType === 'General' && (
              <GeneralForm onGenerateStart={() => setIsGenerating(true)} />
            )}
          </div>
        </section>
      </div>

      {/* Loading Overlay */}
      <LoadingOverlay
        open={isGenerating}
        title="Generating Cognitive Asset"
        steps={[
          { label: 'Calling Gemini AI', status: 'active' },
          { label: 'Generating audio (TTS)', status: 'pending' },
          { label: 'Finding images (Unsplash)', status: 'pending' },
        ]}
        progress={33}
      />
    </>
  )
}