import type { ComponentProps } from 'react'
import { z } from 'zod'
import { Tabs } from '@/components/ui/Tabs'
import { registerUnit } from '@/verify/core/registry'
import { fn } from '@/verify/core/schema-helpers'

type TabsProps = ComponentProps<typeof Tabs>

// 検証用コメント。
const changeSpy = { count: 0, lastId: '' }
const recordChange = (id: string) => {
  changeSpy.count++
  changeSpy.lastId = id
}
const noop = () => undefined

registerUnit<TabsProps>({
  id: 'Tabs',
  title: 'Tabs',
  description: '検証ケース。',
  kind: 'component',
  render: props => <Tabs {...props} />,
  propsSchema: z.object({
    tabs: z.array(z.object({ id: z.string(), label: z.string() })),
    activeTab: z.string(),
    onChange: fn<(id: string) => void>(),
    className: z.string().optional(),
  }),
  fixtures: [
    {
      id: 'two-first-active',
      description: '検証ケース。',
      props: {
        tabs: [
          { id: 'word-meaning', label: 'Word → Meaning' },
          { id: 'meaning-word', label: 'Meaning → Word' },
        ],
        activeTab: 'word-meaning',
        onChange: noop,
      },
    },
    {
      id: 'three-middle-active',
      description: '3 tab, tab giữa active.',
      props: {
        tabs: [
          { id: 'a', label: 'Word' },
          { id: 'b', label: 'Meaning' },
          { id: 'c', label: 'Sentence' },
        ],
        activeTab: 'b',
        onChange: noop,
      },
    },
    {
      id: 'act-click-second',
      description: '検証ケース。',
      props: {
        tabs: [
          { id: 'a', label: 'Word' },
          { id: 'b', label: 'Meaning' },
        ],
        activeTab: 'a',
        onChange: recordChange,
      },
      act: async ctx => {
        changeSpy.count = 0
        changeSpy.lastId = ''
        await ctx.click('[role="tablist"] button:nth-child(2)')
      },
    },
    {
      id: 'probe-active-not-in-list',
      probe: true,
      description: '検証ケース。',
      props: {
        tabs: [
          { id: 'a', label: 'Word' },
          { id: 'b', label: 'Meaning' },
        ],
        activeTab: 'ghost',
        onChange: noop,
      },
    },
  ],
  invariants: [
    {
      id: 'tablist-structure',
      description: '検証ケース。',
      check: ({ root, props }) => {
        const tablist = root.querySelector('[role="tablist"]')
        if (!tablist) return '対象がありません'
        const tabs = tablist.querySelectorAll('[role="tab"]').length
        return tabs === props.tabs.length || `tab=${tabs}, expected=${props.tabs.length}`
      },
    },
    {
      id: 'exactly-one-selected',
      description: '検証ケース。',
      check: ({ root }) => {
        const selected = root.querySelectorAll('[role="tab"][aria-selected="true"]').length
        return selected === 1 || `${selected} tab が selected です`
      },
    },
    {
      id: 'selected-matches-activeTab',
      description: '検証ケース。',
      check: ({ root, props }) => {
        const selected = root.querySelector('[role="tab"][aria-selected="true"]')
        const expected = props.tabs.find(t => t.id === props.activeTab)
        if (!expected) return `activeTab "${props.activeTab}" tabs list に存在しません`
        if (!selected) return '対象がありません'
        return (
          selected.textContent?.trim() === expected.label ||
          `selected="${selected.textContent?.trim()}", expected="${expected.label}"`
        )
      },
    },
    {
      id: 'change-fires-once-with-id',
      description: '検証ケース。',
      onlyFixtures: ['act-click-second'],
      check: () =>
        (changeSpy.count === 1 && changeSpy.lastId === 'b') ||
        `count=${changeSpy.count}, lastId="${changeSpy.lastId}"`,
    },
  ],
})
