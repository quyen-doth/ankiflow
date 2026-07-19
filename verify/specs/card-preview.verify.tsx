import type { ComponentProps } from 'react'
import { z } from 'zod'
import { CardPreview } from '@/components/preview/CardPreview'
import { registerUnit } from '@/verify/core/registry'

type CardPreviewProps = ComponentProps<typeof CardPreview>

// Entry tiếng Nhật đầy đủ — kiểm tra optional language field (hiragana, han_viet)
const JA_ENTRY: CardPreviewProps['entry'] = {
  word: '食べる',
  hiragana: 'たべる',
  han_viet: 'thực',
  meaning_vi: 'ăn',
  word_type: 'verb',
  example_sentence: '毎朝パンを食べる。',
  example_translation: 'Mỗi sáng tôi ăn bánh mì.',
}

// Hai card type với template thật → preview render theo đúng template đã chọn.
const CARD_TYPES: CardPreviewProps['cardTypes'] = [
  { id: 'ct_wm', name: 'Word → Meaning', template: { front: ['word', 'reading', 'han_viet'], back: ['meaning', 'audio'] } },
  { id: 'ct_mw', name: 'Meaning → Word', template: { front: ['meaning'], back: ['word', 'reading'] } },
]
const SELECTED = ['ct_wm', 'ct_mw']

function srcdoc(root: HTMLElement): string {
  return root.querySelector('iframe')?.getAttribute('srcdoc') ?? ''
}

function clickTab(root: HTMLElement, label: string): void {
  const btn = Array.from(root.querySelectorAll('button')).find(b => b.textContent === label)
  if (!btn) throw new Error(`không tìm thấy tab "${label}"`)
  btn.click()
}

