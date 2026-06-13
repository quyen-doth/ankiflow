import type { ComponentProps } from 'react'
import { z } from 'zod'
import { EditableField } from '@/components/preview/EditableField'
import { registerUnit } from '@/verify/core/registry'
import { fn } from '@/verify/core/schema-helpers'

type EditableFieldProps = ComponentProps<typeof EditableField>

// Spy cho onSave — reset trong act
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
  if (!btn) throw new Error(`không tìm thấy button "${text}"`)
  btn.click()
}

registerUnit<EditableFieldProps>({
  id: 'EditableField',
  title: 'EditableField',
  description: 'Field click-to-edit: span hiển thị ↔ input/textarea + Save/Cancel.',
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
      description: 'Chế độ hiển thị — span chứa value.',
      props: { value: 'serendipity', onSave: noop },
    },
    {
      id: 'act-enter-edit',
      description: 'Act: click span → vào chế độ edit, input chứa draft = value.',
      props: { value: 'serendipity', onSave: noop },
      act: async ctx => {
        await ctx.click('[data-verify-unit="EditableField"]')
      },
    },
    {
      id: 'act-edit-save',
      description: 'Act: edit → gõ giá trị mới → Save → onSave nhận giá trị mới, thoát edit.',
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
      description: 'Act: edit → gõ → Cancel → onSave KHÔNG gọi, hiển thị lại value gốc.',
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
      description: 'multiline=true → edit mode dùng textarea.',
      props: { value: 'A long example sentence.', onSave: noop, multiline: true },
      act: async ctx => {
        await ctx.click('[data-verify-unit="EditableField"]')
      },
    },
    {
      id: 'probe-empty-value',
      probe: true,
      description: 'Probe: value rỗng — hiển thị placeholder in nghiêng, không crash.',
      props: { value: '', onSave: noop, placeholder: 'Add meaning...' },
    },
  ],
  invariants: [
    {
      id: 'display-shows-value',
      description: 'Chế độ hiển thị: span chứa value',
      onlyFixtures: ['display'],
      check: ({ root, props }) =>
        (root.textContent ?? '').includes(props.value) || `không thấy "${props.value}"`,
    },
    {
      id: 'edit-mode-has-draft',
      description: 'Vào edit: contract editing=true, input chứa draft = value',
      onlyFixtures: ['act-enter-edit'],
      check: ({ root, contract, props }) => {
        if (contract.editing !== 'true') return `contract.editing="${contract.editing}"`
        const input = root.querySelector<HTMLInputElement>('input')
        if (!input) return 'không có input trong edit mode'
        return input.value === props.value || `input.value="${input.value}"`
      },
    },
    {
      id: 'save-fires-new-value',
      description: 'Save gọi onSave(giá trị mới) đúng 1 lần và thoát edit',
      onlyFixtures: ['act-edit-save'],
      check: ({ contract }) => {
        if (saveSpy.count !== 1 || saveSpy.lastValue !== 'new value') {
          return `count=${saveSpy.count}, lastValue="${saveSpy.lastValue}"`
        }
        return contract.editing === 'false' || 'vẫn ở edit mode sau Save'
      },
    },
    {
      id: 'cancel-discards-draft',
      description: 'Cancel không gọi onSave, hiển thị lại value gốc',
      onlyFixtures: ['act-edit-cancel'],
      check: ({ root, contract }) => {
        if (saveSpy.count !== 0) return `onSave bị gọi ${saveSpy.count} lần`
        if (contract.editing !== 'false') return 'vẫn ở edit mode sau Cancel'
        return (root.textContent ?? '').includes('original') || 'value gốc không hiển thị lại'
      },
    },
    {
      id: 'multiline-uses-textarea',
      description: 'multiline=true → edit mode render textarea, không phải input',
      onlyFixtures: ['multiline-edit'],
      check: ({ root }) =>
        (!!root.querySelector('textarea') && !root.querySelector('input')) ||
        'không có textarea / có input nhầm',
    },
    {
      id: 'empty-shows-placeholder',
      description: 'Value rỗng: hiển thị placeholder, contract empty=true',
      onlyFixtures: ['probe-empty-value'],
      check: ({ root, contract }) => {
        if (contract.empty !== 'true') return `contract.empty="${contract.empty}"`
        return (root.textContent ?? '').includes('Add meaning...') || 'placeholder không hiển thị'
      },
    },
  ],
})
