import type { ComponentProps } from 'react'
import { z } from 'zod'
import { Tabs } from '@/components/ui/Tabs'
import { registerUnit } from '@/verify/core/registry'
import { fn } from '@/verify/core/schema-helpers'

type TabsProps = ComponentProps<typeof Tabs>

// Spy ghi lại lời gọi onChange — act reset trước khi click
const changeSpy = { count: 0, lastId: '' }
const recordChange = (id: string) => {
  changeSpy.count++
  changeSpy.lastId = id
}
const noop = () => undefined

registerUnit<TabsProps>({
  id: 'Tabs',
  title: 'Tabs',
  description: 'Tab navigation với role=tablist/tab và aria-selected.',
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
      description: '2 tab, tab đầu active.',
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
      description: 'Act: click tab thứ 2 → onChange nhận đúng id, gọi 1 lần.',
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
      description: 'Probe (EXPECTED_FAIL): activeTab không tồn tại — không tab nào selected.',
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
      description: 'Có [role=tablist] chứa đúng tabs.length [role=tab]',
      check: ({ root, props }) => {
        const tablist = root.querySelector('[role="tablist"]')
        if (!tablist) return 'không có role=tablist'
        const tabs = tablist.querySelectorAll('[role="tab"]').length
        return tabs === props.tabs.length || `tab=${tabs}, expected=${props.tabs.length}`
      },
    },
    {
      id: 'exactly-one-selected',
      description: 'Đúng 1 tab có aria-selected=true',
      check: ({ root }) => {
        const selected = root.querySelectorAll('[role="tab"][aria-selected="true"]').length
        return selected === 1 || `${selected} tab được selected`
      },
    },
    {
      id: 'selected-matches-activeTab',
      description: 'Tab được selected là tab có id = activeTab',
      check: ({ root, props }) => {
        const selected = root.querySelector('[role="tab"][aria-selected="true"]')
        const expected = props.tabs.find(t => t.id === props.activeTab)
        if (!expected) return `activeTab "${props.activeTab}" không có trong danh sách tabs`
        if (!selected) return 'không có tab nào selected'
        return (
          selected.textContent?.trim() === expected.label ||
          `selected="${selected.textContent?.trim()}", expected="${expected.label}"`
        )
      },
    },
    {
      id: 'change-fires-once-with-id',
      description: 'Click tab gọi onChange đúng 1 lần với đúng id',
      onlyFixtures: ['act-click-second'],
      check: () =>
        (changeSpy.count === 1 && changeSpy.lastId === 'b') ||
        `count=${changeSpy.count}, lastId="${changeSpy.lastId}"`,
    },
  ],
})
