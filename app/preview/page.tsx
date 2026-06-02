'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { EditableField } from '@/components/preview/EditableField'
import { CollocationEditor } from '@/components/preview/CollocationEditor'
import { ImageSelector } from '@/components/preview/ImageSelector'
import { AudioPlayer } from '@/components/preview/AudioPlayer'
import { CardPreview } from '@/components/preview/CardPreview'
import { CardList } from '@/components/preview/CardList'
import { loadPendingEntry, clearPendingEntry } from '@/lib/pendingEntry'
import type { Entry, CardTypeConfig } from '@/types'

/** Type nội bộ cho card type hiển thị trong CardList */
type CardTypeItem = Pick<CardTypeConfig, 'id' | 'name' | 'description'>

export default function PreviewPage() {
  const router = useRouter()

  // ─── State chính ──────────────────────────────────────────────────────────
  const [entry, setEntry] = useState<Partial<Entry>>({})
  const [cardTypes, setCardTypes] = useState<CardTypeItem[]>([])
  const [selectedCardTypeIds, setSelectedCardTypeIds] = useState<string[]>([])
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  // Trạng thái loading / lỗi
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ─── Khởi tạo: đọc pendingEntry + fetch card_types từ Firestore ───────────
  useEffect(() => {
    async function init() {
      setIsLoading(true)
      setError(null)

      // 1. Đọc pending entry từ localStorage
      const pending = loadPendingEntry()

      if (!pending) {
        setError('Không tìm thấy dữ liệu. Vui lòng quay lại trang Create và Generate lại.')
        setIsLoading(false)
        return
      }

      // 2. Map generatedContent → Entry fields
      const mappedEntry: Partial<Entry> = {
        form_type: pending.formType,
        language: pending.language ?? undefined,
        anki_deck: pending.deckId || '',
        category_id: pending.categoryId || null,
        card_type_ids: pending.cardTypeIds,
        tags: pending.tags,
        // Flatten tất cả fields từ Gemini response vào entry
        ...(pending.generatedContent as Partial<Entry>),
      }
      setEntry(mappedEntry)

      // 3. Fetch card_types từ Firestore theo formType (và language nếu có)
      try {
        const q = query(
          collection(db, 'card_types'),
          where('form_type', '==', pending.formType),
          where('is_active', '==', true)
        )
        const snapshot = await getDocs(q)
        type FetchedCardType = {
          id: string
          name: string
          description?: string
          sort_order?: number
          language?: string | null
        }
        const fetchedCardTypes: FetchedCardType[] = snapshot.docs
          .map(doc => ({
            id: doc.id,
            ...(doc.data() as Omit<FetchedCardType, 'id'>),
          }))
          // Nếu có language: chỉ lấy card types không có language hoặc cùng language
          .filter(ct => {
            if (!pending.language) return true
            return !ct.language || ct.language === pending.language
          })
          .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))

        // Map về CardTypeItem (bỏ sort_order và language)
        setCardTypes(fetchedCardTypes.map(ct => ({
          id: ct.id,
          name: ct.name,
          description: ct.description,
        })))

        // 4. Pre-select card types từ session (nếu có) hoặc dùng tất cả
        const preSelected = pending.cardTypeIds.length > 0
          ? pending.cardTypeIds.filter(id => fetchedCardTypes.some(ct => ct.id === id))
          : fetchedCardTypes.map(ct => ct.id)
        setSelectedCardTypeIds(preSelected)

      } catch (firestoreErr) {
        console.error('Lỗi fetch card_types:', firestoreErr)
        // Không crash page — để tiếp tục với CardList rỗng
      }

      // 5. Xóa pending entry khỏi localStorage (đã dùng xong)
      clearPendingEntry()
      setIsLoading(false)
    }

    init()
  }, [])

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const updateField = (field: keyof Entry, value: unknown) => {
    setEntry(prev => ({ ...prev, [field]: value }))
  }

  const wordLabel = entry.word || entry.term || entry.title || 'card'

  // ─── Export sang Anki ─────────────────────────────────────────────────────
  const handleConfirm = async () => {
    setIsExporting(true)
    setConfirmOpen(false)

    try {
      const res = await fetch('/api/anki/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entry: { ...entry, card_type_ids: selectedCardTypeIds },
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        console.error('Lỗi export Anki:', err)
        alert(`Export thất bại: ${err.error || 'Unknown error'}`)
      } else {
        router.push('/create')
      }
    } catch (err) {
      console.error('Lỗi kết nối Anki:', err)
      alert('Không thể kết nối AnkiConnect. Hãy kiểm tra Anki đang mở.')
    } finally {
      setIsExporting(false)
    }
  }

  // ─── Render: Loading ─────────────────────────────────────────────────────
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

  // ─── Render: Error (không có pending entry) ───────────────────────────────
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

  // ─── Render: Main ─────────────────────────────────────────────────────────
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

      {/* Layout 8:4 */}
      <div className="grid grid-cols-12 gap-6">

        {/* Cột trái — nội dung chỉnh sửa */}
        <div className="col-span-8 flex flex-col gap-6">

          {/* Main Info */}
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
              audioUrl={entry.audio_url || null}
              onRegenerate={() => {}}
            />
          </section>

          {/* Card Types selection */}
          <section className="bg-white rounded-xl shadow-card border border-outline-var/40 p-6">
            <CardList
              cardTypes={cardTypes}
              selectedIds={selectedCardTypeIds}
              onChange={setSelectedCardTypeIds}
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
