import type { ComponentProps } from 'react'
import { z } from 'zod'
import { DeckSelector } from '@/components/create/DeckSelector'
import { registerUnit } from '@/verify/core/registry'
import { fn } from '@/verify/core/schema-helpers'
import { FormType } from '@/types'

type DeckSelectorProps = ComponentProps<typeof DeckSelector>

// 検証用コメント。
const DECK_SEED = {
  decks: [
    { id: 'd-en', display_name: 'English Vocab', form_type: FormType.LANGUAGE, is_active: true, sort_order: 2 },
    { id: 'd-it', display_name: 'IT Terms', form_type: FormType.IT, is_active: true, sort_order: 1 },
    { id: 'd-old', display_name: 'Archived Deck', form_type: FormType.LANGUAGE, is_active: false, sort_order: 0 },
  ],
}

// onChange(deckId, uiFormType) 用 spy — act 内で reset
const changeSpy = { count: 0, lastId: null as string | null, lastFormType: null as string | null }
const recordChange = (deckId: string, formType: 'Language' | 'IT' | 'General') => {
  changeSpy.count++
  changeSpy.lastId = deckId
  changeSpy.lastFormType = formType
}
function selectValue(root: HTMLElement, value: string): void {
  const select = root.querySelector<HTMLSelectElement>('select')
  if (!select) throw new Error('要素が見つかりません')
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set
  setter?.call(select, value)
  select.dispatchEvent(new Event('change', { bubbles: true }))
}

registerUnit<DeckSelectorProps>({
  id: 'DeckSelector',
  title: 'DeckSelector',
  description: '検証ケース。',
  kind: 'component',
  render: props => <DeckSelector {...props} />,
  propsSchema: z.object({
    value: z.string(),
    onChange: fn<(deckId: string, formType: 'Language' | 'IT' | 'General') => void>().optional(),
    onChangeId: fn<(deckId: string) => void>().optional(),
    label: z.string().optional(),
  }),
  fixtures: [
    {
      id: 'loaded',
      description: '検証ケース。',
      props: { value: '' },
      mocks: { firestore: DECK_SEED },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'empty',
      description: '検証ケース。',
      props: { value: '' },
      mocks: { firestore: { decks: [] } },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'act-select',
      description: '検証ケース。',
      props: { value: '', onChange: recordChange },
      mocks: { firestore: DECK_SEED },
      act: async ctx => {
        await ctx.wait(50)
        changeSpy.count = 0
        changeSpy.lastId = null
        changeSpy.lastFormType = null
        selectValue(ctx.root, 'd-en')
        await ctx.wait(16)
      },
    },
    {
      id: 'probe-all-inactive',
      probe: true,
      description: '検証ケース。',
      props: { value: '' },
      mocks: {
        firestore: {
          decks: [
            { id: 'd1', display_name: 'Hidden A', form_type: FormType.LANGUAGE, is_active: false, sort_order: 1 },
            { id: 'd2', display_name: 'Hidden B', form_type: FormType.IT, is_active: false, sort_order: 2 },
          ],
        },
      },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
  ],
  invariants: [
    {
      id: 'only-active-decks',
      description: '検証ケース。',
      onlyFixtures: ['loaded', 'act-select'],
      check: ({ root }) => {
        const labels = Array.from(root.querySelectorAll('option'))
          .filter(o => o.getAttribute('value') !== '')
          .map(o => o.textContent)
        if (labels.length !== 2) return `options=${labels.length}, expected=2`
        return !labels.includes('Archived Deck') || 'inactive deck が options に混入しています'
      },
    },
    {
      id: 'sorted-by-sort-order',
      description: '検証ケース。',
      onlyFixtures: ['loaded', 'act-select'],
      check: ({ root }) => {
        const labels = Array.from(root.querySelectorAll('option'))
          .filter(o => o.getAttribute('value') !== '')
          .map(o => o.textContent)
        return (
          JSON.stringify(labels) === JSON.stringify(['IT Terms', 'English Vocab']) ||
          `順序: ${labels.join(' | ')}`
        )
      },
    },
    {
      id: 'empty-renders-placeholder-only',
      description: '検証ケース。',
      onlyFixtures: ['empty', 'probe-all-inactive'],
      check: ({ root, contract }) => {
        const options = root.querySelectorAll('option').length
        if (options !== 1) return `options=${options}, expected=1 (placeholder)`
        return contract.count === '0' || `contract.count="${contract.count}"`
      },
    },
    {
      id: 'change-maps-formtype',
      description: '検証ケース。',
      onlyFixtures: ['act-select'],
      check: () =>
        (changeSpy.count === 1 &&
          changeSpy.lastId === 'd-en' &&
          changeSpy.lastFormType === 'Language') ||
        `count=${changeSpy.count}, id=${changeSpy.lastId}, formType=${changeSpy.lastFormType}`,
    },
  ],
})
