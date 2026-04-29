'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input, Textarea, FieldWrapper, Select } from '@/components/ui/FormField'
import { TopicSelector } from './TopicSelector'
import { Button } from '@/components/ui/Button'
import { useSession } from '@/hooks/useSession'

export function ITForm() {
  const router = useRouter()
  const { session, updateSession, resetContent, isLoaded } = useSession('IT')
  
  const [term, setTerm] = useState('')
  const [definition, setDefinition] = useState('')
  const [keywords, setKeywords] = useState('')

  const topics = session?.topicIds || []
  const difficulty = session?.difficulty || 'intermediate'

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    resetContent()
    setTerm('')
    setDefinition('')
    setKeywords('')
    router.push('/preview')
  }

  if (!isLoaded) return null

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 max-w-2xl">
      <TopicSelector selectedIds={topics} onChange={(v) => updateSession({ topicIds: v })} />

      <FieldWrapper label="Difficulty Level">
        <Select value={difficulty} onChange={(e) => updateSession({ difficulty: e.target.value })}>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </Select>
      </FieldWrapper>

      <div className="border-t border-outline-var/30 pt-6 mt-2">
        <FieldWrapper label="Technical Term">
          <Input 
            placeholder="E.g., Event Loop, Closure..." 
            value={term} 
            onChange={(e) => setTerm(e.target.value)} 
          />
        </FieldWrapper>
      </div>

      <FieldWrapper label="Definition">
        <Textarea 
          placeholder="Definition or concept explanation..." 
          value={definition} 
          onChange={(e) => setDefinition(e.target.value)} 
          rows={3} 
        />
      </FieldWrapper>

      <FieldWrapper label="Keywords">
        <Input 
          placeholder="Keywords (comma separated)..." 
          value={keywords} 
          onChange={(e) => setKeywords(e.target.value)} 
        />
      </FieldWrapper>

      <div className="flex justify-end mt-4">
        <Button type="submit" variant="primary">Generate Draft</Button>
      </div>
    </form>
  )
}
