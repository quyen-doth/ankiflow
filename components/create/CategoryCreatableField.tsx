'use client'

import { useState, useEffect } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/components/providers/AuthProvider'
import { FieldWrapper } from '@/components/ui/FormField'
import { CreatableSelect } from './CreatableSelect'
import { useToast } from '@/components/ui/Toast'
import { UI_FORM_TYPE_MAP } from '@/lib/constants'
import { createCategory } from '@/lib/create/createDeckCategory'
import { verifyAttrs } from '@/verify/core/contract'
import type { Category, FormType } from '@/types'

type UIFormType = 'Language' | 'IT' | 'General'

interface CategoryCreatableFieldProps {
  formType: UIFormType | ''
  value: string
  onChange: (value: string) => void
  onClear?: () => void
}

/** Pulldown category có tìm kiếm + tạo category mới ngay (không cần popup). Dùng trong Create. */
export function CategoryCreatableField({ formType, value, onChange, onClear }: CategoryCreatableFieldProps) {
  const toast = useToast()
  const { user, loading: authLoading } = useAuth()
  const [categories, setCategories] = useState<Pick<Category, 'id' | 'name' | 'sort_order'>[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)

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
          where('is_active', '==', true),
        )
        const snapshot = await getDocs(q)
        const data = snapshot.docs
          .map(doc => ({ id: doc.id, ...(doc.data() as Pick<Category, 'name' | 'sort_order'>) }))
          .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        setCategories(data)
      } catch (error) {
        console.error('Error fetching categories', error)
      } finally {
        setLoading(false)
      }
    }
    fetchCategories()
  }, [formType, user, authLoading])

  const handleCreate = async (name: string) => {
    if (!formType) return
    setCreating(true)
    try {
      const created = await createCategory({ name, formType: UI_FORM_TYPE_MAP[formType] })
      setCategories(prev => [...prev, { id: created.id, name: created.name, sort_order: 999 }])
      onChange(created.id)
      toast.success(`Đã tạo category “${created.name}”`)
    } catch (e) {
      console.error('Create category error:', e)
      toast.error('Không tạo được category. Vui lòng thử lại.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <FieldWrapper
      label="Category"
      className="text-overline uppercase text-slate-600 tracking-wider font-bold"
      {...verifyAttrs({ unit: 'CategoryCreatableField', count: categories.length, loading })}
    >
      <CreatableSelect
        ariaLabel="Category"
        options={categories.map(c => ({ id: c.id, label: c.name }))}
        value={value}
        onChange={onChange}
        onClear={onClear}
        onCreate={handleCreate}
        placeholder="Select category…"
        createNoun="category"
        createNeedsQuery
        loading={loading}
        creating={creating}
        disabled={!formType}
      />
    </FieldWrapper>
  )
}
