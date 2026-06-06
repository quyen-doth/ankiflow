'use client'

import { useState, useEffect } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Button } from '@/components/ui/Button'
import { UI_FORM_TYPE_MAP } from '@/lib/constants'
import { cn } from '@/lib/utils'
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

        if (formType === 'Language' && language) {
          data = data.filter(ct => !ct.language || ct.language === language)
        }

        data.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        setCardTypes(data)
      } catch (error) {
        console.error('Error fetching card types', error)
      } finally {
        setLoading(false)
      }
    }
    fetchCardTypes()
  }, [formType, language])

  const handleToggle = (id: string) => {
    onChange(selectedIds.includes(id)
      ? selectedIds.filter(v => v !== id)
      : [...selectedIds, id]
    )
  }

  const selectAll = () => onChange(cardTypes.map(ct => ct.id))
  const clearAll = () => onChange([])

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <label className="text-xs uppercase text-on-surface-var tracking-wider font-bold">
          {loading ? 'Loading card types...' : 'Generated Card Types'}
        </label>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={selectAll} disabled={loading}>Select All</Button>
          <Button type="button" variant="ghost" size="sm" onClick={clearAll} disabled={loading}>Clear</Button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-16 rounded-xl bg-surface-container animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {cardTypes.map(ct => {
            const isChecked = selectedIds.includes(ct.id)
            return (
              <label
                key={ct.id}
                className={cn(
                  'flex items-center gap-3 p-4 rounded-xl cursor-pointer border transition-all duration-150',
                  isChecked
                    ? 'border-primary/50 bg-primary/5'
                    : 'border-transparent bg-surface-container hover:bg-surface-high'
                )}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => handleToggle(ct.id)}
                  className="w-4 h-4 rounded border-outline-var text-primary focus:ring-primary/30 flex-shrink-0"
                />
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-bold text-on-surface truncate">{ct.name}</span>
                  {ct.description && (
                    <span className="text-[10px] text-on-surface-var uppercase font-semibold tracking-wide truncate">
                      {ct.description}
                    </span>
                  )}
                </div>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}
