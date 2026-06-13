import type { ComponentProps } from 'react'
import { z } from 'zod'
import { CardTypeSelector } from '@/components/create/CardTypeSelector'
import { registerUnit } from '@/verify/core/registry'
import { fn } from '@/verify/core/schema-helpers'
import { FormType, LanguageType } from '@/types'

type CardTypeSelectorProps = ComponentProps<typeof CardTypeSelector>

// Seed: ct-en (en), ct-any (language null — mọi ngôn ngữ), ct-zh (zh), ct-it (form IT), ct-old (inactive)
const CARD_TYPE_SEED = {
  card_types: [
    { id: 'ct-en', name: 'EN Word → Meaning', form_type: FormType.LANGUAGE, language: LanguageType.ENGLISH, is_active: true, sort_order: 1 },
    { id: 'ct-any', name: 'Listening', form_type: FormType.LANGUAGE, language: null, is_active: true, sort_order: 2 },
    { id: 'ct-zh', name: 'ZH Tones', form_type: FormType.LANGUAGE, language: LanguageType.CHINESE, is_active: true, sort_order: 3 },
    { id: 'ct-it', name: 'IT Concept', form_type: FormType.IT, language: null, is_active: true, sort_order: 1 },
    { id: 'ct-old', name: 'Old Card', form_type: FormType.LANGUAGE, language: null, is_active: false, sort_order: 4 },
  ],
}

// Spy cho onChange — reset trong act
const changeSpy = { count: 0, lastValue: null as string[] | null }
const recordChange = (ids: string[]) => {
  changeSpy.count++
  changeSpy.lastValue = ids
}
const noop = () => undefined

function clickButtonByText(root: HTMLElement, text: string): void {
  const btn = Array.from(root.querySelectorAll('button')).find(b =>
    b.textContent?.includes(text)
  )
  if (!btn) throw new Error(`không tìm thấy button "${text}"`)
  btn.click()
}

function visibleNames(root: HTMLElement): string[] {
  return Array.from(root.querySelectorAll('label input[type="checkbox"]')).map(
    cb => cb.closest('label')?.querySelector('span')?.textContent?.trim() ?? ''
  )
}

registerUnit<CardTypeSelectorProps>({
  id: 'CardTypeSelector',
  title: 'CardTypeSelector',
  description:
    'Checkbox grid card types: lọc form_type + is_active + language (null = mọi ngôn ngữ), Select All / Clear (vitest-only).',
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
      description: 'formType=Language + language=en → ct-en + ct-any (zh/IT/inactive bị filter).',
      props: { formType: 'Language', language: LanguageType.ENGLISH, selectedIds: ['ct-en'], onChange: noop },
      mocks: { firestore: CARD_TYPE_SEED },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'act-toggle',
      description: 'Act: tick checkbox chưa chọn → onChange thêm id.',
      props: { formType: 'Language', language: LanguageType.ENGLISH, selectedIds: ['ct-en'], onChange: recordChange },
      mocks: { firestore: CARD_TYPE_SEED },
      act: async ctx => {
        await ctx.wait(50)
        changeSpy.count = 0
        changeSpy.lastValue = null
        const checkboxes = ctx.root.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')
        const unchecked = Array.from(checkboxes).find(cb => !cb.checked)
        if (!unchecked) throw new Error('không có checkbox chưa chọn')
        unchecked.click()
        await ctx.wait(0)
      },
    },
    {
      id: 'act-select-all',
      description: 'Act: Select All → onChange nhận toàn bộ id đang hiển thị.',
      props: { formType: 'Language', language: LanguageType.ENGLISH, selectedIds: [], onChange: recordChange },
      mocks: { firestore: CARD_TYPE_SEED },
      act: async ctx => {
        await ctx.wait(50)
        changeSpy.count = 0
        changeSpy.lastValue = null
        clickButtonByText(ctx.root, 'Select All')
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
        clickButtonByText(ctx.root, 'Clear')
        await ctx.wait(0)
      },
    },
    {
      id: 'probe-language-mismatch',
      probe: true,
      description: 'Probe: language=ja không khớp seed — chỉ còn card type language=null.',
      props: { formType: 'Language', language: LanguageType.JAPANESE, selectedIds: [], onChange: noop },
      mocks: { firestore: CARD_TYPE_SEED },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
  ],
  invariants: [
    {
      id: 'filtered-by-language',
      description: 'Chỉ card type language khớp hoặc null hiển thị, sort theo sort_order',
      onlyFixtures: ['loaded-language-en', 'act-toggle', 'act-select-all', 'act-clear'],
      check: ({ root }) => {
        const names = visibleNames(root)
        return (
          JSON.stringify(names) === JSON.stringify(['EN Word → Meaning', 'Listening']) ||
          `hiển thị: ${names.join(' | ')}`
        )
      },
    },
    {
      id: 'checked-matches-selection',
      description: 'Checkbox checked khớp selectedIds, contract selected khớp',
      onlyFixtures: ['loaded-language-en'],
      check: ({ root, contract }) => {
        const checked = root.querySelectorAll('input[type="checkbox"]:checked').length
        if (checked !== 1) return `checked=${checked}, expected=1`
        return contract.selected === '1' || `contract.selected="${contract.selected}"`
      },
    },
    {
      id: 'toggle-adds-id',
      description: 'Tick checkbox: onChange thêm id đó',
      onlyFixtures: ['act-toggle'],
      check: () =>
        (changeSpy.count === 1 &&
          JSON.stringify(changeSpy.lastValue) === JSON.stringify(['ct-en', 'ct-any'])) ||
        `count=${changeSpy.count}, lastValue=${JSON.stringify(changeSpy.lastValue)}`,
    },
    {
      id: 'select-all-returns-visible-ids',
      description: 'Select All trả về đúng các id đang hiển thị',
      onlyFixtures: ['act-select-all'],
      check: () =>
        (changeSpy.count === 1 &&
          JSON.stringify(changeSpy.lastValue) === JSON.stringify(['ct-en', 'ct-any'])) ||
        `count=${changeSpy.count}, lastValue=${JSON.stringify(changeSpy.lastValue)}`,
    },
    {
      id: 'clear-returns-empty',
      description: 'Clear trả về mảng rỗng',
      onlyFixtures: ['act-clear'],
      check: () =>
        (changeSpy.count === 1 && JSON.stringify(changeSpy.lastValue) === JSON.stringify([])) ||
        `count=${changeSpy.count}, lastValue=${JSON.stringify(changeSpy.lastValue)}`,
    },
    {
      id: 'language-mismatch-only-null',
      description: 'language không khớp: chỉ card type language=null còn lại',
      onlyFixtures: ['probe-language-mismatch'],
      check: ({ root, contract }) => {
        const names = visibleNames(root)
        if (JSON.stringify(names) !== JSON.stringify(['Listening'])) {
          return `hiển thị: ${names.join(' | ')}`
        }
        return contract.count === '1' || `contract.count="${contract.count}"`
      },
    },
  ],
})
