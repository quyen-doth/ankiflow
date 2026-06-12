import type { ComponentProps } from 'react'
import { z } from 'zod'
import { TagInput } from '@/components/ui/TagInput'
import { registerUnit } from '@/verify/core/registry'
import { fn } from '@/verify/core/schema-helpers'

type TagInputProps = ComponentProps<typeof TagInput>

// Spy ghi lại mảng tags mà onChange nhận được — act reset trước
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
  description: 'Nhập tag: thêm bằng Enter/dấu phẩy, xóa từng tag, giới hạn maxTags.',
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
      description: 'Chưa có tag nào.',
      props: { tags: [], onChange: noop },
    },
    {
      id: 'with-tags',
      description: 'Có sẵn 2 tag.',
      props: { tags: ['vocab', 'hsk1'], onChange: noop },
    },
    {
      id: 'act-add-tag',
      description: 'Act: gõ tag mới + Enter → onChange nhận mảng đã thêm.',
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
      description: 'Act: click nút remove của tag đầu → onChange nhận mảng đã bớt.',
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
      description: 'Probe: đã đạt maxTags — input biến mất, không thêm được nữa.',
      props: { tags: ['a', 'b'], onChange: recordChange, maxTags: 2 },
    },
    {
      id: 'probe-duplicate-add',
      probe: true,
      description: 'Probe: gõ tag trùng + Enter — onChange KHÔNG được gọi.',
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
      description: 'Số chip Badge = tags.length',
      check: ({ root, props }) => {
        const chips = root.querySelectorAll('[data-verify-unit="Badge"]').length
        return chips === props.tags.length || `chips=${chips}, tags=${props.tags.length}`
      },
    },
    {
      id: 'input-iff-below-max',
      description: 'Input hiện khi và chỉ khi tags.length < maxTags',
      check: ({ root, props }) => {
        const input = root.querySelector('input')
        const expected = props.tags.length < (props.maxTags ?? 10)
        return !!input === expected || `input=${!!input}, expected=${expected}`
      },
    },
    {
      id: 'add-fires-with-appended-array',
      description: 'Thêm tag gọi onChange với mảng cũ + tag mới',
      onlyFixtures: ['act-add-tag'],
      check: () =>
        (changeSpy.count === 1 &&
          JSON.stringify(changeSpy.lastTags) === JSON.stringify(['existing', 'newtag'])) ||
        `count=${changeSpy.count}, lastTags=${JSON.stringify(changeSpy.lastTags)}`,
    },
    {
      id: 'remove-fires-with-filtered-array',
      description: 'Xóa tag gọi onChange với mảng đã loại tag đó',
      onlyFixtures: ['act-remove-tag'],
      check: () =>
        (changeSpy.count === 1 &&
          JSON.stringify(changeSpy.lastTags) === JSON.stringify(['second'])) ||
        `count=${changeSpy.count}, lastTags=${JSON.stringify(changeSpy.lastTags)}`,
    },
    {
      id: 'duplicate-add-inert',
      description: 'Tag trùng không gọi onChange',
      onlyFixtures: ['probe-duplicate-add'],
      check: () => changeSpy.count === 0 || `onChange được gọi ${changeSpy.count} lần`,
    },
  ],
})
