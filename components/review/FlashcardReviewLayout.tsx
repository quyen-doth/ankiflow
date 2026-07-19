'use client'

import { motion } from 'framer-motion'
import { Sparkles, FileText } from 'lucide-react'
import { staggerContainer, staggerItem } from '@/lib/motion'
import { EditableField } from '@/components/preview/EditableField'
import { CollocationEditor } from '@/components/preview/CollocationEditor'
import { ImageSelector, type ImageItem } from '@/components/preview/ImageSelector'
import { AudioPlayer } from '@/components/preview/AudioPlayer'
import { CardPreview } from '@/components/preview/CardPreview'
import { CardList } from '@/components/preview/CardList'
import { DeckCreatableField } from '@/components/create/DeckCreatableField'
import type { Entry, LanguageCode, CardTemplate } from '@/types'
import type { EntryCustomField } from '@/lib/entryCustomFields'
import { primaryLanguageSubtag } from '@/lib/studyLanguages'

interface CardTypeItem {
  id: string
  name: string
  description?: string
  template?: CardTemplate
}

interface FlashcardReviewLayoutProps {
  headerLabel: string
  headerActions: React.ReactNode
  /** sticky header 直下に表示する任意コンテンツ (例: batch ナビゲーションバー)。 */
  subHeader?: React.ReactNode
  /** コンテンツ領域の最上部に表示する警告 banner (例: validation エラー)。 */
  banner?: React.ReactNode
  entry: Partial<Entry>
  updateField: (field: keyof Entry, value: unknown) => void
  customFields?: EntryCustomField[]
  onCustomFieldChange?: (key: string, value: string | string[]) => void
  // Media
  images: ImageItem[]
  imageLoading: boolean
  onImageSelect: (img: ImageItem) => void
  onImageUpload: (dataUrl: string) => void
  onImageRefetch: () => void
  audioUrl: string | null
  audioLoading: boolean
  onAudioRegenerate: () => void
  audioSubtitle?: string
  // Deck
  selectedDeckId: string
  onDeckChange: (deckId: string) => void
  onDeckClear?: () => void
  // Card types
  cardTypes: CardTypeItem[]
  selectedCardTypeIds: string[]
  onCardTypesChange: (ids: string[]) => void
}

interface AdditionalFieldsSectionProps {
  fields: EntryCustomField[]
  onChange: (key: string, value: string | string[]) => void
}

