import type { ComponentProps } from 'react'
import { z } from 'zod'
import { TagInput } from '@/components/ui/TagInput'
import { registerUnit } from '@/verify/core/registry'
import { fn } from '@/verify/core/schema-helpers'

type TagInputProps = ComponentProps<typeof TagInput>

// 検証用コメント。
const changeSpy = { count: 0, lastTags: null as string[] | null }
const recordChange = (tags: string[]) => {
  changeSpy.count++
  changeSpy.lastTags = tags
}
const noop = () => undefined

function pressEnter(root: HTMLElement): void {
  const input = root.querySelector('input')
  input?.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
  )
}

registerUnit<TagInputProps>({
  id: 'TagInput',
  title: 'TagInput',
  description: '検証ケース。',
  kind: 'component',
  render: props => <TagInput {...props} />,
  propsSchema: z.object({
    tags: z.array(z.string()),
    onChange: fn<(tags: string[]) => void>(),
    placeholder: z.string().optional(),
    maxTags: z.number().optional(),
  }),
  fixtures: [
    {
      id: 'empty',
      description: '検証ケース。',
      props: { tags: [], onChange: noop },
    },
    {
      id: 'with-tags',
      description: '検証ケース。',
      props: { tags: ['vocab', 'hsk1'], onChange: noop },
    },
    {
      id: 'act-add-tag',
      description: '検証ケース。',
      props: { tags: ['existing'], onChange: recordChange },
      act: async ctx => {
        changeSpy.count = 0
        changeSpy.lastTags = null
        await ctx.type('input', 'newtag')
        pressEnter(ctx.root)
        await ctx.wait(16)
      },
    },
    {
      id: 'act-remove-tag',
      description: '検証ケース。',
      props: { tags: ['first', 'second'], onChange: recordChange },
      act: async ctx => {
        changeSpy.count = 0
        changeSpy.lastTags = null
        await ctx.click('button[aria-label="Remove"]')
      },
    },
    {
      id: 'probe-at-max',
      probe: true,
      description: '検証ケース。',
      props: { tags: ['a', 'b'], onChange: recordChange, maxTags: 2 },
    },
    {
      id: 'probe-duplicate-add',
      probe: true,
      description: '検証ケース。',
      props: { tags: ['dup'], onChange: recordChange },
      act: async ctx => {
        changeSpy.count = 0
        await ctx.type('input', 'dup')
        pressEnter(ctx.root)
        await ctx.wait(16)
      },
    },
  ],
  invariants: [
    {
      id: 'chip-count-matches',
      description: 'Badge chip の数は tags.length と一致する',
      check: ({ root, props }) => {
        const chips = root.querySelectorAll('[data-verify-unit="Badge"]').length
        return chips === props.tags.length || `chips=${chips}, tags=${props.tags.length}`
      },
    },
    {
      id: 'input-iff-below-max',
      description: '検証ケース。',
      check: ({ root, props }) => {
        const input = root.querySelector('input')
        const expected = props.tags.length < (props.maxTags ?? 10)
        return !!input === expected || `input=${!!input}, expected=${expected}`
      },
    },
    {
      id: 'add-fires-with-appended-array',
      description: '検証ケース。',
      onlyFixtures: ['act-add-tag'],
      check: () =>
        (changeSpy.count === 1 &&
          JSON.stringify(changeSpy.lastTags) === JSON.stringify(['existing', 'newtag'])) ||
        `count=${changeSpy.count}, lastTags=${JSON.stringify(changeSpy.lastTags)}`,
    },
    {
      id: 'remove-fires-with-filtered-array',
      description: '検証ケース。',
      onlyFixtures: ['act-remove-tag'],
      check: () =>
        (changeSpy.count === 1 &&
          JSON.stringify(changeSpy.lastTags) === JSON.stringify(['second'])) ||
        `count=${changeSpy.count}, lastTags=${JSON.stringify(changeSpy.lastTags)}`,
    },
    {
      id: 'duplicate-add-inert',
      description: '検証ケース。',
      onlyFixtures: ['probe-duplicate-add'],
      check: () => changeSpy.count === 0 || `呼び出し回数が不正です`,
    },
  ],
})
