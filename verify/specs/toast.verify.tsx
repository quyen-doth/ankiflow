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
  description: 'Toast thông báo: 4 variant (success/error/warning/info) + icon + message + nút đóng.',
  kind: 'component',
  render: props => <Toast {...props} />,
  propsSchema: z.object({
    variant: z.enum(['success', 'error', 'warning', 'info']),
    message: z.string(),
    onClose: fn<() => void>(),
  }),
  fixtures: [
    { id: 'success', description: 'Variant success.', props: { variant: 'success', message: 'Đã lưu thay đổi', onClose: noop } },
    { id: 'error', description: 'Variant error.', props: { variant: 'error', message: 'Có lỗi xảy ra', onClose: noop } },
    { id: 'warning', description: 'Variant warning.', props: { variant: 'warning', message: 'Chưa đồng bộ Anki', onClose: noop } },
    { id: 'info', description: 'Variant info.', props: { variant: 'info', message: 'Thông tin', onClose: noop } },
    {
      id: 'act-close',
      description: 'Act: click nút đóng → onClose gọi đúng 1 lần.',
      props: { variant: 'success', message: 'x', onClose: recordClose },
      act: async ctx => {
        closeSpy.count = 0
        await ctx.click('button[aria-label="Close notification"]')
      },
    },
    {
      id: 'probe-long-message',
      probe: true,
      description: 'Probe: message dài + variant warning — render không crash, vẫn có nút đóng.',
      props: {
        variant: 'warning',
        message: 'Đã lưu deck, nhưng chưa đồng bộ được Anki (Anki có đang mở không?)',
        onClose: noop,
      },
    },
  ],
  invariants: [
    {
      id: 'shows-message',
      description: 'Hiển thị nội dung message',
      check: ({ root, props }) => (root.textContent ?? '').includes(props.message) || 'không thấy message',
    },
    {
      id: 'variant-contract',
      description: 'contract.variant khớp prop',
      check: ({ contract, props }) => contract.variant === props.variant || `contract.variant="${contract.variant}"`,
    },
    {
      id: 'has-close-button',
      description: 'Có nút đóng (aria-label)',
      check: ({ root }) => !!root.querySelector('button[aria-label="Close notification"]') || '閉じるボタンが見つからない',
    },
    {
      id: 'close-fires-once',
      description: 'Click đóng: onClose gọi đúng 1 lần',
      onlyFixtures: ['act-close'],
      check: () => closeSpy.count === 1 || `count=${closeSpy.count}`,
    },
  ],
})
