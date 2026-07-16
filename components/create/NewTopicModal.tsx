'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { FieldWrapper, Input } from '@/components/ui/FormField'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { verifyAttrs } from '@/verify/core/contract'

interface NewTopicModalProps {
  open: boolean
  onClose: () => void
  onCreate: (name: string) => Promise<void>
}

export function NewTopicModal({ open, onClose, onCreate }: NewTopicModalProps) {
  return (
    <div {...verifyAttrs({ unit: 'NewTopicModal', open })}>
      <Modal
        open={open}
        onClose={onClose}
        title="New Topic"
        description="Create a topic without leaving the Create page."
        size="sm"
      >
        {open && <NewTopicForm onClose={onClose} onCreate={onCreate} />}
      </Modal>
    </div>
  )
}

interface NewTopicFormProps {
  onClose: () => void
  onCreate: (name: string) => Promise<void>
}

function NewTopicForm({ onClose, onCreate }: NewTopicFormProps) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  const handleClose = () => {
    if (!saving) onClose()
  }

  const handleCreate = async () => {
    const trimmedName = name.trim()
    if (!trimmedName || saving) return

    setSaving(true)
    try {
      await onCreate(trimmedName)
      onClose()
    } catch (error) {
      console.error('Create topic error:', error)
      toast.error('Failed to create the topic. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 mt-1">
      <FieldWrapper label="Topic name">
        <Input
          aria-label="Topic name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Distributed Systems"
          autoFocus
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
              event.preventDefault()
              void handleCreate()
            }
          }}
        />
      </FieldWrapper>
      <div className="flex gap-3 justify-end mt-1">
        <Button variant="ghost" onClick={handleClose} disabled={saving}>Cancel</Button>
        <Button
          variant="primary"
          onClick={() => void handleCreate()}
          disabled={!name.trim()}
          loading={saving}
        >
          Create topic
        </Button>
      </div>
    </div>
  )
}
