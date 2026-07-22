import type { ComponentProps } from 'react'
import { z } from 'zod'
import { EditableField } from '@/components/preview/EditableField'
import { registerUnit } from '@/verify/core/registry'
import { fn } from '@/verify/core/schema-helpers'

type EditableFieldProps = ComponentProps<typeof EditableField>

// onSave 用 spy — act 内で reset
const saveSpy = { count: 0, lastValue: null as string | null }
const recordSave = (value: string) => {
  saveSpy.count++
  saveSpy.lastValue = value
}
const noop = () => undefined

function clickButtonByText(root: HTMLElement, text: string): void {
  const btn = Array.from(root.querySelectorAll('button')).find(b =>
    b.textContent?.includes(text)
  )
  if (!btn) throw new Error(`button が見つかりません "${text}"`)
  btn.click()
}

registerUnit<EditableFieldProps>({
  id: 'EditableField',
  title: 'EditableField',
  description: '検証ケース。',
  kind: 'component',
  render: props => <EditableField {...props} />,
  propsSchema: z.object({
    value: z.string(),
    onSave: fn<(value: string) => void>(),
    multiline: z.boolean().optional(),
    className: z.string().optional(),
    placeholder: z.string().optional(),
  }),
  fixtures: [
    {
      id: 'display',
      description: '検証ケース。',
      props: { value: 'serendipity', onSave: noop },
    },
    {
      id: 'act-enter-edit',
      description: '検証ケース。',
      props: { value: 'serendipity', onSave: noop },
      act: async ctx => {
        await ctx.click('[data-verify-unit="EditableField"]')
      },
    },
    {
      id: 'act-edit-save',
      description: '検証ケース。',
      props: { value: 'old value', onSave: recordSave },
      act: async ctx => {
        saveSpy.count = 0
        saveSpy.lastValue = null
        await ctx.click('[data-verify-unit="EditableField"]')
        await ctx.type('input', 'new value')
        clickButtonByText(ctx.root, 'Save')
        await ctx.wait(0)
      },
    },
    {
      id: 'act-edit-cancel',
      description: '検証ケース。',
      props: { value: 'original', onSave: recordSave },
      act: async ctx => {
        saveSpy.count = 0
        saveSpy.lastValue = null
        await ctx.click('[data-verify-unit="EditableField"]')
        await ctx.type('input', 'discarded')
        clickButtonByText(ctx.root, 'Cancel')
        await ctx.wait(0)
      },
    },
    {
      id: 'multiline-edit',
      description: '検証ケース。',
      props: { value: 'A long example sentence.', onSave: noop, multiline: true },
      act: async ctx => {
        await ctx.click('[data-verify-unit="EditableField"]')
      },
    },
    {
      id: 'probe-empty-value',
      probe: true,
      description: '検証ケース。',
      props: { value: '', onSave: noop, placeholder: 'Add meaning...' },
    },
  ],
  invariants: [
    {
      id: 'display-shows-value',
      description: '検証ケース。',
      onlyFixtures: ['display'],
      check: ({ root, props }) =>
        (root.textContent ?? '').includes(props.value) || `見つかりません "${props.value}"`,
    },
    {
      id: 'edit-mode-has-draft',
      description: '検証ケース。',
      onlyFixtures: ['act-enter-edit'],
      check: ({ root, contract, props }) => {
        if (contract.editing !== 'true') return `contract.editing="${contract.editing}"`
        const input = root.querySelector<HTMLInputElement>('input')
        if (!input) return '対象がありません'
        return input.value === props.value || `input.value="${input.value}"`
      },
    },
    {
      id: 'save-fires-new-value',
      description: '検証ケース。',
      onlyFixtures: ['act-edit-save'],
      check: ({ contract }) => {
        if (saveSpy.count !== 1 || saveSpy.lastValue !== 'new value') {
          return `count=${saveSpy.count}, lastValue="${saveSpy.lastValue}"`
        }
        return contract.editing === 'false' || 'Save 後も edit mode のままです'
      },
    },
    {
      id: 'cancel-discards-draft',
      description: '検証ケース。',
      onlyFixtures: ['act-edit-cancel'],
      check: ({ root, contract }) => {
        if (saveSpy.count !== 0) return `onSave が ${saveSpy.count} 回呼ばれています`
        if (contract.editing !== 'false') return 'Cancel 後も edit mode のままです'
        return (root.textContent ?? '').includes('original') || 'original value が再表示されません'
      },
    },
    {
      id: 'multiline-uses-textarea',
      description: '検証ケース。',
      onlyFixtures: ['multiline-edit'],
      check: ({ root }) =>
        (!!root.querySelector('textarea') && !root.querySelector('input')) ||
        '対象がありません',
    },
    {
      id: 'empty-shows-placeholder',
      description: '検証ケース。',
      onlyFixtures: ['probe-empty-value'],
      check: ({ root, contract }) => {
        if (contract.empty !== 'true') return `contract.empty="${contract.empty}"`
        return (root.textContent ?? '').includes('Add meaning...') || 'placeholder が表示されていません'
      },
    },
  ],
})
