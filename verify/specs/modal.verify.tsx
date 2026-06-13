import type { ComponentProps } from 'react'
import { z } from 'zod'
import { Modal } from '@/components/ui/Modal'
import { registerUnit } from '@/verify/core/registry'
import { fn, reactNode } from '@/verify/core/schema-helpers'

type ModalProps = ComponentProps<typeof Modal>

// Spy đếm onClose — act reset trước mỗi đường đóng modal
const closeSpy = { count: 0 }
const recordClose = () => {
  closeSpy.count++
}
const noop = () => undefined

registerUnit<ModalProps>({
  id: 'Modal',
  title: 'Modal',
  description: 'Dialog với backdrop, header tùy chọn, đóng bằng X/backdrop/Escape.',
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
      description: 'open=false → không render gì.',
      props: { open: false, onClose: noop, children: 'Hidden content' },
    },
    {
      id: 'open-basic',
      description: 'Mở không title → không có header/nút đóng.',
      props: { open: true, onClose: noop, children: 'Modal body content' },
    },
    {
      id: 'open-with-title',
      description: 'Mở với title + description + nút đóng.',
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
      description: 'Act: click nút X → onClose gọi 1 lần.',
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
      description: 'Act: nhấn Escape → onClose gọi 1 lần.',
      props: { open: true, onClose: recordClose, title: 'Confirm', children: 'Body' },
      act: async ctx => {
        closeSpy.count = 0
        // Chờ passive effect của Modal gắn listener keydown lên document trước khi
        // nhấn Escape — nếu dispatch quá sớm, listener chưa attach → flaky.
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
      description: 'Probe: không title — body vẫn render, không có heading/nút đóng.',
      props: { open: true, onClose: noop, children: 'Body without header' },
    },
  ],
  invariants: [
    {
      id: 'renders-iff-open',
      description: 'Render khi và chỉ khi open',
      check: ({ root, props }) => {
        const el = root.querySelector('[data-verify-unit="Modal"]')
        return !!el === props.open || `rendered=${!!el}, open=${props.open}`
      },
    },
    {
      id: 'header-iff-title',
      description: 'Heading + nút đóng hiện khi và chỉ khi có title',
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
      description: 'Children render trong body khi mở',
      check: ({ root, props }) => {
        if (!props.open) return true
        const text = root.textContent ?? ''
        return (
          (typeof props.children === 'string' ? text.includes(props.children) : true) ||
          'không thấy children trong body'
        )
      },
    },
    {
      id: 'close-button-fires-once',
      description: 'Nút X gọi onClose đúng 1 lần',
      onlyFixtures: ['act-close-button'],
      check: () => closeSpy.count === 1 || `onClose gọi ${closeSpy.count} lần`,
    },
    {
      id: 'escape-fires-once',
      description: 'Escape gọi onClose đúng 1 lần',
      onlyFixtures: ['act-escape'],
      check: () => closeSpy.count === 1 || `onClose gọi ${closeSpy.count} lần`,
    },
  ],
})
