import type { ComponentProps } from 'react'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { registerUnit } from '@/verify/core/registry'
import { fn, reactNode } from '@/verify/core/schema-helpers'

type ButtonProps = ComponentProps<typeof Button>

// 検証用コメント。
const clickSpy = { count: 0 }

registerUnit<ButtonProps>({
  id: 'Button',
  title: 'Button',
  description: '検証ケース。',
  kind: 'component',
  render: props => <Button {...props} />,
  propsSchema: z.looseObject({
    variant: z.enum(['primary', 'secondary', 'ghost', 'destructive']).optional(),
    size: z.enum(['sm', 'md', 'lg', 'xl']).optional(),
    loading: z.boolean().optional(),
    leftIcon: reactNode().optional(),
    rightIcon: reactNode().optional(),
    children: reactNode(),
    onClick: fn().optional(),
    disabled: z.boolean().optional(),
  }),
  fixtures: [
    {
      id: 'primary-md',
      description: '検証ケース。',
      props: { children: 'Save' },
    },
    {
      id: 'secondary-sm',
      description: 'Variant secondary, size sm.',
      props: { variant: 'secondary', size: 'sm', children: 'Cancel' },
    },
    {
      id: 'loading-state',
      description: '検証ケース。',
      props: { loading: true, children: 'Saving' },
    },
    {
      id: 'disabled-state',
      description: '検証ケース。',
      props: { disabled: true, children: 'Disabled' },
    },
    {
      id: 'with-icons',
      description: '検証ケース。',
      props: {
        leftIcon: <span data-icon="left">L</span>,
        rightIcon: <span data-icon="right">R</span>,
        children: 'Go',
      },
    },
    {
      id: 'probe-click-while-loading',
      probe: true,
      description: '検証ケース。',
      props: {
        loading: true,
        children: 'Submit',
        onClick: () => {
          clickSpy.count++
        },
      },
      act: async ctx => {
        clickSpy.count = 0
        await ctx.click('button')
      },
    },
  ],
  invariants: [
    {
      id: 'is-button-with-name',
      description: '検証ケース。',
      check: ({ root }) => {
        const btn = root.querySelector('button')
        if (!btn) return '対象がありません'
        return (btn.textContent ?? '').trim().length > 0 || '対象がありません'
      },
    },
    {
      id: 'disabled-iff-disabled-or-loading',
      description: '検証ケース。',
      check: ({ root, props }) => {
        const btn = root.querySelector<HTMLButtonElement>('button')
        if (!btn) return '対象がありません'
        const expected = Boolean(props.disabled) || Boolean(props.loading)
        return btn.disabled === expected || `button.disabled=${btn.disabled}, expected=${expected}`
      },
    },
    {
      id: 'spinner-iff-loading',
      description: '検証ケース。',
      check: ({ root, props }) => {
        const spinner = root.querySelector('svg.animate-spin')
        const expected = Boolean(props.loading)
        return !!spinner === expected || `spinner=${!!spinner}, expected=${expected}`
      },
    },
    {
      id: 'icons-rendered',
      description: '検証ケース。',
      onlyFixtures: ['with-icons'],
      check: ({ root }) => {
        const left = root.querySelector('[data-icon="left"]')
        const right = root.querySelector('[data-icon="right"]')
        return (!!left && !!right) || `left=${!!left}, right=${!!right}`
      },
    },
    {
      id: 'click-inert-while-loading',
      description: '検証ケース。',
      onlyFixtures: ['probe-click-while-loading'],
      check: () => clickSpy.count === 0 || `呼び出し回数が不正です`,
    },
  ],
})
