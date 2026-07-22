import type { ComponentProps } from 'react'
import { z } from 'zod'
import { Modal } from '@/components/ui/Modal'
import { registerUnit } from '@/verify/core/registry'
import { fn, reactNode } from '@/verify/core/schema-helpers'

type ModalProps = ComponentProps<typeof Modal>

// 検証用コメント。
const closeSpy = { count: 0 }
const recordClose = () => {
  closeSpy.count++
}
const noop = () => undefined

registerUnit<ModalProps>({
  id: 'Modal',
  title: 'Modal',
  description: '検証ケース。',
  kind: 'component',
  allowsEmptyRender: true,
  render: props => <Modal {...props} />,
  propsSchema: z.object({
    open: z.boolean(),
    onClose: fn(),
    title: z.string().optional(),
    description: z.string().optional(),
    children: reactNode(),
    size: z.enum(['sm', 'md', 'lg']).optional(),
    className: z.string().optional(),
  }),
  fixtures: [
    {
      id: 'closed',
      description: '検証ケース。',
      props: { open: false, onClose: noop, children: 'Hidden content' },
    },
    {
      id: 'open-basic',
      description: '検証ケース。',
      props: { open: true, onClose: noop, children: 'Modal body content' },
    },
    {
      id: 'open-with-title',
      description: '検証ケース。',
      props: {
        open: true,
        onClose: noop,
        title: 'Delete entry',
        description: 'This action cannot be undone.',
        children: 'Are you sure?',
      },
    },
    {
      id: 'act-close-button',
      description: '検証ケース。',
      props: {
        open: true,
        onClose: recordClose,
        title: 'Confirm',
        children: 'Body',
      },
      act: async ctx => {
        closeSpy.count = 0
        await ctx.click('button[aria-label="Close"]')
      },
    },
    {
      id: 'act-escape',
      description: '検証ケース。',
      props: { open: true, onClose: recordClose, title: 'Confirm', children: 'Body' },
      act: async ctx => {
        closeSpy.count = 0
        // 検証用コメント。
        // 検証用コメント。
        await ctx.wait(16)
        document.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
        )
        await ctx.wait(16)
      },
    },
    {
      id: 'probe-no-title',
      probe: true,
      description: '検証ケース。',
      props: { open: true, onClose: noop, children: 'Body without header' },
    },
  ],
  invariants: [
    {
      id: 'renders-iff-open',
      description: '検証ケース。',
      check: ({ root, props }) => {
        const el = root.querySelector('[data-verify-unit="Modal"]')
        return !!el === props.open || `rendered=${!!el}, open=${props.open}`
      },
    },
    {
      id: 'header-iff-title',
      description: '検証ケース。',
      check: ({ root, props }) => {
        if (!props.open) return true
        const heading = root.querySelector('h2')
        const closeBtn = root.querySelector('button[aria-label="Close"]')
        const expected = Boolean(props.title)
        if (!!heading !== expected) return `heading=${!!heading}, expected=${expected}`
        if (!!closeBtn !== expected) return `closeBtn=${!!closeBtn}, expected=${expected}`
        if (props.title && heading?.textContent !== props.title) {
          return `heading="${heading?.textContent}", expected="${props.title}"`
        }
        return true
      },
    },
    {
      id: 'children-rendered-when-open',
      description: 'open 時に children を body 内へ render する',
      check: ({ root, props }) => {
        if (!props.open) return true
        const text = root.textContent ?? ''
        return (
          (typeof props.children === 'string' ? text.includes(props.children) : true) ||
          '表示が見つかりません'
        )
      },
    },
    {
      id: 'close-button-fires-once',
      description: '検証ケース。',
      onlyFixtures: ['act-close-button'],
      check: () => closeSpy.count === 1 || `onClose 呼び出し ${closeSpy.count} 回`,
    },
    {
      id: 'escape-fires-once',
      description: '検証ケース。',
      onlyFixtures: ['act-escape'],
      check: () => closeSpy.count === 1 || `onClose 呼び出し ${closeSpy.count} 回`,
    },
  ],
})
