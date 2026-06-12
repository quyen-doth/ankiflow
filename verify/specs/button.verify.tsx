import type { ComponentProps } from 'react'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { registerUnit } from '@/verify/core/registry'
import { fn, reactNode } from '@/verify/core/schema-helpers'

type ButtonProps = ComponentProps<typeof Button>

// Spy đếm onClick — fixture probe xác nhận click bị chặn khi loading
const clickSpy = { count: 0 }

registerUnit<ButtonProps>({
  id: 'Button',
  title: 'Button',
  description: 'Button với variant/size, trạng thái loading/disabled và icon.',
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
      description: 'Mặc định: primary, size md.',
      props: { children: 'Save' },
    },
    {
      id: 'secondary-sm',
      description: 'Variant secondary, size sm.',
      props: { variant: 'secondary', size: 'sm', children: 'Cancel' },
    },
    {
      id: 'loading-state',
      description: 'Đang loading: hiện spinner, disabled.',
      props: { loading: true, children: 'Saving' },
    },
    {
      id: 'disabled-state',
      description: 'Bị disabled qua props.',
      props: { disabled: true, children: 'Disabled' },
    },
    {
      id: 'with-icons',
      description: 'Có leftIcon và rightIcon.',
      props: {
        leftIcon: <span data-icon="left">L</span>,
        rightIcon: <span data-icon="right">R</span>,
        children: 'Go',
      },
    },
    {
      id: 'probe-click-while-loading',
      probe: true,
      description: 'Probe: click khi loading — onClick KHÔNG được gọi.',
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
      description: 'Root là <button> có accessible name',
      check: ({ root }) => {
        const btn = root.querySelector('button')
        if (!btn) return 'không có element <button>'
        return (btn.textContent ?? '').trim().length > 0 || 'button không có tên'
      },
    },
    {
      id: 'disabled-iff-disabled-or-loading',
      description: 'Thuộc tính disabled bật khi và chỉ khi disabled hoặc loading',
      check: ({ root, props }) => {
        const btn = root.querySelector<HTMLButtonElement>('button')
        if (!btn) return 'không có button'
        const expected = Boolean(props.disabled) || Boolean(props.loading)
        return btn.disabled === expected || `button.disabled=${btn.disabled}, expected=${expected}`
      },
    },
    {
      id: 'spinner-iff-loading',
      description: 'Spinner (svg.animate-spin) hiện khi và chỉ khi loading',
      check: ({ root, props }) => {
        const spinner = root.querySelector('svg.animate-spin')
        const expected = Boolean(props.loading)
        return !!spinner === expected || `spinner=${!!spinner}, expected=${expected}`
      },
    },
    {
      id: 'icons-rendered',
      description: 'leftIcon và rightIcon được render khi không loading',
      onlyFixtures: ['with-icons'],
      check: ({ root }) => {
        const left = root.querySelector('[data-icon="left"]')
        const right = root.querySelector('[data-icon="right"]')
        return (!!left && !!right) || `left=${!!left}, right=${!!right}`
      },
    },
    {
      id: 'click-inert-while-loading',
      description: 'Click khi loading không gọi onClick',
      onlyFixtures: ['probe-click-while-loading'],
      check: () => clickSpy.count === 0 || `onClick được gọi ${clickSpy.count} lần`,
    },
  ],
})
