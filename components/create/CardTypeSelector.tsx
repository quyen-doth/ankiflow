'use client'

import { useState, useEffect } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Toggle } from '@/components/ui/Toggle'
import { Button } from '@/components/ui/Button'
import { FieldWrapper } from '@/components/ui/FormField'
import { UI_FORM_TYPE_MAP } from '@/lib/constants'
import type { CardTypeConfig, LanguageType } from '@/types'

type UIFormType = 'Language' | 'IT' | 'General'

interface CardTypeSelectorProps {
  formType?: UIFormType
  language?: LanguageType | ''
  selectedIds: string[]
  onChange: (ids: string[]) => void
}

export function CardTypeSelector({ formType = 'Language', language, selectedIds, onChange }: CardTypeSelectorProps) {
  const [cardTypes, setCardTypes] = useState<Pick<CardTypeConfig, 'id' | 'name' | 'description' | 'language' | 'sort_order'>[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchCardTypes() {
      setLoading(true)
      try {
        const dbFormType = UI_FORM_TYPE_MAP[formType]
        const q = query(
          collection(db, 'card_types'),
          where('form_type', '==', dbFormType),
          where('is_active', '==', true)
        )
        const snapshot = await getDocs(q)
        let data = snapshot.docs
          .map(doc => ({ id: doc.id, ...(doc.data() as Pick<CardTypeConfig, 'name' | 'description' | 'language' | 'sort_order'>) }))

        // Filter theo ngôn ngữ nếu là Language form
        if (formType === 'Language' && language) {
          data = data.filter(ct => !ct.language || ct.language === language)
        }

        data.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        setCardTypes(data)
      } catch (error) {
        console.error("Error fetching card types", error)
      } finally {
        setLoading(false)
      }
    }
    fetchCardTypes()
  }, [formType, language])

  const handleToggle = (id: string, checked: boolean) => {
    onChange(checked ? [...selectedIds, id] : selectedIds.filter(v => v !== id))
  }

  const selectAll = () => onChange(cardTypes.map(ct => ct.id))
  const clearAll = () => onChange([])

  return (
    <FieldWrapper label="Generated Card Types">
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs text-on-surface-var">
          {loading ? 'Loading card types...' : 'Select formats to generate'}
        </span>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={selectAll} disabled={loading}>Select All</Button>
          <Button type="button" variant="ghost" size="sm" onClick={clearAll} disabled={loading}>Clear</Button>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {cardTypes.map(ct => (
          <Toggle
            key={ct.id}
            label={ct.name}
            description={ct.description}
            checked={selectedIds.includes(ct.id)}
            onChange={(checked) => handleToggle(ct.id, checked)}
          />
        ))}
      </div>
    </FieldWrapper>
  )
}
