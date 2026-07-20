import type { ComponentProps } from 'react'
import { z } from 'zod'
import { Toggle } from '@/components/ui/Toggle'
import { registerUnit } from '@/verify/core/registry'
import { fn } from '@/verify/core/schema-helpers'

type ToggleProps = ComponentProps<typeof Toggle>

// 検証用コメント。
const changeSpy = { count: 0, lastValue: null as boolean | null }
const recordChange = (checked: boolean) => {
  changeSpy.count++
  changeSpy.lastValue = checked
}
const noop = () => undefined

registerUnit<ToggleProps>({
  id: 'Toggle',
  title: 'Toggle',
  description: 'label、description、disabled を持つ on/off switch。',
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
      description: '検証ケース。',
      props: { checked: false, onChange: noop, label: 'Auto audio' },
    },
    {
      id: 'on',
      description: '検証ケース。',
      props: {
        checked: true,
        onChange: noop,
        label: 'Auto image',
        description: '検証ケース。',
      },
    },
    {
      id: 'disabled',
      description: '検証ケース。',
      props: { checked: false, onChange: noop, label: 'TTS enabled', disabled: true },
    },
    {
      id: 'act-toggle',
      description: '検証ケース。',
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
      description: '検証ケース。',
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
      description: '検証ケース。',
      check: ({ root, props }) => {
        const sw = root.querySelector('[role="switch"]')
        if (!sw) return '対象がありません'
        return (
          sw.getAttribute('aria-checked') === String(props.checked) ||
          `aria-checked="${sw.getAttribute('aria-checked')}", expected=${props.checked}`
        )
      },
    },
    {
      id: 'label-visible',
      description: '検証ケース。',
      check: ({ root, props }) =>
        (root.textContent ?? '').includes(props.label) || `label が見つかりません "${props.label}"`,
    },
    {
      id: 'disabled-attr',
      description: '検証ケース。',
      check: ({ root, props }) => {
        const sw = root.querySelector<HTMLButtonElement>('[role="switch"]')
        if (!sw) return '対象がありません'
        const expected = Boolean(props.disabled)
        return sw.disabled === expected || `disabled=${sw.disabled}, expected=${expected}`
      },
    },
    {
      id: 'change-fires-with-inverted-value',
      description: '検証ケース。',
      onlyFixtures: ['act-toggle'],
      check: () =>
        (changeSpy.count === 1 && changeSpy.lastValue === true) ||
        `count=${changeSpy.count}, lastValue=${changeSpy.lastValue}`,
    },
    {
      id: 'disabled-click-inert',
      description: '検証ケース。',
      onlyFixtures: ['probe-click-disabled'],
      check: () => changeSpy.count === 0 || `呼び出し回数が不正です`,
    },
  ],
})
