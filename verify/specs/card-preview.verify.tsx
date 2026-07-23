import type { ComponentProps } from 'react'
import { z } from 'zod'
import { CardPreview } from '@/components/preview/CardPreview'
import { registerUnit } from '@/verify/core/registry'

type CardPreviewProps = ComponentProps<typeof CardPreview>

// 検証用コメント。
const JA_ENTRY: CardPreviewProps['entry'] = {
  word: '食べる',
  hiragana: 'たべる',
  han_viet: 'thực',
  meaning_vi: '食べる',
  word_type: 'verb',
  example_sentence: '毎朝パンを食べる。',
  example_translation: '毎朝パンを食べます。',
}

// 検証用コメント。
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
  if (!btn) throw new Error(`tab が見つかりません "${label}"`)
  btn.click()
}

registerUnit<CardPreviewProps>({
  id: 'CardPreview',
  title: 'CardPreview',
  description: '検証ケース。',
  kind: 'component',
  render: props => <CardPreview {...props} />,
  propsSchema: z.object({
    entry: z.looseObject({}),
    audioUrl: z.string().nullable().optional(),
    audioExampleUrl: z.string().nullable().optional(),
    cardTypes: z.array(z.looseObject({})).optional(),
    selectedCardTypeIds: z.array(z.string()).optional(),
  }),
  fixtures: [
    {
      id: 'language-entry',
      description: '検証ケース。',
      props: { entry: JA_ENTRY, cardTypes: CARD_TYPES, selectedCardTypeIds: SELECTED },
    },
    {
      id: 'act-flip',
      description: '検証ケース。',
      props: { entry: JA_ENTRY, cardTypes: CARD_TYPES, selectedCardTypeIds: SELECTED },
      act: async ctx => {
        await ctx.click('[title="Click to flip"]')
      },
    },
    {
      id: 'act-switch-tab',
      description: '検証ケース。',
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
      id: 'example-audio',
      description: '例文 audio URL がある場合は専用 block を preview chip として表示する。',
      props: {
        entry: JA_ENTRY,
        audioExampleUrl: 'data:audio/mp3;base64,RVhBTVBMRQ==',
        cardTypes: [{
          id: 'ct_example_audio',
          name: 'Example audio',
          template: { front: ['word'], back: ['audio_example'] },
        }],
        selectedCardTypeIds: ['ct_example_audio'],
      },
      act: async ctx => {
        await ctx.click('[title="Click to flip"]')
      },
    },
    {
      id: 'probe-minimal-entry',
      probe: true,
      description: 'Probe (gotcha optional fields): 空 entry — iframe は "No fields" を表示し、"undefined" を漏らさない。',
      props: { entry: {}, cardTypes: CARD_TYPES, selectedCardTypeIds: SELECTED },
    },
  ],
  invariants: [
    {
      id: 'flip-control-covers-iframe',
      description: '検証ケース。',
      check: ({ root }) => {
        const control = root.querySelector('[title="Click to flip"]')
        if (!(control instanceof HTMLButtonElement)) return 'flip control が button ではありません'
        if (!control.parentElement?.querySelector('iframe')) return 'flip control が CardIframe を覆っていません'
        return (
          control.classList.contains('absolute') && control.classList.contains('inset-0')
        ) || 'flip control が iframe 全体を覆っていません'
      },
    },
    {
      id: 'tabs-per-card-type',
      description: '検証ケース。',
      check: ({ root, fixture }) => {
        const selectedIds = new Set(fixture.props.selectedCardTypeIds ?? [])
        const labels = (fixture.props.cardTypes ?? [])
          .filter(cardType => selectedIds.has(cardType.id))
          .map(cardType => cardType.name)
        if (labels.length <= 1) return true
        const buttons = Array.from(root.querySelectorAll('button')).map(b => b.textContent)
        const missing = labels.filter(l => !buttons.includes(l))
        return missing.length === 0 || `tab 不足: ${missing.join(', ')}`
      },
    },
    {
      id: 'front-follows-template',
      description: '検証ケース。',
      onlyFixtures: ['language-entry'],
      check: ({ root, contract }) => {
        if (contract.tab !== 'ct_wm') return `contract.tab="${contract.tab}"`
        const html = srcdoc(root)
        if (!html.includes('食べる')) return '表示が見つかりません'
        if (!html.includes('class="han-viet"')) return '表示が見つかりません'
        return html.includes('たべる') || '表示が見つかりません'
      },
    },
    {
      id: 'flip-shows-back',
      description: '検証ケース。',
      onlyFixtures: ['act-flip'],
      check: ({ root, contract }) => {
        if (contract.flipped !== 'true') return `contract.flipped="${contract.flipped}"`
        const control = root.querySelector('[title="Click to flip"]')
        if (control?.getAttribute('aria-pressed') !== 'true') return 'flip control が back state を反映していません'
        const html = srcdoc(root)
        if (!html.includes('id="answer"')) return '表示が見つかりません'
        return html.includes('食べる') || '表示が見つかりません'
      },
    },
    {
      id: 'tab-switch-updates-front',
      description: '検証ケース。',
      onlyFixtures: ['act-switch-tab'],
      check: ({ root, contract }) => {
        if (contract.tab !== 'ct_mw') return `contract.tab="${contract.tab}"`
        if (contract.flipped !== 'false') return `contract.flipped="${contract.flipped}"`
        return srcdoc(root).includes('食べる') || 'front が meaning を表示していません'
      },
    },
    {
      id: 'minimal-entry-safe',
      description: '空 entry: iframe は "No fields" を表示し、"undefined" を漏らさない',
      onlyFixtures: ['probe-minimal-entry'],
      check: ({ root }) => {
        const html = srcdoc(root)
        if (!html.includes('No fields')) return 'placeholder が見つかりません "No fields"'
        return !html.includes('undefined') || '"undefined" が srcdoc に漏れています'
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
    {
      id: 'example-audio-chip-renders',
      description: '例文 audio は通常音声と異なる label の chip を表示する',
      onlyFixtures: ['example-audio'],
      check: ({ root }) => {
        const html = srcdoc(root)
        if (!html.includes('id="answer"')) return 'back side が表示されていません'
        return html.includes('🔊 Example audio') || 'Example audio chip がありません'
      },
    },
  ],
})