/** AI profile または既存 Entry から解決した追加 field を編集する。 */
export function AdditionalFieldsSection({ fields, onChange }: AdditionalFieldsSectionProps) {
  if (fields.length === 0) return null

  return (
    <div data-testid="additional-fields">
      <p className="text-[11px] font-bold tracking-[0.05em] uppercase font-mono text-slate-400 mb-3">
        Additional fields
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {fields.map(field => {
          const isArray = Array.isArray(field.value)
          const displayValue = Array.isArray(field.value) ? field.value.join('\n') : field.value
          return (
            <div key={field.key}>
              <p className="text-[11px] font-semibold text-slate-500 mb-1.5">{field.label}</p>
              <EditableField
                value={displayValue}
                onSave={value => onChange(
                  field.key,
                  isArray
                    ? value.split('\n').map(item => item.trim()).filter(Boolean)
                    : value,
                )}
                multiline={isArray}
                placeholder={isArray ? 'Add one item per line…' : 'Click to add…'}
                className="block text-[14px] text-ink leading-relaxed whitespace-pre-line"
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Review ページ (新規作成の Preview) と History の flashcard 編集ページで共用する
 * layout — 2 ページの見た目を完全に一致させる。
 */
export function FlashcardReviewLayout({
  headerLabel,
  headerActions,
  subHeader,
  banner,
  entry,
  updateField,
  customFields = [],
  onCustomFieldChange,
  images,
  imageLoading,
  onImageSelect,
  onImageUpload,
  onImageRefetch,
  audioUrl,
  audioLoading,
  onAudioRegenerate,
  audioSubtitle,
  selectedDeckId,
  onDeckChange,
  onDeckClear,
  cardTypes,
  selectedCardTypeIds,
  onCardTypesChange,
}: FlashcardReviewLayoutProps) {
  const reading = entry.hiragana || entry.pinyin || entry.ipa || ''
  const languageSubtag = entry.language ? primaryLanguageSubtag(entry.language) : null
  const showHanViet = languageSubtag === 'zh' || languageSubtag === 'ja'

  return (
    <>
      {/* Header — sticky bar */}
      <div className="sticky top-16 md:top-0 z-10 -mx-4 md:-mx-8 md:-mt-8 mb-6 px-4 md:px-[34px] py-5 border-b border-[#eaeae6] bg-canvas/85 backdrop-blur-md flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-meta font-mono text-slate-400">
          <Sparkles className="w-3.5 h-3.5" />
          <span className="uppercase tracking-[0.05em] font-bold">{headerLabel}</span>
        </div>
        <div className="flex items-center gap-3">{headerActions}</div>
      </div>

      {banner && (
        <div className="max-w-[1280px] mx-auto w-full">{banner}</div>
      )}

      {subHeader && (
        <div className="max-w-[1280px] mx-auto w-full mb-6">{subHeader}</div>
      )}

      <div className="max-w-[1280px] mx-auto w-full pb-10 grid grid-cols-1 lg:grid-cols-[1.55fr_1fr] gap-[18px] items-start">
        {/* ── LEFT ── */}
        <motion.div className="flex flex-col gap-[18px]" variants={staggerContainer} initial="hidden" animate="show">
          {/* Generated content */}
          <motion.section className="bg-white border border-border rounded-[14px] p-6" variants={staggerItem}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <span className="w-[26px] h-[26px] rounded-[7px] bg-[rgba(49,99,66,0.1)] text-primary flex items-center justify-center flex-shrink-0">
                  <FileText className="w-[15px] h-[15px]" />
                </span>
                <span className="text-[12px] font-bold tracking-[0.05em] uppercase font-mono text-slate-600">
                  Generated content
                </span>
              </div>
              <span className="inline-flex items-center gap-1.5 bg-[rgba(184,117,20,0.1)] text-[#b87514] text-[11px] font-bold px-[11px] py-[5px] rounded-full">
                <Sparkles className="w-3 h-3" />
                AI generated
              </span>
            </div>

            {/* Hero */}
            <div className="flex items-end justify-between gap-4">
              <div className="min-w-0">
                <EditableField
                  value={entry.word || entry.term || entry.title || ''}
                  onSave={(v) => updateField('word', v)}
                  className="text-[30px] font-extrabold text-ink tracking-[-0.02em] leading-none"
                />
                <div className="mt-2.5">
                  <EditableField
                    value={reading}
                    onSave={(v) => updateField('hiragana', v)}
                    className="text-[14px] font-mono text-slate-400"
                    placeholder="reading…"
                  />
                </div>
                {showHanViet && (
                  <div className="mt-1.5">
                    <EditableField
                      value={entry.han_viet || ''}
                      onSave={(v) => updateField('han_viet', v)}
                      className="text-[13px] font-bold uppercase tracking-[0.08em] text-[#b87514]"
                      placeholder="Sino-Vietnamese reading…"
                    />
                  </div>
                )}
              </div>
              {entry.word_type && (
                <EditableField
                  value={entry.word_type}
                  onSave={(v) => updateField('word_type', v)}
                  className="flex-shrink-0 mx-0 bg-[#f2f2ef] text-slate-600 text-[12.5px] font-semibold px-3.5 py-2 rounded-[7px] hover:bg-[#e8e8e3]"
                />
              )}
            </div>

            <div className="border-t border-[#f0f0ec] my-5" />

            {/* Meaning */}
            <div>
              <p className="text-[11px] font-bold tracking-[0.05em] uppercase font-mono text-[#b87514] mb-2">
                Meaning
              </p>
              <EditableField
                value={entry.meaning_vi || entry.definition || ''}
                onSave={(v) => updateField('meaning_vi', v)}
                className="text-[16px] text-ink font-medium"
              />
            </div>

            {/* Example */}
            {(entry.example_sentence || entry.example_translation) && (
              <>
                <div className="border-t border-[#f0f0ec] my-5" />
                <div>
                  <p className="text-[11px] font-bold tracking-[0.05em] uppercase font-mono text-slate-400 mb-2">
                    Example sentence
                  </p>
                  <EditableField
                    value={entry.example_sentence || ''}
                    onSave={(v) => updateField('example_sentence', v)}
                    multiline
                    highlight={entry.word || entry.term || entry.title || ''}
                    className="text-[15px] text-ink leading-relaxed"
                  />
                  <div className="mt-2.5">
                    <EditableField
                      value={entry.example_translation || ''}
                      onSave={(v) => updateField('example_translation', v)}
                      multiline
                      className="text-[14px] text-[#7c7f87] italic"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Collocations */}
            {Array.isArray(entry.collocations) && (
              <>
                <div className="border-t border-[#f0f0ec] my-5" />
                <CollocationEditor
                  items={entry.collocations}
                  onChange={(v) => updateField('collocations', v)}
                />
              </>
            )}

            {customFields.length > 0 && (
              <>
                <div className="border-t border-[#f0f0ec] my-5" />
                <AdditionalFieldsSection
                  fields={customFields}
                  onChange={(key, value) => onCustomFieldChange?.(key, value)}
                />
              </>
            )}
          </motion.section>

          {/* Illustration */}
          <motion.section className="bg-white border border-border rounded-[14px] p-6" variants={staggerItem}>
            <ImageSelector
              images={images}
              selectedUrl={entry.image_url || null}
              onSelect={onImageSelect}
              onRefetch={onImageRefetch}
              onUpload={onImageUpload}
              loading={imageLoading}
            />
          </motion.section>

          {/* Pronunciation */}
          <motion.section className="bg-white border border-border rounded-[14px] px-6 py-[18px]" variants={staggerItem}>
            <AudioPlayer
              audioUrl={audioUrl}
              onRegenerate={onAudioRegenerate}
              loading={audioLoading}
              subtitle={audioSubtitle}
            />
          </motion.section>
        </motion.div>

        {/* ── RIGHT ── */}
        <div className="lg:sticky lg:top-24 flex flex-col gap-[18px]">
          <CardPreview
            entry={entry}
            audioUrl={audioUrl}
            cardTypes={cardTypes}
            selectedCardTypeIds={selectedCardTypeIds}
          />

          {/* Target deck */}
          <section className="bg-white border border-border rounded-[14px] p-5">
            <DeckCreatableField
              value={selectedDeckId}
              onChangeId={onDeckChange}
              onClear={onDeckClear}
              label="Target Deck"
              filterFormType={entry.form_type}
              filterLanguage={entry.language as LanguageCode | undefined}
              createFormType={entry.form_type ?? ''}
              createLanguage={entry.language as LanguageCode | undefined}
              fallbackDeckName={entry.anki_deck}
            />
            {entry.anki_deck && (
              <p className="text-[11px] font-mono text-slate-400 mt-2 truncate">Anki: {entry.anki_deck}</p>
            )}
          </section>

          {/* Card types */}
          <section className="bg-white border border-border rounded-[14px] p-5">
            <CardList cardTypes={cardTypes} selectedIds={selectedCardTypeIds} onChange={onCardTypesChange} />
          </section>
        </div>
      </div>
    </>
  )
}