registerUnit<CardPreviewProps>({
  id: 'CardPreview',
  title: 'CardPreview',
  description: 'Preview thẻ Anki điều khiển bởi template card type đã chọn; click để lật mặt trước/sau.',
  kind: 'component',
  render: props => <CardPreview {...props} />,
  propsSchema: z.object({
    entry: z.looseObject({}),
    cardTypes: z.array(z.looseObject({})).optional(),
    selectedCardTypeIds: z.array(z.string()).optional(),
  }),
  fixtures: [
    {
      id: 'language-entry',
      description: 'Entry tiếng Nhật — mặt trước render word + hiragana + han_viet theo template ct_wm.',
      props: { entry: JA_ENTRY, cardTypes: CARD_TYPES, selectedCardTypeIds: SELECTED },
    },
    {
      id: 'act-flip',
      description: 'Act: click thẻ → lật, iframe hiện thêm mặt sau (nghĩa).',
      props: { entry: JA_ENTRY, cardTypes: CARD_TYPES, selectedCardTypeIds: SELECTED },
      act: async ctx => {
        await ctx.click('[title="Click to flip"]')
      },
    },
    {
      id: 'act-switch-tab',
      description: 'Act: chọn tab Meaning → Word — mặt trước hiện nghĩa, flipped reset.',
      props: { entry: JA_ENTRY, cardTypes: CARD_TYPES, selectedCardTypeIds: SELECTED },
      act: async ctx => {
        clickTab(ctx.root, 'Meaning → Word')
        await ctx.wait(0)
      },
    },
    {
      id: 'custom-field',
      description: 'custom source は entry の string 値を card back に render する。',
      props: {
        entry: { ...JA_ENTRY, phon_the: '喫飯' } as CardPreviewProps['entry'],
        cardTypes: [{
          id: 'ct_custom',
          name: 'Custom field',
          template: { front: ['word'], back: ['custom:phon_the'] },
        }],
        selectedCardTypeIds: ['ct_custom'],
      },
      act: async ctx => {
        await ctx.click('[title="Click to flip"]')
      },
    },
    {
      id: 'custom-array-field',
      description: 'custom string_array source は改行を保持して card back に render する。',
      props: {
        entry: { ...JA_ENTRY, usage_notes: ['formal', 'written'] } as CardPreviewProps['entry'],
        cardTypes: [{
          id: 'ct_custom_array',
          name: 'Custom array field',
          template: { front: ['word'], back: ['custom:usage_notes'] },
        }],
        selectedCardTypeIds: ['ct_custom_array'],
      },
      act: async ctx => {
        await ctx.click('[title="Click to flip"]')
      },
    },
    {
      id: 'probe-minimal-entry',
      probe: true,
      description: 'Probe (gotcha optional fields): entry rỗng — iframe hiện "No fields", không leak "undefined".',
      props: { entry: {}, cardTypes: CARD_TYPES, selectedCardTypeIds: SELECTED },
    },
  ],
  invariants: [
    {
      id: 'flip-control-covers-iframe',
      description: 'Flip control là button phủ cùng container với iframe để bắt click thật.',
      check: ({ root }) => {
        const control = root.querySelector('[title="Click to flip"]')
        if (!(control instanceof HTMLButtonElement)) return 'flip control không phải button'
        if (!control.parentElement?.querySelector('iframe')) return 'flip control không phủ CardIframe'
        return (
          control.classList.contains('absolute') && control.classList.contains('inset-0')
        ) || 'flip control không phủ toàn bộ iframe'
      },
    },
    {
      id: 'tabs-per-card-type',
      description: 'Mỗi card type đã chọn có một tab',
      check: ({ root, fixture }) => {
        const selectedIds = new Set(fixture.props.selectedCardTypeIds ?? [])
        const labels = (fixture.props.cardTypes ?? [])
          .filter(cardType => selectedIds.has(cardType.id))
          .map(cardType => cardType.name)
        if (labels.length <= 1) return true
        const buttons = Array.from(root.querySelectorAll('button')).map(b => b.textContent)
        const missing = labels.filter(l => !buttons.includes(l))
        return missing.length === 0 || `thiếu tab: ${missing.join(', ')}`
      },
    },
    {
      id: 'front-follows-template',
      description: 'Tab mặc định (ct_wm): mặt trước render word + hiragana + han_viet',
      onlyFixtures: ['language-entry'],
      check: ({ root, contract }) => {
        if (contract.tab !== 'ct_wm') return `contract.tab="${contract.tab}"`
        const html = srcdoc(root)
        if (!html.includes('食べる')) return 'không thấy từ trong srcdoc'
        if (!html.includes('class="han-viet"')) return 'không thấy block han-viet'
        return html.includes('たべる') || 'không thấy hiragana'
      },
    },
    {
      id: 'flip-shows-back',
      description: 'Sau khi lật: contract flipped=true, srcdoc chứa mặt sau (nghĩa)',
      onlyFixtures: ['act-flip'],
      check: ({ root, contract }) => {
        if (contract.flipped !== 'true') return `contract.flipped="${contract.flipped}"`
        const control = root.querySelector('[title="Click to flip"]')
        if (control?.getAttribute('aria-pressed') !== 'true') return 'flip control chưa phản ánh trạng thái back'
        const html = srcdoc(root)
        if (!html.includes('id="answer"')) return 'không thấy hr mặt sau'
        return html.includes('ăn') || 'không thấy nghĩa ở mặt sau'
      },
    },
    {
      id: 'tab-switch-updates-front',
      description: 'Đổi tab ct_mw: contract tab khớp, front hiện nghĩa, flipped=false',
      onlyFixtures: ['act-switch-tab'],
      check: ({ root, contract }) => {
        if (contract.tab !== 'ct_mw') return `contract.tab="${contract.tab}"`
        if (contract.flipped !== 'false') return `contract.flipped="${contract.flipped}"`
        return srcdoc(root).includes('ăn') || 'front không hiển thị nghĩa'
      },
    },
    {
      id: 'minimal-entry-safe',
      description: 'Entry rỗng: iframe hiện "No fields", không leak "undefined"',
      onlyFixtures: ['probe-minimal-entry'],
      check: ({ root }) => {
        const html = srcdoc(root)
        if (!html.includes('No fields')) return 'không thấy placeholder "No fields"'
        return !html.includes('undefined') || 'leak chữ "undefined" ra srcdoc'
      },
    },
    {
      id: 'custom-field-renders',
      description: 'custom field の class/value が preview HTML に含まれる',
      onlyFixtures: ['custom-field'],
      check: ({ root }) => {
        const html = srcdoc(root)
        if (!html.includes('class="custom-field custom-phon_the"')) return 'custom field class がない'
        return html.includes('喫飯') || 'custom field value がない'
      },
    },
    {
      id: 'custom-array-preserves-line-breaks',
      description: 'custom string_array の newline と shared card CSS の pre-line を保持する',
      onlyFixtures: ['custom-array-field'],
      check: ({ root }) => {
        const html = srcdoc(root)
        if (!html.includes('formal\nwritten')) return 'array item の newline がない'
        return html.includes('white-space: pre-line') || 'custom field の pre-line CSS がない'
      },
    },
  ],
})
