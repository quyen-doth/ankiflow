'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { EditableField } from '@/components/preview/EditableField'
import { CollocationEditor } from '@/components/preview/CollocationEditor'
import { useToast } from '@/components/ui/Toast'
import type { Entry } from '@/types'

interface EntryEditModalProps {
  open: boolean
  onClose: () => void
  entry: Entry
  onSave: (updated: Partial<Entry>) => Promise<void>
}

export function EntryEditModal({ open, onClose, entry, onSave }: EntryEditModalProps) {
  const [fields, setFields] = useState<Partial<Entry>>({
    word: entry.word,
    term: entry.term,
    title: entry.title,
    meaning_vi: entry.meaning_vi,
    definition: entry.definition,
    word_type: entry.word_type,
    hiragana: entry.hiragana,
    pinyin: entry.pinyin,
    ipa: entry.ipa,
    example_sentence: entry.example_sentence,
    example_translation: entry.example_translation,
    collocations: entry.collocations || [],
  })
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  const wordField = entry.word ? 'word' : entry.term ? 'term' : 'title'
  const meaningField = entry.meaning_vi ? 'meaning_vi' : 'definition'
  const readingField = entry.hiragana ? 'hiragana' : entry.pinyin ? 'pinyin' : entry.ipa ? 'ipa' : null

  const updateField = (field: string, value: unknown) => {
    setFields(prev => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(fields)
      toast.success('Changes saved')
      onClose()
    } catch (e) {
      console.error('Save error:', e)
      toast.error('Failed to save changes.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      onConfirm={handleSave}
      title="Edit Flashcard"
      description={`Editing "${entry.word || entry.term || entry.title}"`}
    >
      <div className="space-y-4 mt-3 max-h-[60vh] overflow-y-auto pr-1">
        <div>
          <p className="text-overline uppercase text-slate-600 tracking-wider font-bold mb-1">
            Word
          </p>
          <EditableField
            value={(fields[wordField] as string) || ''}
            onSave={(v) => updateField(wordField, v)}
            className="text-lg font-bold text-ink"
          />
        </div>

        {readingField && (
          <div>
            <p className="text-overline uppercase text-slate-600 tracking-wider font-bold mb-1">
              Reading
            </p>
            <EditableField
              value={(fields[readingField] as string) || ''}
              onSave={(v) => updateField(readingField, v)}
              className="text-body text-slate-600"
            />
          </div>
        )}

        <div>
          <p className="text-overline uppercase text-slate-600 tracking-wider font-bold mb-1">
            Meaning
          </p>
          <EditableField
            value={(fields[meaningField] as string) || ''}
            onSave={(v) => updateField(meaningField, v)}
            className="text-body text-ink"
          />
        </div>

        {entry.word_type !== undefined && (
          <div>
            <p className="text-overline uppercase text-slate-600 tracking-wider font-bold mb-1">
              Word Type
            </p>
            <EditableField
              value={(fields.word_type as string) || ''}
              onSave={(v) => updateField('word_type', v)}
              className="text-body text-slate-600"
            />
          </div>
        )}

        <div>
          <p className="text-overline uppercase text-slate-600 tracking-wider font-bold mb-1">
            Example Sentence
          </p>
          <EditableField
            value={(fields.example_sentence as string) || ''}
            onSave={(v) => updateField('example_sentence', v)}
            multiline
            className="text-body text-ink"
          />
        </div>

        <div>
          <p className="text-overline uppercase text-slate-600 tracking-wider font-bold mb-1">
            Translation
          </p>
          <EditableField
            value={(fields.example_translation as string) || ''}
            onSave={(v) => updateField('example_translation', v)}
            multiline
            className="text-body text-slate-600 italic"
          />
        </div>

        <CollocationEditor
          items={(fields.collocations as string[]) || []}
          onChange={(v) => updateField('collocations', v)}
        />
      </div>

      <div className="flex gap-3 justify-end mt-4 pt-3 border-t border-border/30">
        <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="primary" onClick={handleSave} loading={saving}>
          Save & Sync to Anki
        </Button>
      </div>
    </Modal>
  )
}
