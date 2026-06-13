import type { ComponentProps } from 'react'
import { z } from 'zod'
import { CardPreview } from '@/components/preview/CardPreview'
import { registerUnit } from '@/verify/core/registry'

type CardPreviewProps = ComponentProps<typeof CardPreview>

// Entry tiếng Nhật đầy đủ — kiểm tra optional language field (hiragana)
const JA_ENTRY: CardPreviewProps['entry'] = {
  word: '食べる',
  hiragana: 'たべる',
  meaning_vi: 'ăn',
  word_type: 'verb',
  example_sentence: '毎朝パンを食べる。',
  example_translation: 'Mỗi sáng tôi ăn bánh mì.',
}

function clickTab(root: HTMLElement, label: string): void {
  const btn = Array.from(root.querySelectorAll('button')).find(b => b.textContent === label)
  if (!btn) throw new Error(`không tìm thấy tab "${label}"`)
  btn.click()
}

registerUnit<CardPreviewProps>({
  id: 'CardPreview',
  title: 'CardPreview',
  description: 'Preview thẻ Anki: 3 tab loại card, click để lật mặt trước/sau.',
  kind: 'component',
  render: props => <CardPreview {...props} />,
  propsSchema: z.object({
    entry: z.looseObject({}),
  }),
  fixtures: [
    {
      id: 'language-entry',
      description: 'Entry tiếng Nhật — front hiển thị từ + hiragana (optional field có giá trị).',
      props: { entry: JA_ENTRY },
    },
    {
      id: 'act-flip',
      description: 'Act: click thẻ → lật sang mặt sau, hiển thị nghĩa.',
      props: { entry: JA_ENTRY },
      act: async ctx => {
        await ctx.click('[title="Click to flip"]')
      },
    },
    {
      id: 'act-switch-tab',
      description: 'Act: chọn tab Meaning → Word — front hiển thị nghĩa, flipped reset.',
      props: { entry: JA_ENTRY },
      act: async ctx => {
        clickTab(ctx.root, 'Meaning → Word')
        await ctx.wait(0)
      },
    },
    {
      id: 'probe-minimal-entry',
      probe: true,
      description: 'Probe (gotcha optional fields): entry rỗng — hiển thị "—", không crash, không "undefined".',
      props: { entry: {} },
    },
  ],
  invariants: [
    {
      id: 'three-tabs-present',
      description: 'Đủ 3 tab loại card',
      check: ({ root }) => {
        const labels = ['Word → Meaning', 'Meaning → Word', 'Sentence']
        const buttons = Array.from(root.querySelectorAll('button')).map(b => b.textContent)
        const missing = labels.filter(l => !buttons.includes(l))
        return missing.length === 0 || `thiếu tab: ${missing.join(', ')}`
      },
    },
    {
      id: 'front-shows-word-and-reading',
      description: 'Tab mặc định: front hiển thị từ + hiragana',
      onlyFixtures: ['language-entry'],
      check: ({ root, contract }) => {
        if (contract.tab !== 'word_to_meaning') return `contract.tab="${contract.tab}"`
        const text = root.textContent ?? ''
        if (!text.includes('食べる')) return 'không thấy từ'
        return text.includes('たべる') || 'không thấy hiragana'
      },
    },
    {
      id: 'flip-shows-back',
      description: 'Sau khi lật: contract flipped=true, mặt sau hiển thị nghĩa',
      onlyFixtures: ['act-flip'],
      check: ({ root, contract }) => {
        if (contract.flipped !== 'true') return `contract.flipped="${contract.flipped}"`
        const text = root.textContent ?? ''
        if (!text.includes('Back')) return 'không thấy nhãn Back'
        return text.includes('ăn') || 'không thấy nghĩa ở mặt sau'
      },
    },
    {
      id: 'tab-switch-updates-front',
      description: 'Đổi tab: contract tab khớp, front hiển thị nghĩa, flipped=false',
      onlyFixtures: ['act-switch-tab'],
      check: ({ root, contract }) => {
        if (contract.tab !== 'meaning_to_word') return `contract.tab="${contract.tab}"`
        if (contract.flipped !== 'false') return `contract.flipped="${contract.flipped}"`
        return (root.textContent ?? '').includes('ăn') || 'front không hiển thị nghĩa'
      },
    },
    {
      id: 'minimal-entry-safe',
      description: 'Entry rỗng: placeholder "—" hiển thị, không leak "undefined"',
      onlyFixtures: ['probe-minimal-entry'],
      check: ({ root }) => {
        const text = root.textContent ?? ''
        if (!text.includes('—')) return 'không thấy placeholder "—"'
        return !text.includes('undefined') || 'leak chữ "undefined" ra UI'
      },
    },
  ],
})
