'use client'

import { useState, useEffect } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Badge } from '@/components/ui/Badge'
import { FieldWrapper } from '@/components/ui/FormField'
import { FormType } from '@/types'
import type { Topic } from '@/types'

interface TopicSelectorProps {
  selectedIds: string[]
  onChange: (ids: string[]) => void
}

// Chỉ dùng trong IT form — fetch topics với form_type = FormType.IT
export function TopicSelector({ selectedIds, onChange }: TopicSelectorProps) {
  const [topics, setTopics] = useState<Pick<Topic, 'id' | 'name' | 'sort_order'>[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchTopics() {
      try {
        const q = query(
          collection(db, 'topics'),
          where('form_type', '==', FormType.IT),
          where('is_active', '==', true)
        )
        const snapshot = await getDocs(q)
        const data = snapshot.docs
          .map(doc => ({ id: doc.id, ...(doc.data() as Pick<Topic, 'name' | 'sort_order'>) }))
          .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        setTopics(data)
      } catch (error) {
        console.error("Error fetching topics", error)
      } finally {
        setLoading(false)
      }
    }
    fetchTopics()
  }, [])

  const toggleTopic = (id: string) => {
    onChange(selectedIds.includes(id)
      ? selectedIds.filter(v => v !== id)
      : [...selectedIds, id]
    )
  }

  return (
    <FieldWrapper label="Topics">
      {loading ? (
        <span className="text-sm text-on-surface-var">Loading topics...</span>
      ) : (
        <div className="flex flex-wrap gap-2">
          {topics.map(topic => (
            <button
              key={topic.id}
              type="button"
              onClick={() => toggleTopic(topic.id)}
              className="transition-transform active:scale-95"
            >
              <Badge variant={selectedIds.includes(topic.id) ? 'active' : 'neutral'} className="px-3 py-1.5">
                {topic.name}
              </Badge>
            </button>
          ))}
        </div>
      )}
    </FieldWrapper>
  )
}
