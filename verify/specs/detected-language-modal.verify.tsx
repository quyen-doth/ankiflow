import type { ComponentProps } from 'react'
import { z } from 'zod'
import { DetectedLanguageModal } from '@/components/create/DetectedLanguageModal'
import { registerUnit } from '@/verify/core/registry'
import { fn } from '@/verify/core/schema-helpers'

type Props = ComponentProps<typeof DetectedLanguageModal>

const detection = { index: 0, code: 'fr', display_name: 'French', confidence: 0.87 }
const confirmSpy = { count: 0 }
const confirm = () => { confirmSpy.count++ }
const noop = () => undefined

registerUnit<Props>({
  id: 'DetectedLanguageModal',
  title: 'DetectedLanguageModal',
  description: 'Hỏi user thêm hoặc bật ngôn ngữ AI vừa nhận diện.',
  kind: 'component',
  allowsEmptyRender: true,
  render: props => <DetectedLanguageModal {...props} />,
  propsSchema: z.object({
    open: z.boolean(),
    detection: z.object({
      index: z.number(),
      code: z.string(),
      display_name: z.string(),
      confidence: z.number(),
    }).nullable(),
    existingDisabled: z.boolean(),
    saving: z.boolean(),
    onConfirm: fn<() => void>(),
    onClose: fn<() => void>(),
  }),
  fixtures: [
    {
      id: 'add-new',
      description: 'Ngôn ngữ chưa tồn tại → Add & use.',
      props: { open: true, detection, existingDisabled: false, saving: false, onConfirm: noop, onClose: noop },
    },
    {
      id: 'enable-existing',
      description: 'Ngôn ngữ có sẵn nhưng disabled → Enable & use.',
      props: { open: true, detection, existingDisabled: true, saving: false, onConfirm: noop, onClose: noop },
    },
    {
      id: 'act-confirm',
      description: 'Act: xác nhận Add & use gọi callback đúng một lần.',
      props: { open: true, detection, existingDisabled: false, saving: false, onConfirm: confirm, onClose: noop },
      act: async ctx => {
        confirmSpy.count = 0
        const button = Array.from(ctx.root.querySelectorAll('button'))
          .find(item => item.textContent?.trim() === 'Add & use')
        if (!button) throw new Error('không tìm thấy Add & use')
        button.click()
        await ctx.wait(16)
      },
    },
    {
      id: 'probe-no-detection',
      probe: true,
      description: 'Probe: detection=null → không render và không crash.',
      props: { open: true, detection: null, existingDisabled: false, saving: false, onConfirm: noop, onClose: noop },
    },
  ],
  invariants: [
    {
      id: 'shows-detection',
      description: 'Hiển thị tên, code và confidence.',
      onlyFixtures: ['add-new', 'enable-existing', 'act-confirm'],
      check: ({ root }) => {
        const text = root.textContent ?? ''
        return (text.includes('French') && text.includes('fr') && text.includes('87%')) || text
      },
    },
    {
      id: 'correct-action',
      description: 'Action thay đổi theo trạng thái đã tồn tại/disabled.',
      onlyFixtures: ['add-new', 'enable-existing'],
      check: ({ root, fixture }) => {
        const expected = fixture.id === 'enable-existing' ? 'Enable & use' : 'Add & use'
        return (root.textContent ?? '').includes(expected) || `thiếu ${expected}`
      },
    },
    {
      id: 'confirm-once',
      description: 'Confirm callback chạy đúng một lần.',
      onlyFixtures: ['act-confirm'],
      check: () => confirmSpy.count === 1 || `count=${confirmSpy.count}`,
    },
  ],
})
