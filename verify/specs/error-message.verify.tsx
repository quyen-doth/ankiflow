import type { ComponentProps } from 'react'
import { z } from 'zod'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { registerUnit } from '@/verify/core/registry'

type ErrorMessageProps = ComponentProps<typeof ErrorMessage>

registerUnit<ErrorMessageProps>({
  id: 'ErrorMessage',
  title: 'ErrorMessage',
  description: '検証ケース。',
  kind: 'component',
  allowsEmptyRender: true,
  render: props => <ErrorMessage {...props} />,
  propsSchema: z.object({
    message: z.string().nullable(),
  }),
  fixtures: [
    {
      id: 'with-message',
      description: '検証ケース。',
      props: { message: 'Failed to connect to Anki. Is Anki Desktop running?' },
    },
    {
      id: 'null-message',
      description: '検証ケース。',
      props: { message: null },
    },
    {
      id: 'probe-long-message',
      probe: true,
      description: '検証ケース。',
      props: { message: 'e'.repeat(300) },
    },
  ],
  invariants: [
    {
      id: 'renders-iff-message',
      description: '検証ケース。',
      check: ({ root, props }) => {
        const el = root.querySelector('[data-verify-unit="ErrorMessage"]')
        const expected = Boolean(props.message)
        return !!el === expected || `rendered=${!!el}, expected=${expected}`
      },
    },
    {
      id: 'message-visible',
      description: '検証ケース。',
      check: ({ root, props }) => {
        if (!props.message) return true
        return (
          (root.textContent ?? '').includes(props.message) ||
          '表示が見つかりません'
        )
      },
    },
  ],
})
