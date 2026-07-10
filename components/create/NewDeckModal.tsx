'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Input, FieldWrapper } from '@/components/ui/FormField'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { createDeck, suggestAnkiDeckName, type CreatedDeck } from '@/lib/create/createDeckCategory'
import { FormType, type LanguageCode } from '@/types'
import { useStudyLanguages } from '@/components/providers/StudyLanguageProvider'
import { languageDisplayName } from '@/lib/studyLanguages'

interface NewDeckModalProps {
  open: boolean
  onClose: () => void
  /** Tên gợi ý ban đầu (từ ô tìm kiếm). */
  defaultDisplayName: string
  formType: FormType | string
  language?: LanguageCode | null
  onCreated: (deck: CreatedDeck) => void
}

/** Popup điền thông tin Anki Deck mới (display name + anki deck name) rồi tạo. */
export function NewDeckModal({ open, onClose, defaultDisplayName, formType, language, onCreated }: NewDeckModalProps) {
  const { languages } = useStudyLanguages()
  const languageName = language ? languageDisplayName(language, languages) : undefined

  return (
    <Modal open={open} onClose={onClose} title="New Anki Deck" description="Create a deck without leaving the Create page.">
      {/* key=defaultDisplayName → remount form mỗi lần mở để khởi tạo state từ props (không cần effect). */}
      {open && (
        <NewDeckForm
          key={defaultDisplayName}
          defaultDisplayName={defaultDisplayName}
          formType={formType}
          language={language}
          languageName={languageName}
          onCreated={onCreated}
          onClose={onClose}
        />
      )}
    </Modal>
  )
}

interface NewDeckFormProps {
  defaultDisplayName: string
  formType: FormType | string
  language?: LanguageCode | null
  languageName?: string
  onCreated: (deck: CreatedDeck) => void
  onClose: () => void
}

function NewDeckForm({ defaultDisplayName, formType, language, languageName, onCreated, onClose }: NewDeckFormProps) {
  const toast = useToast()
  const [displayName, setDisplayName] = useState(defaultDisplayName)
  const [ankiDeckName, setAnkiDeckName] = useState(() => suggestAnkiDeckName(defaultDisplayName, formType, language, languageName))
  const [touchedAnki, setTouchedAnki] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleDisplayChange = (v: string) => {
    setDisplayName(v)
    // Đồng bộ gợi ý anki deck name khi người dùng chưa sửa tay.
    if (!touchedAnki) setAnkiDeckName(suggestAnkiDeckName(v, formType, language, languageName))
  }

  const handleCreate = async () => {
    if (!displayName.trim() || !ankiDeckName.trim()) return
    setSaving(true)
    try {
      const deck = await createDeck({ displayName, ankiDeckName, formType, language })
      if (deck.ankiSyncFailed) {
        toast.warning('Saved the deck, but Anki sync failed — is Anki open?')
      } else {
        toast.success(`Created “${deck.display_name}” and synced it with Anki`)
      }
      onCreated(deck)
      onClose()
    } catch (e) {
      console.error('Create deck error:', e)
      toast.error('Failed to create the deck. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 mt-1">
      <FieldWrapper label="Display name">
        <Input
          aria-label="Deck display name"
          value={displayName}
          onChange={(e) => handleDisplayChange(e.target.value)}
          placeholder="e.g. TOEIC 800"
          autoFocus
        />
      </FieldWrapper>
      <FieldWrapper label="Anki deck name">
        <Input
          aria-label="Anki deck name"
          value={ankiDeckName}
          onChange={(e) => { setAnkiDeckName(e.target.value); setTouchedAnki(true) }}
          placeholder="e.g. Language::TOEIC 800"
        />
        <p className="text-[12px] text-slate-400 mt-1.5">Use “::” to nest decks inside Anki.</p>
      </FieldWrapper>
      <div className="flex gap-3 justify-end mt-1">
        <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="primary" onClick={handleCreate} disabled={saving || !displayName.trim() || !ankiDeckName.trim()}>
          {saving ? 'Creating…' : 'Create deck'}
        </Button>
      </div>
    </div>
  )
}
