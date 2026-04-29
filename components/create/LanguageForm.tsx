'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input, Textarea, FieldWrapper } from '@/components/ui/FormField'
import { TagInput } from '@/components/ui/TagInput'
import { LanguageSelector } from './LanguageSelector'
import { CategorySelector } from './CategorySelector'
import { CardTypeSelector } from './CardTypeSelector'
import { Button } from '@/components/ui/Button'
import { useSession } from '@/hooks/useSession'
import { FormType, LanguageType } from '@/types'

export function LanguageForm() {
  const router = useRouter()
  const { session, updateSession, resetContent, isLoaded } = useSession(FormType.LANGUAGE)

  const [vocabulary, setVocabulary] = useState('')
  const [notes, setNotes] = useState('')

  // Ép kiểu an toàn — session.language đã được lưu dưới dạng LanguageType enum
  const language = (session?.language as LanguageType) || LanguageType.ENGLISH
  const category = session?.categoryId || ''
  const tags = session?.tags || []
  const cardTypes = session?.cardTypeIds || []

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    resetContent()
    setVocabulary('')
    setNotes('')
    router.push('/preview')
  }

  if (!isLoaded) return null

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 max-w-2xl">
      <LanguageSelector
        value={language}
        onChange={(v) => updateSession({ language: v })}
      />

      <CategorySelector
        formType="Language"
        value={category}
        onChange={(v) => updateSession({ categoryId: v })}
      />

      <FieldWrapper label="Tags">
        <TagInput tags={tags} onChange={(v) => updateSession({ tags: v })} />
      </FieldWrapper>

      <CardTypeSelector
        formType="Language"
        language={language}
        selectedIds={cardTypes}
        onChange={(v) => updateSession({ cardTypeIds: v })}
      />

      <div className="border-t border-outline-var/30 pt-6 mt-2">
        <FieldWrapper label="Vocabulary">
          <Input
            placeholder="Enter vocabulary..."
            value={vocabulary}
            onChange={(e) => setVocabulary(e.target.value)}
          />
        </FieldWrapper>
      </div>

      <FieldWrapper label="Notes">
        <Textarea
          placeholder="Context, sentence, or grammar notes..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
        />
      </FieldWrapper>

      <div className="flex justify-end mt-4">
        <Button type="submit" variant="primary">Generate Draft</Button>
      </div>
    </form>
  )
}
