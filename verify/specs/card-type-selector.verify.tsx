import type { ComponentProps } from 'react'
import { z } from 'zod'
import { CardTypeSelector } from '@/components/create/CardTypeSelector'
import { registerUnit } from '@/verify/core/registry'
import { fn } from '@/verify/core/schema-helpers'
import { FormType, LanguageType } from '@/types'

type CardTypeSelectorProps = ComponentProps<typeof CardTypeSelector>

// 検証用コメント。
const CARD_TYPE_SEED = {
  card_types: [
    { id: 'ct-en', name: 'EN Word → Meaning', form_type: FormType.LANGUAGE, language: LanguageType.ENGLISH, is_active: true, sort_order: 1 },
    { id: 'ct-any', name: 'Listening', form_type: FormType.LANGUAGE, language: null, is_active: true, sort_order: 2 },
    { id: 'ct-zh', name: 'ZH Tones', form_type: FormType.LANGUAGE, language: LanguageType.CHINESE, is_active: true, sort_order: 3 },
    { id: 'ct-zh-tw', name: 'Traditional only', form_type: FormType.LANGUAGE, language: 'zh-TW', is_active: true, sort_order: 4 },
    { id: 'ct-zh-cn', name: 'Simplified only', form_type: FormType.LANGUAGE, language: 'zh-CN', is_active: true, sort_order: 5 },
    { id: 'ct-it', name: 'IT Concept', form_type: FormType.IT, language: null, is_active: true, sort_order: 1 },
    { id: 'ct-old', name: 'Old Card', form_type: FormType.LANGUAGE, language: null, is_active: false, sort_order: 6 },
  ],
}

// onChange 用 spy — act 内で reset
const changeSpy = { count: 0, lastValue: null as string[] | null }
const recordChange = (ids: string[]) => {
  changeSpy.count++
  changeSpy.lastValue = ids
}
const noop = () => undefined

// Chip buttons render an icon (svg) + name span; the All/Clear links have no svg.
function chipButtons(root: HTMLElement): HTMLButtonElement[] {
  return Array.from(root.querySelectorAll('button')).filter(b => b.querySelector('svg'))
}

function isChecked(btn: HTMLButtonElement): boolean {
  return btn.className.includes('rgba(49,99,66,0.07)')
}

// Click a header link (All / Clear) — a button with no svg matching exact text.
function clickLinkByText(root: HTMLElement, text: string): void {
  const btn = Array.from(root.querySelectorAll('button')).find(
    b => !b.querySelector('svg') && b.textContent?.trim() === text
  )
  if (!btn) throw new Error(`link が見つかりません "${text}"`)
  btn.click()
}

function visibleNames(root: HTMLElement): string[] {
  return chipButtons(root).map(b => b.querySelector('span')?.textContent?.trim() ?? '')
}

