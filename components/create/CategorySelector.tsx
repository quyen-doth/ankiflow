'use client'

import { useState, useEffect } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Select, FieldWrapper } from '@/components/ui/FormField'
import { UI_FORM_TYPE_MAP } from '@/lib/constants'
import type { Category, FormType } from '@/types'

// Nhận formType theo UI label — mapping sang Firestore enum trong nội bộ component
type UIFormType = 'Language' | 'IT' | 'General'

interface CategorySelectorProps {
  formType: UIFormType | ''
  value: string
  onChange: (value: string) => void
}

export function CategorySelector({ formType, value, onChange }: CategorySelectorProps) {
  const [categories, setCategories] = useState<Pick<Category, 'id' | 'name' | 'sort_order'>[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
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
  }, [formType])

  return (
    <FieldWrapper label="Category">
      <Select value={value} onChange={(e) => onChange(e.target.value)} disabled={!formType || loading}>
        <option value="" disabled>{loading ? 'Loading...' : 'Select category...'}</option>
        {categories.map(cat => (
          <option key={cat.id} value={cat.id}>{cat.name}</option>
        ))}
      </Select>
    </FieldWrapper>
  )
}
