import type { ComponentProps } from 'react'
import { z } from 'zod'
import { Toast } from '@/components/ui/Toast'
import { registerUnit } from '@/verify/core/registry'
import { fn } from '@/verify/core/schema-helpers'

type ToastProps = ComponentProps<typeof Toast>

const closeSpy = { count: 0 }
const recordClose = () => { closeSpy.count++ }
const noop = () => undefined

registerUnit<ToastProps>({
  id: 'Toast',
  title: 'Toast',
  description: '検証ケース。',
  kind: 'component',
  render: props => <Toast {...props} />,
  propsSchema: z.object({
    variant: z.enum(['success', 'error', 'warning', 'info']),
    message: z.string(),
    onClose: fn<() => void>(),
  }),
  fixtures: [
    { id: 'success', description: 'success variant。', props: { variant: 'success', message: '変更を保存しました', onClose: noop } },
    { id: 'error', description: 'error variant。', props: { variant: 'error', message: 'エラーが発生しました', onClose: noop } },
    { id: 'warning', description: 'Variant warning.', props: { variant: 'warning', message: 'Anki 未同期', onClose: noop } },
    { id: 'info', description: 'Variant info.', props: { variant: 'info', message: '情報', onClose: noop } },
    {
      id: 'act-close',
      description: '検証ケース。',
      props: { variant: 'success', message: 'x', onClose: recordClose },
      act: async ctx => {
        closeSpy.count = 0
        await ctx.click('button[aria-label="Close notification"]')
      },
    },
    {
      id: 'probe-long-message',
      probe: true,
      description: '検証ケース。',
      props: {
        variant: 'warning',
        message: 'デッキは保存されましたが、Anki と同期できませんでした (Anki は開いていますか?)',
        onClose: noop,
      },
    },
  ],
  invariants: [
    {
      id: 'shows-message',
      description: '検証ケース。',
      check: ({ root, props }) => (root.textContent ?? '').includes(props.message) || '表示が見つかりません',
    },
    {
      id: 'variant-contract',
      description: 'contract.variant が prop と一致',
      check: ({ contract, props }) => contract.variant === props.variant || `contract.variant="${contract.variant}"`,
    },
    {
      id: 'has-close-button',
      description: '検証ケース。',
      check: ({ root }) => !!root.querySelector('button[aria-label="Close notification"]') || '閉じるボタンが見つからない',
    },
    {
      id: 'close-fires-once',
      description: '検証ケース。',
      onlyFixtures: ['act-close'],
      check: () => closeSpy.count === 1 || `count=${closeSpy.count}`,
    },
  ],
})