registerUnit<CardTypeSelectorProps>({
  id: 'CardTypeSelector',
  title: 'CardTypeSelector',
  description:
    'Chip card types: form_type + is_active + language で filter (null = 全 language)、All / Clear (vitest-only)。',
  kind: 'component',
  render: props => <CardTypeSelector {...props} />,
  propsSchema: z.object({
    formType: z.string().optional(),
    language: z.string().optional(),
    selectedIds: z.array(z.string()),
    onChange: fn<(ids: string[]) => void>(),
  }),
  fixtures: [
    {
      id: 'loaded-language-en',
      description: '検証ケース。',
      props: { formType: 'Language', language: LanguageType.ENGLISH, selectedIds: ['ct-en'], onChange: noop },
      mocks: { firestore: CARD_TYPE_SEED },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'act-toggle',
      description: '検証ケース。',
      props: { formType: 'Language', language: LanguageType.ENGLISH, selectedIds: ['ct-en'], onChange: recordChange },
      mocks: { firestore: CARD_TYPE_SEED },
      act: async ctx => {
        await ctx.wait(50)
        changeSpy.count = 0
        changeSpy.lastValue = null
        const unchecked = chipButtons(ctx.root).find(b => !isChecked(b))
        if (!unchecked) throw new Error('対象がありません')
        unchecked.click()
        await ctx.wait(0)
      },
    },
    {
      id: 'act-select-all',
      description: '検証ケース。',
      props: { formType: 'Language', language: LanguageType.ENGLISH, selectedIds: [], onChange: recordChange },
      mocks: { firestore: CARD_TYPE_SEED },
      act: async ctx => {
        await ctx.wait(50)
        changeSpy.count = 0
        changeSpy.lastValue = null
        clickLinkByText(ctx.root, 'All')
        await ctx.wait(0)
      },
    },
    {
      id: 'act-clear',
      description: 'Act: Clear → onChange([]).',
      props: { formType: 'Language', language: LanguageType.ENGLISH, selectedIds: ['ct-en', 'ct-any'], onChange: recordChange },
      mocks: { firestore: CARD_TYPE_SEED },
      act: async ctx => {
        await ctx.wait(50)
        changeSpy.count = 0
        changeSpy.lastValue = null
        clickLinkByText(ctx.root, 'Clear')
        await ctx.wait(0)
      },
    },
    {
      id: 'probe-language-mismatch',
      probe: true,
      description: '検証ケース。',
      props: { formType: 'Language', language: LanguageType.JAPANESE, selectedIds: [], onChange: noop },
      mocks: { firestore: CARD_TYPE_SEED },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'regional-language-includes-generic',
      description: 'zh-TW では generic zh と exact zh-TW を表示し、zh-CN は除外する。',
      props: { formType: 'Language', language: 'zh-TW', selectedIds: [], onChange: noop },
      mocks: { firestore: CARD_TYPE_SEED },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
  ],
  invariants: [
    {
      id: 'filtered-by-language',
      description: '検証ケース。',
      onlyFixtures: ['loaded-language-en', 'act-toggle', 'act-select-all', 'act-clear'],
      check: ({ root }) => {
        const names = visibleNames(root)
        return (
          JSON.stringify(names) === JSON.stringify(['EN Word → Meaning', 'Listening']) ||
          `表示: ${names.join(' | ')}`
        )
      },
    },
    {
      id: 'checked-matches-selection',
      description: 'Chip checked が selectedIds と一致し、contract selected も一致',
      onlyFixtures: ['loaded-language-en'],
      check: ({ root, contract }) => {
        const checked = chipButtons(root).filter(isChecked).length
        if (checked !== 1) return `checked=${checked}, expected=1`
        return contract.selected === '1' || `contract.selected="${contract.selected}"`
      },
    },
    {
      id: 'toggle-adds-id',
      description: '検証ケース。',
      onlyFixtures: ['act-toggle'],
      check: () =>
        (changeSpy.count === 1 &&
          JSON.stringify(changeSpy.lastValue) === JSON.stringify(['ct-en', 'ct-any'])) ||
        `count=${changeSpy.count}, lastValue=${JSON.stringify(changeSpy.lastValue)}`,
    },
    {
      id: 'select-all-returns-visible-ids',
      description: '検証ケース。',
      onlyFixtures: ['act-select-all'],
      check: () =>
        (changeSpy.count === 1 &&
          JSON.stringify(changeSpy.lastValue) === JSON.stringify(['ct-en', 'ct-any'])) ||
        `count=${changeSpy.count}, lastValue=${JSON.stringify(changeSpy.lastValue)}`,
    },
    {
      id: 'clear-returns-empty',
      description: '検証ケース。',
      onlyFixtures: ['act-clear'],
      check: () =>
        (changeSpy.count === 1 && JSON.stringify(changeSpy.lastValue) === JSON.stringify([])) ||
        `count=${changeSpy.count}, lastValue=${JSON.stringify(changeSpy.lastValue)}`,
    },
    {
      id: 'language-mismatch-only-null',
      description: '検証ケース。',
      onlyFixtures: ['probe-language-mismatch'],
      check: ({ root, contract }) => {
        const names = visibleNames(root)
        if (JSON.stringify(names) !== JSON.stringify(['Listening'])) {
          return `表示: ${names.join(' | ')}`
        }
        return contract.count === '1' || `contract.count="${contract.count}"`
      },
    },
    {
      id: 'regional-language-scope',
      description: 'generic scope は regional entry に適用するが、別 regional scope は適用しない。',
      onlyFixtures: ['regional-language-includes-generic'],
      check: ({ root }) => {
        const names = visibleNames(root)
        return (
          JSON.stringify(names) === JSON.stringify(['Listening', 'ZH Tones', 'Traditional only'])
          || `表示: ${names.join(' | ')}`
        )
      },
    },
  ],
})
