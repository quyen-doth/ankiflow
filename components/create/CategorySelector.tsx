'use client'

import { useState, useEffect } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/components/providers/AuthProvider'
import { Select, FieldWrapper } from '@/components/ui/FormField'
import { ClearSelectButton } from '@/components/create/ClearSelectButton'
import { UI_FORM_TYPE_MAP } from '@/lib/constants'
import { verifyAttrs } from '@/verify/core/contract'
import type { Category, FormType } from '@/types'

// formType を UI ラベルで受け取る — Firestore enum への mapping は component 内部で行う
type UIFormType = 'Language' | 'IT' | 'General'

interface CategorySelectorProps {
  formType: UIFormType | ''
  value: string
  onChange: (value: string) => void
  onClear?: () => void
}

export function CategorySelector({ formType, value, onChange, onClear }: CategorySelectorProps) {
  const { user, loading: authLoading } = useAuth()
  const [categories, setCategories] = useState<Pick<Category, 'id' | 'name' | 'sort_order'>[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (authLoading || !user) return
    const uid = user.uid
    async function fetchCategories() {
      if (!formType) {
        setCategories([])
        return
      }
      setLoading(true)
      try {
        const dbFormType: FormType = UI_FORM_TYPE_MAP[formType]
        const q = query(
          collection(db, 'categories'),
          where('user_id', '==', uid),
          where('form_type', '==', dbFormType),
          where('is_active', '==', true)
        )
        const snapshot = await getDocs(q)
        const data = snapshot.docs
          .map(doc => ({ id: doc.id, ...(doc.data() as Pick<Category, 'name' | 'sort_order'>) }))
          .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        setCategories(data)
      } catch (error) {
        console.error("Error fetching categories", error)
      } finally {
        setLoading(false)
      }
    }
    fetchCategories()
  }, [formType, user, authLoading])

  return (
    <FieldWrapper
      label="Category"
      className="text-overline uppercase text-slate-600 tracking-wider font-bold"
      {...verifyAttrs({ unit: 'CategorySelector', count: categories.length, loading })}
    >
      <div className="relative">
        <Select
          aria-label="Category"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={!formType || loading}
          className="w-full bg-surface hover:bg-canvas transition-colors border border-transparent rounded-lg px-4 py-3 text-sm text-ink focus-visible:ring-2 focus-visible:ring-primary-bg cursor-pointer appearance-none"
        >
          <option value="" disabled>{loading ? 'Loading...' : 'Select category...'}</option>
          {categories.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </Select>
        <ClearSelectButton show={!!value && !!onClear} onClear={onClear} label="Clear selected category" />
      </div>
    </FieldWrapper>
  )
}
