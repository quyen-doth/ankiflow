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
      id: 'probe-minimal-entry',
      probe: true,
      description: 'Probe (gotcha optional fields): entry rỗng — iframe hiện "No fields", không leak "undefined".',
      props: { entry: {}, cardTypes: CARD_TYPES, selectedCardTypeIds: SELECTED },
    },
  ],
  invariants: [
    {
      id: 'tabs-per-card-type',
      description: 'Mỗi card type đã chọn có một tab',
      check: ({ root }) => {
        const labels = ['Word → Meaning', 'Meaning → Word']
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
  ],
})
