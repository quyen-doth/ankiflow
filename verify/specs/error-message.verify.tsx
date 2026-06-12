import type { ComponentProps } from 'react'
import { z } from 'zod'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { registerUnit } from '@/verify/core/registry'

type ErrorMessageProps = ComponentProps<typeof ErrorMessage>

registerUnit<ErrorMessageProps>({
  id: 'ErrorMessage',
  title: 'ErrorMessage',
  description: 'Hộp cảnh báo lỗi; render null khi message null/rỗng.',
  kind: 'component',
  allowsEmptyRender: true,
  render: props => <ErrorMessage {...props} />,
  propsSchema: z.object({
    message: z.string().nullable(),
  }),
  fixtures: [
    {
      id: 'with-message',
      description: 'Có message lỗi.',
      props: { message: 'Failed to connect to Anki. Is Anki Desktop running?' },
    },
    {
      id: 'null-message',
      description: 'message null → không render gì.',
      props: { message: null },
    },
    {
      id: 'probe-long-message',
      probe: true,
      description: 'Probe: message 300 ký tự vẫn render bình thường.',
      props: { message: 'e'.repeat(300) },
    },
  ],
  invariants: [
    {
      id: 'renders-iff-message',
      description: 'Render khi và chỉ khi message truthy',
      check: ({ root, props }) => {
        const el = root.querySelector('[data-verify-unit="ErrorMessage"]')
        const expected = Boolean(props.message)
        return !!el === expected || `rendered=${!!el}, expected=${expected}`
      },
    },
    {
      id: 'message-visible',
      description: 'Nội dung message hiển thị đầy đủ',
      check: ({ root, props }) => {
        if (!props.message) return true
        return (
          (root.textContent ?? '').includes(props.message) ||
          'không thấy nội dung message'
        )
      },
    },
  ],
})
