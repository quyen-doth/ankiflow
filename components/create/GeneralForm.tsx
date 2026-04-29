'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input, Textarea, FieldWrapper } from '@/components/ui/FormField'
import { TagInput } from '@/components/ui/TagInput'
import { Button } from '@/components/ui/Button'
import { useSession } from '@/hooks/useSession'

export function GeneralForm() {
  const router = useRouter()
  const { session, updateSession, resetContent, isLoaded } = useSession('General')
  
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  
  const tags = session?.tags || []

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    resetContent()
    setTitle('')
    setContent('')
    router.push('/preview')
  }

  if (!isLoaded) return null

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 max-w-2xl">
      <div className="flex flex-col gap-6">
        <FieldWrapper label="Card Title">
          <Input 
            placeholder="Front side..." 
            value={title} 
            onChange={(e) => setTitle(e.target.value)} 
          />
        </FieldWrapper>

        <FieldWrapper label="Content">
          <Textarea 
            placeholder="Back side..." 
            value={content} 
            onChange={(e) => setContent(e.target.value)} 
            rows={5} 
          />
        </FieldWrapper>
      </div>

      <FieldWrapper label="Tags">
        <TagInput tags={tags} onChange={(v) => updateSession({ tags: v })} />
      </FieldWrapper>

      <div className="flex justify-end mt-4">
        <Button type="submit" variant="primary">Generate Draft</Button>
      </div>
    </form>
  )
}
