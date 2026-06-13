import type { ComponentProps } from 'react'
import { z } from 'zod'
import { DeckSelector } from '@/components/create/DeckSelector'
import { registerUnit } from '@/verify/core/registry'
import { fn } from '@/verify/core/schema-helpers'
import { FormType } from '@/types'

type DeckSelectorProps = ComponentProps<typeof DeckSelector>

// Seed decks: 2 active (sort_order đảo thứ tự), 1 inactive phải bị filter
const DECK_SEED = {
  decks: [
    { id: 'd-en', display_name: 'English Vocab', form_type: FormType.LANGUAGE, is_active: true, sort_order: 2 },
    { id: 'd-it', display_name: 'IT Terms', form_type: FormType.IT, is_active: true, sort_order: 1 },
    { id: 'd-old', display_name: 'Archived Deck', form_type: FormType.LANGUAGE, is_active: false, sort_order: 0 },
  ],
}

// Spy cho onChange(deckId, uiFormType) — reset trong act
const changeSpy = { count: 0, lastId: null as string | null, lastFormType: null as string | null }
const recordChange = (deckId: string, formType: 'Language' | 'IT' | 'General') => {
  changeSpy.count++
  changeSpy.lastId = deckId
  changeSpy.lastFormType = formType
}
function selectValue(root: HTMLElement, value: string): void {
  const select = root.querySelector<HTMLSelectElement>('select')
  if (!select) throw new Error('không tìm thấy select')
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set
  setter?.call(select, value)
  select.dispatchEvent(new Event('change', { bubbles: true }))
}

registerUnit<DeckSelectorProps>({
  id: 'DeckSelector',
  title: 'DeckSelector',
  description: 'Select deck từ Firestore: chỉ is_active, sort theo sort_order (vitest-only).',
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
      description: '2 deck active load từ stub, deck inactive bị filter.',
      props: { value: '' },
      mocks: { firestore: DECK_SEED },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'empty',
      description: 'Collection rỗng — chỉ còn placeholder option.',
      props: { value: '' },
      mocks: { firestore: { decks: [] } },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'act-select',
      description: 'Act: chọn deck → onChange nhận (deckId, UI form type từ DB_FORM_TYPE_TO_UI).',
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
      description: 'Probe: mọi deck đều inactive — bị filter hết, không crash.',
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
      description: 'Chỉ deck is_active xuất hiện trong options',
      onlyFixtures: ['loaded', 'act-select'],
      check: ({ root }) => {
        const labels = Array.from(root.querySelectorAll('option'))
          .filter(o => o.getAttribute('value') !== '')
          .map(o => o.textContent)
        if (labels.length !== 2) return `options=${labels.length}, expected=2`
        return !labels.includes('Archived Deck') || 'deck inactive lọt vào options'
      },
    },
    {
      id: 'sorted-by-sort-order',
      description: 'Options sắp theo sort_order tăng dần',
      onlyFixtures: ['loaded', 'act-select'],
      check: ({ root }) => {
        const labels = Array.from(root.querySelectorAll('option'))
          .filter(o => o.getAttribute('value') !== '')
          .map(o => o.textContent)
        return (
          JSON.stringify(labels) === JSON.stringify(['IT Terms', 'English Vocab']) ||
          `thứ tự: ${labels.join(' | ')}`
        )
      },
    },
    {
      id: 'empty-renders-placeholder-only',
      description: 'Không có deck: chỉ còn placeholder, select không crash',
      onlyFixtures: ['empty', 'probe-all-inactive'],
      check: ({ root, contract }) => {
        const options = root.querySelectorAll('option').length
        if (options !== 1) return `options=${options}, expected=1 (placeholder)`
        return contract.count === '0' || `contract.count="${contract.count}"`
      },
    },
    {
      id: 'change-maps-formtype',
      description: 'onChange nhận deckId + UI form type đúng mapping',
      onlyFixtures: ['act-select'],
      check: () =>
        (changeSpy.count === 1 &&
          changeSpy.lastId === 'd-en' &&
          changeSpy.lastFormType === 'Language') ||
        `count=${changeSpy.count}, id=${changeSpy.lastId}, formType=${changeSpy.lastFormType}`,
    },
  ],
})
