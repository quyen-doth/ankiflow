import type { ComponentProps } from 'react'
import { z } from 'zod'
import { Toggle } from '@/components/ui/Toggle'
import { registerUnit } from '@/verify/core/registry'
import { fn } from '@/verify/core/schema-helpers'

type ToggleProps = ComponentProps<typeof Toggle>

// Spy ghi lại onChange — act reset trước khi click
const changeSpy = { count: 0, lastValue: null as boolean | null }
const recordChange = (checked: boolean) => {
  changeSpy.count++
  changeSpy.lastValue = checked
}
const noop = () => undefined

registerUnit<ToggleProps>({
  id: 'Toggle',
  title: 'Toggle',
  description: 'Switch bật/tắt với label, description, disabled.',
  kind: 'component',
  render: props => <Toggle {...props} />,
  propsSchema: z.object({
    checked: z.boolean(),
    onChange: fn<(checked: boolean) => void>(),
    label: z.string(),
    description: z.string().optional(),
    disabled: z.boolean().optional(),
  }),
  fixtures: [
    {
      id: 'off',
      description: 'Trạng thái tắt.',
      props: { checked: false, onChange: noop, label: 'Auto audio' },
    },
    {
      id: 'on',
      description: 'Trạng thái bật, có description.',
      props: {
        checked: true,
        onChange: noop,
        label: 'Auto image',
        description: 'Tự động tìm ảnh Unsplash khi generate.',
      },
    },
    {
      id: 'disabled',
      description: 'Bị disabled.',
      props: { checked: false, onChange: noop, label: 'TTS enabled', disabled: true },
    },
    {
      id: 'act-toggle',
      description: 'Act: click switch → onChange(!checked) gọi 1 lần.',
      props: { checked: false, onChange: recordChange, label: 'Auto audio' },
      act: async ctx => {
        changeSpy.count = 0
        changeSpy.lastValue = null
        await ctx.click('[role="switch"]')
      },
    },
    {
      id: 'probe-click-disabled',
      probe: true,
      description: 'Probe: click khi disabled — onChange KHÔNG được gọi.',
      props: { checked: false, onChange: recordChange, label: 'Locked', disabled: true },
      act: async ctx => {
        changeSpy.count = 0
        await ctx.click('[role="switch"]')
      },
    },
  ],
  invariants: [
    {
      id: 'switch-role-and-state',
      description: 'Có [role=switch] với aria-checked khớp props.checked',
      check: ({ root, props }) => {
        const sw = root.querySelector('[role="switch"]')
        if (!sw) return 'không có role=switch'
        return (
          sw.getAttribute('aria-checked') === String(props.checked) ||
          `aria-checked="${sw.getAttribute('aria-checked')}", expected=${props.checked}`
        )
      },
    },
    {
      id: 'label-visible',
      description: 'Label hiển thị',
      check: ({ root, props }) =>
        (root.textContent ?? '').includes(props.label) || `không thấy label "${props.label}"`,
    },
    {
      id: 'disabled-attr',
      description: 'Switch disabled khi và chỉ khi props.disabled',
      check: ({ root, props }) => {
        const sw = root.querySelector<HTMLButtonElement>('[role="switch"]')
        if (!sw) return 'không có role=switch'
        const expected = Boolean(props.disabled)
        return sw.disabled === expected || `disabled=${sw.disabled}, expected=${expected}`
      },
    },
    {
      id: 'change-fires-with-inverted-value',
      description: 'Click gọi onChange(!checked) đúng 1 lần',
      onlyFixtures: ['act-toggle'],
      check: () =>
        (changeSpy.count === 1 && changeSpy.lastValue === true) ||
        `count=${changeSpy.count}, lastValue=${changeSpy.lastValue}`,
    },
    {
      id: 'disabled-click-inert',
      description: 'Click khi disabled không gọi onChange',
      onlyFixtures: ['probe-click-disabled'],
      check: () => changeSpy.count === 0 || `onChange được gọi ${changeSpy.count} lần`,
    },
  ],
})
