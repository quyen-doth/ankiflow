'use client'

import { Reorder } from 'framer-motion'
import { GripVertical, X, ChevronDown, Plus } from 'lucide-react'
import { LanguageType } from '@/types'
import type { CardFieldSource, CardTemplate, Entry, LanguageCode } from '@/types'
import { renderSide, DEFAULT_TEMPLATES, getFieldLabel, ALL_FIELD_SOURCES } from '@/lib/anki/renderCard'
import type { CardTemplateCustomField } from '@/lib/anki/cardTemplateFields'
import { buildCardHtml, CardIframe } from '@/components/preview/CardHtmlPreview'

const SAMPLE_ENTRIES: Record<string, Partial<Entry>> = {
  default: {
    word: 'ubiquitous',
    ipa: '/juːˈbɪk.wɪ.təs/',
    meaning_vi: 'Có mặt khắp nơi, phổ biến',
    word_type: 'adj',
    example_sentence: 'Smartphones have become ubiquitous in modern life.',
    example_translation: 'Điện thoại thông minh đã trở nên phổ biến.',
    collocations: ['ubiquitous presence', 'ubiquitous technology'],
    image_url: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=300&h=200&fit=crop',
  },
  [LanguageType.ENGLISH]: {
    word: 'ubiquitous',
    ipa: '/juːˈbɪk.wɪ.təs/',
    meaning_vi: 'Có mặt khắp nơi, phổ biến',
    word_type: 'adj',
    example_sentence: 'Smartphones have become ubiquitous in modern life.',
    example_translation: 'Điện thoại thông minh đã trở nên phổ biến.',
    collocations: ['ubiquitous presence', 'ubiquitous technology'],
    image_url: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=300&h=200&fit=crop',
  },
  [LanguageType.CHINESE]: {
    word: '你好',
    pinyin: 'nǐ hǎo',
    han_viet: 'nhĩ hảo',
    meaning_vi: 'Xin chào',
    word_type: 'thán từ',
    example_sentence: '你好，很高兴认识你。',
    example_translation: 'Xin chào, rất vui được gặp bạn.',
    collocations: ['你好吗', '大家好'],
    image_url: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=300&h=200&fit=crop',
  },
  [LanguageType.JAPANESE]: {
    word: '言葉',
    hiragana: 'ことば',
    han_viet: 'ngôn diệp',
    meaning_vi: 'Ngôn ngữ, từ ngữ',
    word_type: 'danh từ',
    example_sentence: '言葉を大切にしてください。',
    example_translation: 'Hãy trân trọng ngôn từ.',
    collocations: ['言葉遣い', '話し言葉'],
    image_url: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=300&h=200&fit=crop',
  },
}

interface FieldListProps {
  side: 'front' | 'back'
  fields: CardFieldSource[]
  customFields?: readonly CardTemplateCustomField[]
  onChange: (fields: CardFieldSource[]) => void
  error?: boolean
}

