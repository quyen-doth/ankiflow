'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { LanguageForm } from '@/components/create/LanguageForm'
import { ITForm } from '@/components/create/ITForm'
import { GeneralForm } from '@/components/create/GeneralForm'
import { DeckSelector } from '@/components/create/DeckSelector'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'

export default function CreatePage() {
  const [formType, setFormType] = useState<'Language' | 'IT' | 'General'>('Language')
  const [isGenerating, setIsGenerating] = useState(false)
  const [deck, setDeck] = useState('')

  return (
    <>
      <PageHeader
        crumbs={[
          { label: 'Create Card', href: '/create' },
          { label: `${formType} Flow` },
        ]}
        description="Select a deck and provide content to generate your flashcards."
      />

      <div className="bg-white rounded-xl shadow-card border border-outline-var/40 p-8 max-w-3xl">
        <div className="mb-8 pb-8 border-b border-outline-var/30">
          <DeckSelector 
            value={deck}
            onChange={(val, type) => {
              setDeck(val)
              setFormType(type)
            }}
          />
        </div>

        {formType === 'Language' && <LanguageForm />}
        {formType === 'IT' && <ITForm />}
        {formType === 'General' && <GeneralForm />}
      </div>

      <LoadingOverlay
        open={isGenerating}
        title="Generating Cognitive Asset"
        steps={[
          { label: 'Calling Gemini AI', status: 'active' },
          { label: 'Generating audio', status: 'pending' },
          { label: 'Finding images', status: 'pending' },
        ]}
        progress={33}
      />
    </>
  )
}
