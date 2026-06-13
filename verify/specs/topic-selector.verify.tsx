import type { ComponentProps } from 'react'
import { z } from 'zod'
import { TopicSelector } from '@/components/create/TopicSelector'
import { registerUnit } from '@/verify/core/registry'
import { fn } from '@/verify/core/schema-helpers'
import { FormType } from '@/types'

type TopicSelectorProps = ComponentProps<typeof TopicSelector>

// Seed: 2 topic IT active (sort đảo), 1 IT inactive, 1 topic Language phải bị filter
const TOPIC_SEED = {
  topics: [
    { id: 't-fe', name: 'Frontend', form_type: FormType.IT, is_active: true, sort_order: 2 },
    { id: 't-be', name: 'Backend', form_type: FormType.IT, is_active: true, sort_order: 1 },
    { id: 't-old', name: 'Legacy', form_type: FormType.IT, is_active: false, sort_order: 3 },
    { id: 't-lang', name: 'Grammar', form_type: FormType.LANGUAGE, is_active: true, sort_order: 1 },
  ],
}

// Spy cho onChange — reset trong act
const changeSpy = { count: 0, lastValue: null as string[] | null }
const recordChange = (ids: string[]) => {
  changeSpy.count++
  changeSpy.lastValue = ids
}
const noop = () => undefined

function clickTopic(root: HTMLElement, name: string): void {
  const btn = Array.from(root.querySelectorAll('button')).find(b =>
    b.textContent?.trim() === name
  )
  if (!btn) throw new Error(`không tìm thấy topic "${name}"`)
  btn.click()
}

registerUnit<TopicSelectorProps>({
  id: 'TopicSelector',
  title: 'TopicSelector',
  description: 'Chip chọn nhiều topic IT — query form_type=FormType.IT + is_active (vitest-only).',
  kind: 'component',
  render: props => <TopicSelector {...props} />,
  propsSchema: z.object({
    selectedIds: z.array(z.string()),
    onChange: fn<(ids: string[]) => void>(),
  }),
  fixtures: [
    {
      id: 'loaded',
      description: '2 topic IT active, topic inactive/Language bị filter, 1 đang chọn.',
      props: { selectedIds: ['t-be'], onChange: noop },
      mocks: { firestore: TOPIC_SEED },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'empty',
      description: 'Collection rỗng — không chip nào, không crash.',
      props: { selectedIds: [], onChange: noop },
      mocks: { firestore: { topics: [] } },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'act-toggle-on',
      description: 'Act: click topic chưa chọn → onChange thêm id.',
      props: { selectedIds: ['t-be'], onChange: recordChange },
      mocks: { firestore: TOPIC_SEED },
      act: async ctx => {
        await ctx.wait(50)
        changeSpy.count = 0
        changeSpy.lastValue = null
        clickTopic(ctx.root, 'Frontend')
        await ctx.wait(0)
      },
    },
    {
      id: 'act-toggle-off',
      description: 'Act: click topic đang chọn → onChange bỏ id.',
      props: { selectedIds: ['t-be'], onChange: recordChange },
      mocks: { firestore: TOPIC_SEED },
      act: async ctx => {
        await ctx.wait(50)
        changeSpy.count = 0
        changeSpy.lastValue = null
        clickTopic(ctx.root, 'Backend')
        await ctx.wait(0)
      },
    },
    {
      id: 'probe-only-foreign-formtype',
      probe: true,
      description: 'Probe: seed chỉ có topic form_language — tất cả bị filter, 0 chip.',
      props: { selectedIds: [], onChange: noop },
      mocks: {
        firestore: {
          topics: [
            { id: 't1', name: 'Grammar', form_type: FormType.LANGUAGE, is_active: true, sort_order: 1 },
          ],
        },
      },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
  ],
  invariants: [
    {
      id: 'only-active-it-topics',
      description: 'Chỉ topic IT active hiển thị, sort theo sort_order',
      onlyFixtures: ['loaded', 'act-toggle-on', 'act-toggle-off'],
      check: ({ root }) => {
        const names = Array.from(root.querySelectorAll('button')).map(b => b.textContent?.trim())
        return (
          JSON.stringify(names) === JSON.stringify(['Backend', 'Frontend']) ||
          `topics: ${names.join(' | ')}`
        )
      },
    },
    {
      id: 'selected-chip-active-variant',
      description: 'Chip đang chọn dùng Badge variant=active, còn lại neutral',
      onlyFixtures: ['loaded'],
      check: ({ root }) => {
        const active = root.querySelectorAll('[data-verify-unit="Badge"][data-verify-variant="active"]').length
        const neutral = root.querySelectorAll('[data-verify-unit="Badge"][data-verify-variant="neutral"]').length
        return (active === 1 && neutral === 1) || `active=${active}, neutral=${neutral}`
      },
    },
    {
      id: 'empty-no-chips',
      description: 'Không topic: contract count=0, không button',
      onlyFixtures: ['empty', 'probe-only-foreign-formtype'],
      check: ({ root, contract }) => {
        if (contract.count !== '0') return `contract.count="${contract.count}"`
        const buttons = root.querySelectorAll('button').length
        return buttons === 0 || `buttons=${buttons}, expected=0`
      },
    },
    {
      id: 'toggle-on-adds',
      description: 'Click topic chưa chọn: onChange([...selected, id])',
      onlyFixtures: ['act-toggle-on'],
      check: () =>
        (changeSpy.count === 1 &&
          JSON.stringify(changeSpy.lastValue) === JSON.stringify(['t-be', 't-fe'])) ||
        `count=${changeSpy.count}, lastValue=${JSON.stringify(changeSpy.lastValue)}`,
    },
    {
      id: 'toggle-off-removes',
      description: 'Click topic đang chọn: onChange bỏ id',
      onlyFixtures: ['act-toggle-off'],
      check: () =>
        (changeSpy.count === 1 && JSON.stringify(changeSpy.lastValue) === JSON.stringify([])) ||
        `count=${changeSpy.count}, lastValue=${JSON.stringify(changeSpy.lastValue)}`,
    },
  ],
})
