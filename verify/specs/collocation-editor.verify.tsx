import type { ComponentProps } from 'react'
import { z } from 'zod'
import { CollocationEditor } from '@/components/preview/CollocationEditor'
import { registerUnit } from '@/verify/core/registry'
import { fn } from '@/verify/core/schema-helpers'

type CollocationEditorProps = ComponentProps<typeof CollocationEditor>

// Spy cho onChange — reset trong act
const changeSpy = { count: 0, lastValue: null as string[] | null }
const recordChange = (items: string[]) => {
  changeSpy.count++
  changeSpy.lastValue = items
}
const noop = () => undefined

function pressEnter(root: HTMLElement): void {
  const input = root.querySelector<HTMLInputElement>('input')
  if (!input) throw new Error('không tìm thấy input')
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
}

registerUnit<CollocationEditorProps>({
  id: 'CollocationEditor',
  title: 'CollocationEditor',
  description: 'Editor collocations: chip badge kéo thả (dnd-kit) + input thêm bằng Enter.',
  kind: 'component',
  render: props => <CollocationEditor {...props} />,
  propsSchema: z.object({
    items: z.array(z.string()),
    onChange: fn<(items: string[]) => void>(),
  }),
  fixtures: [
    {
      id: 'with-items',
      description: '2 collocations — mỗi item một chip removable.',
      props: { items: ['take a break', 'make sense'], onChange: noop },
    },
    {
      id: 'empty',
      description: 'Không có item — chỉ còn input.',
      props: { items: [], onChange: noop },
    },
    {
      id: 'act-add',
      description: 'Act: gõ + Enter → onChange nhận mảng có item mới.',
      props: { items: ['take a break'], onChange: recordChange },
      act: async ctx => {
        changeSpy.count = 0
        changeSpy.lastValue = null
        await ctx.type('input', 'pay attention')
        pressEnter(ctx.root)
        await ctx.wait(0)
      },
    },
    {
      id: 'act-remove',
      description: 'Act: click nút remove của chip đầu → onChange nhận mảng không còn item đó.',
      props: { items: ['take a break', 'make sense'], onChange: recordChange },
      act: async ctx => {
        changeSpy.count = 0
        changeSpy.lastValue = null
        await ctx.click('[aria-label="Remove"]')
      },
    },
    {
      id: 'probe-duplicate-add',
      probe: true,
      description: 'Probe: thêm item trùng — onChange KHÔNG gọi, input được xóa.',
      props: { items: ['take a break'], onChange: recordChange },
      act: async ctx => {
        changeSpy.count = 0
        await ctx.type('input', 'take a break')
        pressEnter(ctx.root)
        await ctx.wait(0)
      },
    },
  ],
  invariants: [
    {
      id: 'chip-count-matches-items',
      description: 'Số chip badge = items.length, contract count khớp',
      check: ({ root, props, contract }) => {
        const chips = root.querySelectorAll('[data-verify-unit="Badge"]').length
        if (chips !== props.items.length) {
          return `chips=${chips}, items=${props.items.length}`
        }
        return contract.count === String(props.items.length) || `contract.count="${contract.count}"`
      },
    },
    {
      id: 'add-fires-with-new-item',
      description: 'Enter thêm item: onChange([...items, mới]) gọi 1 lần',
      onlyFixtures: ['act-add'],
      check: () =>
        (changeSpy.count === 1 &&
          JSON.stringify(changeSpy.lastValue) === JSON.stringify(['take a break', 'pay attention'])) ||
        `count=${changeSpy.count}, lastValue=${JSON.stringify(changeSpy.lastValue)}`,
    },
    {
      id: 'remove-fires-without-item',
      description: 'Remove chip: onChange(mảng không còn item) gọi 1 lần',
      onlyFixtures: ['act-remove'],
      check: () =>
        (changeSpy.count === 1 &&
          JSON.stringify(changeSpy.lastValue) === JSON.stringify(['make sense'])) ||
        `count=${changeSpy.count}, lastValue=${JSON.stringify(changeSpy.lastValue)}`,
    },
    {
      id: 'duplicate-add-inert',
      description: 'Item trùng không gọi onChange và input được reset rỗng',
      onlyFixtures: ['probe-duplicate-add'],
      check: ({ root }) => {
        if (changeSpy.count !== 0) return `onChange bị gọi ${changeSpy.count} lần`
        const input = root.querySelector<HTMLInputElement>('input')
        return input?.value === '' || `input.value="${input?.value}"`
      },
    },
  ],
})
