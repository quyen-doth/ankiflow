import type { ChangeEvent, ComponentProps } from 'react'
import { z } from 'zod'
import { Input, Select, Textarea } from '@/components/ui/FormField'
import { registerUnit } from '@/verify/core/registry'

type InputProps = ComponentProps<typeof Input>
type TextareaProps = ComponentProps<typeof Textarea>
type SelectProps = ComponentProps<typeof Select>

// Spy chung cho act-type/act-change — act reset trước
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
  description: 'Text input chuẩn của form, hỗ trợ trạng thái error.',
  kind: 'component',
  render: props => <Input {...props} />,
  propsSchema: looseFieldSchema,
  fixtures: [
    {
      id: 'default',
      description: 'Input với placeholder.',
      props: { placeholder: 'Enter word' },
    },
    {
      id: 'with-error',
      description: 'Trạng thái error.',
      props: { placeholder: 'Enter word', error: true },
    },
    {
      id: 'act-type',
      description: 'Act: gõ text → onChange nhận giá trị.',
      props: { placeholder: 'Enter word', onChange: recordInput },
      act: async ctx => {
        valueSpy.lastValue = null
        await ctx.type('input', 'serendipity')
      },
    },
    {
      id: 'probe-unlabeled',
      probe: true,
      description: 'Probe (EXPECTED_FAIL): không placeholder/aria-label — input mất label.',
      props: {},
    },
  ],
  invariants: [
    {
      id: 'error-contract-matches',
      description: 'data-verify-error khớp props.error',
      check: ({ contract, props }) =>
        contract.error === String(Boolean(props.error)) ||
        `contract.error="${contract.error}"`,
    },
    {
      id: 'typed-value-received',
      description: 'onChange nhận đúng giá trị đã gõ',
      onlyFixtures: ['act-type'],
      check: () => valueSpy.lastValue === 'serendipity' || `lastValue="${valueSpy.lastValue}"`,
    },
  ],
})

registerUnit<TextareaProps>({
  id: 'Textarea',
  title: 'Textarea (FormField)',
  description: 'Textarea chuẩn của form, hỗ trợ trạng thái error.',
  kind: 'component',
  render: props => <Textarea {...props} />,
  propsSchema: looseFieldSchema,
  fixtures: [
    {
      id: 'default',
      description: 'Textarea với placeholder.',
      props: { placeholder: 'Notes for AI context', rows: 3 },
    },
    {
      id: 'with-error',
      description: 'Trạng thái error.',
      props: { placeholder: 'Notes', error: true },
    },
    {
      id: 'act-type',
      description: 'Act: gõ text → onChange nhận giá trị.',
      props: { placeholder: 'Notes', onChange: recordTextarea },
      act: async ctx => {
        valueSpy.lastValue = null
        await ctx.type('textarea', 'multi line note')
      },
    },
    {
      id: 'probe-unlabeled',
      probe: true,
      description: 'Probe (EXPECTED_FAIL): không placeholder/aria-label — textarea mất label.',
      props: {},
    },
  ],
  invariants: [
    {
      id: 'error-contract-matches',
      description: 'data-verify-error khớp props.error',
      check: ({ contract, props }) =>
        contract.error === String(Boolean(props.error)) ||
        `contract.error="${contract.error}"`,
    },
    {
      id: 'typed-value-received',
      description: 'onChange nhận đúng giá trị đã gõ',
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
  description: 'Select chuẩn của form với icon chevron, hỗ trợ error.',
  kind: 'component',
  render: props => <Select {...props} />,
  propsSchema: looseFieldSchema,
  fixtures: [
    {
      id: 'with-options',
      description: '3 option, có aria-label.',
      props: { 'aria-label': 'Deck', children: deckOptions },
    },
    {
      id: 'with-error',
      description: 'Trạng thái error.',
      props: { 'aria-label': 'Deck', error: true, children: deckOptions },
    },
    {
      id: 'act-change',
      description: 'Act: chọn option → onChange nhận value.',
      props: { 'aria-label': 'Deck', children: deckOptions, onChange: recordSelect },
      act: async ctx => {
        valueSpy.lastValue = null
        const select = ctx.root.querySelector<HTMLSelectElement>('select')
        if (!select) throw new Error('không tìm thấy select')
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
      description: 'Probe: không có option nào — select rỗng vẫn render, không crash.',
      props: { 'aria-label': 'Deck', children: [] },
    },
  ],
  invariants: [
    {
      id: 'option-count-matches',
      description: 'Render đủ option',
      onlyFixtures: ['with-options', 'with-error', 'act-change'],
      check: ({ root }) => {
        const options = root.querySelectorAll('option').length
        return options === 3 || `options=${options}, expected=3`
      },
    },
    {
      id: 'error-contract-matches',
      description: 'data-verify-error khớp props.error',
      check: ({ contract, props }) =>
        contract.error === String(Boolean(props.error)) ||
        `contract.error="${contract.error}"`,
    },
    {
      id: 'change-value-received',
      description: 'onChange nhận đúng value đã chọn',
      onlyFixtures: ['act-change'],
      check: () => valueSpy.lastValue === 'deck-zh' || `lastValue="${valueSpy.lastValue}"`,
    },
  ],
})
