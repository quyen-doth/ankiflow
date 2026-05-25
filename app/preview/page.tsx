'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { EditableField } from '@/components/preview/EditableField'
import { CollocationEditor } from '@/components/preview/CollocationEditor'
import { ImageSelector } from '@/components/preview/ImageSelector'
import { AudioPlayer } from '@/components/preview/AudioPlayer'
import { CardPreview } from '@/components/preview/CardPreview'
import { CardList } from '@/components/preview/CardList'
import type { Entry } from '@/types'

// Kiểu mock để demo UI — sẽ được thay bằng dữ liệu thực từ session/API
const MOCK_ENTRY: Partial<Entry> = {
  word: '勉強',
  hiragana: 'べんきょう',
  meaning_vi: 'Học tập',
  word_type: 'Danh từ / Động từ (する)',
  example_sentence: '毎日日本語を勉強しています。',
  example_translation: 'Tôi học tiếng Nhật mỗi ngày.',
  collocations: ['英語を勉強する', '一生懸命勉強する'],
  tags: ['N4', 'Daily'],
}

const MOCK_CARD_TYPES = [
  { id: 'ct1', name: 'Word → Meaning', description: 'Basic translation' },
  { id: 'ct2', name: 'Meaning → Word', description: 'Active recall' },
  { id: 'ct3', name: 'Sentence fill-in', description: 'Context sentence' },
  { id: 'ct4', name: 'Audio → Word', description: 'Listening card' },
]

export default function PreviewPage() {
  const [entry, setEntry] = useState<Partial<Entry>>(MOCK_ENTRY)
  const [selectedCardTypes, setSelectedCardTypes] = useState(['ct1', 'ct2'])
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const updateField = (field: keyof Entry, value: unknown) => {
    setEntry(prev => ({ ...prev, [field]: value }))
  }

  const handleConfirm = async () => {
    setIsExporting(true)
    setConfirmOpen(false)
    // TODO: Gọi API export sang Anki
    await new Promise(r => setTimeout(r, 1500))
    setIsExporting(false)
  }

  return (
    <>
      <PageHeader
        crumbs={[
          { label: 'Create Card', href: '/create' },
          { label: 'Preview & Confirm' },
        ]}
        description="Review and edit your flashcard content before exporting to Anki."
        actions={
          <Button
            variant="primary"
            onClick={() => setConfirmOpen(true)}
            disabled={isExporting}
          >
            {isExporting ? 'Exporting...' : 'Confirm & Export'}
          </Button>
        }
      />

      {/* Layout 8:4 */}
      <div className="grid grid-cols-12 gap-6">
        {/* Cột trái — nội dung chỉnh sửa */}
        <div className="col-span-8 flex flex-col gap-6">

          {/* Card thông tin chính */}
          <section className="bg-white rounded-xl shadow-card border border-outline-var/40 p-6">
            <h2 className="text-label-lg font-semibold text-on-surface-var mb-4">Main Info</h2>
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-xs text-on-surface-var mb-1">Word / Term</p>
                <EditableField
                  value={entry.word || entry.term || entry.title || ''}
                  onSave={(v) => updateField('word', v)}
                  className="text-2xl font-serif text-on-surface"
                />
              </div>
              <div>
                <p className="text-xs text-on-surface-var mb-1">Reading / Phonetics</p>
                <EditableField
                  value={entry.hiragana || entry.pinyin || entry.ipa || ''}
                  onSave={(v) => updateField('hiragana', v)}
                  className="text-base text-on-surface-var"
                />
              </div>
              <div>
                <p className="text-xs text-on-surface-var mb-1">Meaning (Vietnamese)</p>
                <EditableField
                  value={entry.meaning_vi || entry.definition || ''}
                  onSave={(v) => updateField('meaning_vi', v)}
                  className="text-base text-on-surface"
                />
              </div>
              <div>
                <p className="text-xs text-on-surface-var mb-1">Word Type</p>
                <EditableField
                  value={entry.word_type || ''}
                  onSave={(v) => updateField('word_type', v)}
                  className="text-sm text-on-surface-var"
                  placeholder="e.g. Noun, Verb..."
                />
              </div>
              <div>
                <p className="text-xs text-on-surface-var mb-1">Example Sentence</p>
                <EditableField
                  value={entry.example_sentence || ''}
                  onSave={(v) => updateField('example_sentence', v)}
                  multiline
                  className="text-sm text-on-surface"
                />
              </div>
              <div>
                <p className="text-xs text-on-surface-var mb-1">Translation</p>
                <EditableField
                  value={entry.example_translation || ''}
                  onSave={(v) => updateField('example_translation', v)}
                  multiline
                  className="text-sm text-on-surface-var"
                />
              </div>
            </div>
          </section>

          {/* Collocations */}
          <section className="bg-white rounded-xl shadow-card border border-outline-var/40 p-6">
            <CollocationEditor
              items={entry.collocations || []}
              onChange={(v) => updateField('collocations', v)}
            />
          </section>

          {/* Image */}
          <section className="bg-white rounded-xl shadow-card border border-outline-var/40 p-6">
            <ImageSelector
              images={[]}
              selectedId={null}
              onSelect={() => {}}
              onRefetch={() => {}}
              loading={false}
            />
          </section>

          {/* Audio */}
          <section className="bg-white rounded-xl shadow-card border border-outline-var/40 p-6">
            <AudioPlayer
              audioUrl={null}
              onRegenerate={() => {}}
            />
          </section>

          {/* Card Types selection */}
          <section className="bg-white rounded-xl shadow-card border border-outline-var/40 p-6">
            <CardList
              cardTypes={MOCK_CARD_TYPES}
              selectedIds={selectedCardTypes}
              onChange={setSelectedCardTypes}
            />
          </section>
        </div>

        {/* Cột phải — Card Preview (sticky) */}
        <div className="col-span-4">
          <div className="sticky top-8">
            <div className="bg-white rounded-xl shadow-card border border-outline-var/40 p-6">
              <h2 className="text-label-lg font-semibold text-on-surface-var mb-4">Card Preview</h2>
              <CardPreview entry={entry} />
            </div>
          </div>
        </div>
      </div>

      {/* Confirm Modal */}
      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Confirm Export to Anki"
        description={`Export "${entry.word || entry.term || 'this card'}" with ${selectedCardTypes.length} card type(s) to Anki?`}
        actions={
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleConfirm}>Confirm</Button>
          </div>
        }
      />
    </>
  )
}
