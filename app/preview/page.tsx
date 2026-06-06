'use client'

import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { EditableField } from '@/components/preview/EditableField'
import { CollocationEditor } from '@/components/preview/CollocationEditor'
import { ImageSelector } from '@/components/preview/ImageSelector'
import { AudioPlayer } from '@/components/preview/AudioPlayer'
import { CardPreview } from '@/components/preview/CardPreview'
import { CardList } from '@/components/preview/CardList'
import { usePreviewEntry } from '@/hooks/usePreviewEntry'
import { useAnkiExport } from '@/hooks/useAnkiExport'
import type { Entry } from '@/types'

export default function PreviewPage() {
  const router = useRouter()

  const {
    entry, setEntry,
    cardTypes, selectedCardTypeIds, setSelectedCardTypeIds,
    isLoading, error,
  } = usePreviewEntry()

  const { confirmOpen, setConfirmOpen, isExporting, handleConfirm } = useAnkiExport({
    entry,
    selectedCardTypeIds,
  })

  const updateField = (field: keyof Entry, value: unknown) => {
    setEntry(prev => ({ ...prev, [field]: value }))
  }

  const wordLabel = entry.word || entry.term || entry.title || 'card'

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-10 h-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin mx-auto mb-4" />
          <p className="text-sm text-on-surface-var">Đang tải dữ liệu...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <p className="text-lg font-semibold text-on-surface mb-2">⚠️ Không tìm thấy dữ liệu</p>
          <p className="text-sm text-on-surface-var mb-6">{error}</p>
          <Button variant="primary" onClick={() => router.push('/create')}>
            Quay lại Create
          </Button>
        </div>
      </div>
    )
  }

  return (
    <>
      <PageHeader
        crumbs={[
          { label: 'Create Card', href: '/create' },
          { label: 'Preview & Confirm' },
        ]}
        actions={
          <Button
            variant="primary"
            onClick={() => setConfirmOpen(true)}
            disabled={isExporting || selectedCardTypeIds.length === 0}
          >
            {isExporting ? 'Exporting...' : 'Confirm & Export'}
          </Button>
        }
      />

      <div className="grid grid-cols-12 gap-6">

        <div className="col-span-8 flex flex-col gap-6">

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

          <section className="bg-white rounded-xl shadow-card border border-outline-var/40 p-6">
            <CollocationEditor
              items={entry.collocations || []}
              onChange={(v) => updateField('collocations', v)}
            />
          </section>

          <section className="bg-white rounded-xl shadow-card border border-outline-var/40 p-6">
            <ImageSelector
              images={[]}
              selectedId={null}
              onSelect={() => {}}
              onRefetch={() => {}}
              loading={false}
            />
          </section>

          <section className="bg-white rounded-xl shadow-card border border-outline-var/40 p-6">
            <AudioPlayer
              audioUrl={entry.audio_url || null}
              onRegenerate={() => {}}
            />
          </section>

          <section className="bg-white rounded-xl shadow-card border border-outline-var/40 p-6">
            <CardList
              cardTypes={cardTypes}
              selectedIds={selectedCardTypeIds}
              onChange={setSelectedCardTypeIds}
            />
          </section>
        </div>

        <div className="col-span-4">
          <div className="sticky top-8">
            <div className="bg-white rounded-xl shadow-card border border-outline-var/40 p-6">
              <h2 className="text-label-lg font-semibold text-on-surface-var mb-4">Card Preview</h2>
              <CardPreview entry={entry} />
            </div>
          </div>
        </div>
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Confirm Export to Anki"
        description={`Export "${wordLabel}" with ${selectedCardTypeIds.length} card type(s) to Anki?`}
      >
        <div className="flex gap-3 justify-end mt-2">
          <Button variant="ghost" onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button variant="primary" onClick={handleConfirm}>Confirm</Button>
        </div>
      </Modal>
    </>
  )
}
