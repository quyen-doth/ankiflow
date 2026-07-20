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
  if (!input) throw new Error('要素が見つかりません')
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
}

// 検証用コメント。
function clickAdd(root: HTMLElement): void {
  const btn = Array.from(root.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Add')
  if (!btn) throw new Error('要素が見つかりません')
  btn.click()
}

registerUnit<CollocationEditorProps>({
  id: 'CollocationEditor',
  title: 'CollocationEditor',
  description: '検証ケース。',
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
      description: 'item がない — "+ Add" ボタンだけが残る。',
      props: { items: [], onChange: noop },
    },
    {
      id: 'act-add',
      description: '検証ケース。',
      props: { items: ['take a break'], onChange: recordChange },
      act: async ctx => {
        changeSpy.count = 0
        changeSpy.lastValue = null
        clickAdd(ctx.root)
        await ctx.wait(0)
        await ctx.type('input', 'pay attention')
        pressEnter(ctx.root)
        await ctx.wait(0)
      },
    },
    {
      id: 'act-remove',
      description: '検証ケース。',
      props: { items: ['take a break', 'make sense'], onChange: recordChange },
      act: async ctx => {
        changeSpy.count = 0
        changeSpy.lastValue = null
        await ctx.click('[aria-label="Remove take a break"]')
      },
    },
    {
      id: 'probe-duplicate-add',
      probe: true,
      description: '検証ケース。',
      props: { items: ['take a break'], onChange: recordChange },
      act: async ctx => {
        changeSpy.count = 0
        clickAdd(ctx.root)
        await ctx.wait(0)
        await ctx.type('input', 'take a break')
        pressEnter(ctx.root)
        await ctx.wait(0)
      },
    },
  ],
  invariants: [
    {
      id: 'chip-count-matches-items',
      description: 'chip 数 = items.length、contract count と一致',
      check: ({ root, props, contract }) => {
        const chips = root.querySelectorAll('button[aria-label^="Remove "]').length
        if (chips !== props.items.length) {
          return `chips=${chips}, items=${props.items.length}`
        }
        return contract.count === String(props.items.length) || `contract.count="${contract.count}"`
      },
    },
    {
      id: 'add-fires-with-new-item',
      description: '検証ケース。',
      onlyFixtures: ['act-add'],
      check: () =>
        (changeSpy.count === 1 &&
          JSON.stringify(changeSpy.lastValue) === JSON.stringify(['take a break', 'pay attention'])) ||
        `count=${changeSpy.count}, lastValue=${JSON.stringify(changeSpy.lastValue)}`,
    },
    {
      id: 'remove-fires-without-item',
      description: '検証ケース。',
      onlyFixtures: ['act-remove'],
      check: () =>
        (changeSpy.count === 1 &&
          JSON.stringify(changeSpy.lastValue) === JSON.stringify(['make sense'])) ||
        `count=${changeSpy.count}, lastValue=${JSON.stringify(changeSpy.lastValue)}`,
    },
    {
      id: 'duplicate-add-inert',
      description: '検証ケース。',
      onlyFixtures: ['probe-duplicate-add'],
      check: ({ root }) => {
        if (changeSpy.count !== 0) return `onChange が呼ばれています ${changeSpy.count} lần`
        const input = root.querySelector<HTMLInputElement>('input')
        return !input || input.value === '' || `input.value="${input?.value}"`
      },
    },
  ],
})