function FieldList({ side, fields, customFields = [], onChange, error }: FieldListProps) {
  const customLabels = Object.fromEntries(customFields.map(field => [field.key, field.label]))
  const sources: CardFieldSource[] = [
    ...ALL_FIELD_SOURCES,
    ...customFields.map(field => field.source),
  ]
  const available = sources.filter(f => !fields.includes(f))

  return (
    <div className="flex flex-col gap-2">
      <div className="text-[10.5px] font-bold tracking-[0.1em] uppercase font-mono text-slate-400 mb-0.5">
        {side === 'front' ? 'Front' : 'Back'}
      </div>

      <Reorder.Group
        axis="y"
        values={fields}
        onReorder={onChange}
        className="flex flex-col gap-1.5"
      >
        {fields.map(f => (
          <Reorder.Item key={f} value={f} className="list-none">
            <div className="group flex items-center gap-2 px-2.5 py-2 bg-white rounded-[7px] border border-[#e3e3de] hover:border-slate-300 cursor-grab active:cursor-grabbing select-none transition-colors">
              <GripVertical className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-400 flex-shrink-0" />
              <span className="text-[12.5px] font-medium text-ink flex-1 leading-none">{getFieldLabel(f, customLabels)}</span>
              <button
                type="button"
                onClick={() => onChange(fields.filter(x => x !== f))}
                className="w-5 h-5 flex items-center justify-center rounded-full text-slate-300 hover:text-white hover:bg-danger transition-colors flex-shrink-0"
                aria-label={`Remove ${getFieldLabel(f, customLabels)}`}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </Reorder.Item>
        ))}
      </Reorder.Group>

      {fields.length === 0 && (
        <div className={`text-[11.5px] text-center py-3 border border-dashed rounded-[7px] ${error ? 'border-danger text-danger' : 'border-[#e3e3de] text-slate-400'}`}>
          Add at least one field
        </div>
      )}

      {available.length > 0 && (
        <div className="relative mt-0.5">
          <Plus className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-primary pointer-events-none" />
          <select
            className="w-full h-[34px] bg-primary-bg/40 border border-dashed border-primary/40 rounded-[7px] pl-8 pr-8 text-[12.5px] font-medium text-primary focus:outline-none focus:border-primary cursor-pointer appearance-none hover:bg-primary-bg/70 transition-colors"
            value=""
            onChange={e => {
              if (e.target.value) onChange([...fields, e.target.value as CardFieldSource])
            }}
            aria-label={`Add field to ${side}`}
          >
            <option value="">Add field</option>
            {available.map(f => (
              <option key={f} value={f}>{getFieldLabel(f, customLabels)}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-primary pointer-events-none" />
        </div>
      )}
    </div>
  )
}

interface CardStructureEditorProps {
  code: string
  template: CardTemplate
  customFields?: readonly CardTemplateCustomField[]
  onChange: (t: CardTemplate) => void
  showErrors?: boolean
}

export function CardStructureEditor({
  code,
  template,
  customFields = [],
  onChange,
  showErrors,
}: CardStructureEditorProps) {
  const defaultTemplate = DEFAULT_TEMPLATES[code] ?? { front: ['word'], back: ['meaning'] }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-overline uppercase tracking-[0.05em] text-slate-400 font-mono">
          Card structure
        </span>
        <button
          type="button"
          onClick={() => onChange(defaultTemplate)}
          className="text-[11px] text-primary hover:underline"
        >
          Reset to default
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FieldList
          side="front"
          fields={template.front}
          customFields={customFields}
          onChange={front => onChange({ ...template, front })}
          error={showErrors && template.front.length === 0}
        />
        <FieldList
          side="back"
          fields={template.back}
          customFields={customFields}
          onChange={back => onChange({ ...template, back })}
          error={showErrors && template.back.length === 0}
        />
      </div>
    </div>
  )
}

interface CardPreviewProps {
  template: CardTemplate
  language?: LanguageCode | null
  customFields?: readonly CardTemplateCustomField[]
}

export function CardPreview({ template, language, customFields = [] }: CardPreviewProps) {
  const baseSample = (language && SAMPLE_ENTRIES[language]) || SAMPLE_ENTRIES.default
  const sample = {
    ...baseSample,
    ...Object.fromEntries(customFields.map(field => [field.key, field.sampleValue])),
  } as Partial<Entry>

  const previewMedia = {
    audioFilename: 'preview',
    audioExampleFilename: 'preview',
    audioIcon: true,
  }
  const previewFront = renderSide(template.front, sample, { ...previewMedia, side: 'front' })
  const previewBack = renderSide(template.back, sample, { ...previewMedia, side: 'back' })
  const previewHtml = buildCardHtml(previewFront, previewBack)

  return (
    <div className="flex flex-col gap-2">
      <span className="text-overline uppercase tracking-[0.05em] text-slate-400 font-mono">
        Preview
      </span>
      <div className="rounded-[10px] overflow-hidden border border-[#e3e3de]">
        <CardIframe html={previewHtml} />
      </div>
    </div>
  )
}
