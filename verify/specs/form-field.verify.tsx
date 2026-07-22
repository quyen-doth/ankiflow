import type { ChangeEvent, ComponentProps } from 'react'
import { z } from 'zod'
import { Input, Select, Textarea } from '@/components/ui/FormField'
import { registerUnit } from '@/verify/core/registry'

type InputProps = ComponentProps<typeof Input>
type TextareaProps = ComponentProps<typeof Textarea>
type SelectProps = ComponentProps<typeof Select>

// 検証用コメント。
const valueSpy = { lastValue: null as string | null }
const recordInput = (e: ChangeEvent<HTMLInputElement>) => {
  valueSpy.lastValue = e.target.value
}
const recordTextarea = (e: ChangeEvent<HTMLTextAreaElement>) => {
  valueSpy.lastValue = e.target.value
}
const recordSelect = (e: ChangeEvent<HTMLSelectElement>) => {
  valueSpy.lastValue = e.target.value
}

const looseFieldSchema = z.looseObject({
  error: z.boolean().optional(),
  className: z.string().optional(),
})

registerUnit<InputProps>({
  id: 'Input',
  title: 'Input (FormField)',
  description: '検証ケース。',
  kind: 'component',
  render: props => <Input {...props} />,
  propsSchema: looseFieldSchema,
  fixtures: [
    {
      id: 'default',
      description: 'placeholder 付き Input。',
      props: { placeholder: 'Enter word' },
    },
    {
      id: 'with-error',
      description: '検証ケース。',
      props: { placeholder: 'Enter word', error: true },
    },
    {
      id: 'act-type',
      description: '検証ケース。',
      props: { placeholder: 'Enter word', onChange: recordInput },
      act: async ctx => {
        valueSpy.lastValue = null
        await ctx.type('input', 'serendipity')
      },
    },
    {
      id: 'probe-unlabeled',
      probe: true,
      description: '検証ケース。',
      props: {},
    },
  ],
  invariants: [
    {
      id: 'error-contract-matches',
      description: 'data-verify-error が props.error と一致',
      check: ({ contract, props }) =>
        contract.error === String(Boolean(props.error)) ||
        `contract.error="${contract.error}"`,
    },
    {
      id: 'typed-value-received',
      description: '検証ケース。',
      onlyFixtures: ['act-type'],
      check: () => valueSpy.lastValue === 'serendipity' || `lastValue="${valueSpy.lastValue}"`,
    },
  ],
})

registerUnit<TextareaProps>({
  id: 'Textarea',
  title: 'Textarea (FormField)',
  description: '検証ケース。',
  kind: 'component',
  render: props => <Textarea {...props} />,
  propsSchema: looseFieldSchema,
  fixtures: [
    {
      id: 'default',
      description: 'placeholder 付き Textarea。',
      props: { placeholder: 'Notes for AI context', rows: 3 },
    },
    {
      id: 'with-error',
      description: '検証ケース。',
      props: { placeholder: 'Notes', error: true },
    },
    {
      id: 'act-type',
      description: '検証ケース。',
      props: { placeholder: 'Notes', onChange: recordTextarea },
      act: async ctx => {
        valueSpy.lastValue = null
        await ctx.type('textarea', 'multi line note')
      },
    },
    {
      id: 'probe-unlabeled',
      probe: true,
      description: '検証ケース。',
      props: {},
    },
  ],
  invariants: [
    {
      id: 'error-contract-matches',
      description: 'data-verify-error が props.error と一致',
      check: ({ contract, props }) =>
        contract.error === String(Boolean(props.error)) ||
        `contract.error="${contract.error}"`,
    },
    {
      id: 'typed-value-received',
      description: '検証ケース。',
      onlyFixtures: ['act-type'],
      check: () =>
        valueSpy.lastValue === 'multi line note' || `lastValue="${valueSpy.lastValue}"`,
    },
  ],
})

const deckOptions = [
  <option key="" value="">
    Choose deck
  </option>,
  <option key="en" value="deck-en">
    English Vocab
  </option>,
  <option key="zh" value="deck-zh">
    Chinese Vocab
  </option>,
]

registerUnit<SelectProps>({
  id: 'Select',
  title: 'Select (FormField)',
  description: '検証ケース。',
  kind: 'component',
  render: props => <Select {...props} />,
  propsSchema: looseFieldSchema,
  fixtures: [
    {
      id: 'with-options',
      description: '検証ケース。',
      props: { 'aria-label': 'Deck', children: deckOptions },
    },
    {
      id: 'with-error',
      description: '検証ケース。',
      props: { 'aria-label': 'Deck', error: true, children: deckOptions },
    },
    {
      id: 'act-change',
      description: '検証ケース。',
      props: { 'aria-label': 'Deck', children: deckOptions, onChange: recordSelect },
      act: async ctx => {
        valueSpy.lastValue = null
        const select = ctx.root.querySelector<HTMLSelectElement>('select')
        if (!select) throw new Error('要素が見つかりません')
        const setter = Object.getOwnPropertyDescriptor(
          HTMLSelectElement.prototype,
          'value'
        )?.set
        setter?.call(select, 'deck-zh')
        select.dispatchEvent(new Event('change', { bubbles: true }))
        await ctx.wait(16)
      },
    },
    {
      id: 'probe-no-options',
      probe: true,
      description: '検証ケース。',
      props: { 'aria-label': 'Deck', children: [] },
    },
  ],
  invariants: [
    {
      id: 'option-count-matches',
      description: '検証ケース。',
      onlyFixtures: ['with-options', 'with-error', 'act-change'],
      check: ({ root }) => {
        const options = root.querySelectorAll('option').length
        return options === 3 || `options=${options}, expected=3`
      },
    },
    {
      id: 'error-contract-matches',
      description: 'data-verify-error が props.error と一致',
      check: ({ contract, props }) =>
        contract.error === String(Boolean(props.error)) ||
        `contract.error="${contract.error}"`,
    },
    {
      id: 'change-value-received',
      description: '検証ケース。',
      onlyFixtures: ['act-change'],
      check: () => valueSpy.lastValue === 'deck-zh' || `lastValue="${valueSpy.lastValue}"`,
    },
  ],
})
