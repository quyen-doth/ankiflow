import type { ComponentProps } from 'react'
import { z } from 'zod'
import { FilterBar } from '@/components/ui/FilterBar'
import { registerUnit } from '@/verify/core/registry'
import { fn } from '@/verify/core/schema-helpers'

type FilterBarProps = ComponentProps<typeof FilterBar>

const spy = {
  searchCalls: [] as string[],
  removedKeys: [] as string[],
  clearAllCount: 0,
}
const reset = () => {
  spy.searchCalls = []
  spy.removedKeys = []
  spy.clearAllCount = 0
}
const noop = () => undefined

registerUnit<FilterBarProps>({
  id: 'FilterBar',
  title: 'FilterBar',
  description: 'Thanh tìm kiếm + chip filter đang áp dụng + clear all.',
  kind: 'component',
  render: props => <FilterBar {...props} />,
  propsSchema: z.object({
    searchPlaceholder: z.string().optional(),
    searchValue: z.string(),
    onSearchChange: fn<(value: string) => void>(),
    filters: z.array(z.any()).optional(),
    activeFilters: z.array(z.object({ key: z.string(), label: z.string() })).optional(),
    onRemoveFilter: fn<(key: string) => void>().optional(),
    onClearAll: fn().optional(),
    onFilterClick: fn().optional(),
  }),
  fixtures: [
    {
      id: 'search-only',
      description: 'Chỉ ô tìm kiếm, không filter.',
      props: { searchValue: '', onSearchChange: noop },
    },
    {
      id: 'with-active-filters',
      description: '2 filter đang áp dụng + nút Clear all.',
      props: {
        searchValue: '',
        onSearchChange: noop,
        activeFilters: [
          { key: 'lang', label: 'English' },
          { key: 'status', label: 'Exported' },
        ],
        onRemoveFilter: noop,
        onClearAll: noop,
      },
    },
    {
      id: 'act-search',
      description: 'Act: gõ từ khóa → onSearchChange nhận giá trị.',
      props: {
        searchValue: '',
        onSearchChange: (value: string) => spy.searchCalls.push(value),
      },
      act: async ctx => {
        reset()
        await ctx.type('input[type="search"]', 'serendipity')
      },
    },
    {
      id: 'act-remove-filter',
      description: 'Act: click remove chip đầu → onRemoveFilter nhận key.',
      props: {
        searchValue: '',
        onSearchChange: noop,
        activeFilters: [{ key: 'lang', label: 'English' }],
        onRemoveFilter: (key: string) => spy.removedKeys.push(key),
        onClearAll: noop,
      },
      act: async ctx => {
        reset()
        await ctx.click('button[aria-label="Remove"]')
      },
    },
    {
      id: 'act-clear-all',
      description: 'Act: click Clear all → onClearAll gọi 1 lần.',
      props: {
        searchValue: '',
        onSearchChange: noop,
        activeFilters: [{ key: 'lang', label: 'English' }],
        onRemoveFilter: noop,
        onClearAll: () => {
          spy.clearAllCount++
        },
      },
      act: async ctx => {
        reset()
        const buttons = Array.from(ctx.root.querySelectorAll<HTMLElement>('button'))
        const clearBtn = buttons.find(b => b.textContent?.trim() === 'Clear all')
        if (!clearBtn) throw new Error('không tìm thấy nút Clear all')
        clearBtn.click()
        await ctx.wait(16)
      },
    },
    {
      id: 'probe-empty-filter-label',
      probe: true,
      description: 'Probe (EXPECTED_FAIL): chip filter có label rỗng — chip mất nhãn.',
      props: {
        searchValue: '',
        onSearchChange: noop,
        activeFilters: [{ key: 'ghost', label: '' }],
        onRemoveFilter: noop,
        onClearAll: noop,
      },
    },
  ],
  invariants: [
    {
      id: 'search-input-present',
      description: 'Có ô input type=search với placeholder',
      check: ({ root }) => {
        const input = root.querySelector<HTMLInputElement>('input[type="search"]')
        if (!input) return 'không có input[type=search]'
        return (input.placeholder ?? '').length > 0 || 'input không có placeholder'
      },
    },
    {
      id: 'chips-match-active-filters',
      description: 'Số chip = activeFilters.length; mỗi chip có nhãn',
      check: ({ root, props }) => {
        const chips = Array.from(root.querySelectorAll('[data-verify-unit="Badge"]'))
        const expected = props.activeFilters?.length ?? 0
        if (chips.length !== expected) return `chips=${chips.length}, expected=${expected}`
        const unlabeled = chips.filter(
          c => !(c.textContent ?? '').replace(/×/g, '').trim()
        )
        return unlabeled.length === 0 || `${unlabeled.length} chip không có nhãn`
      },
    },
    {
      id: 'clear-all-iff-has-filters',
      description: 'Nút Clear all hiện khi và chỉ khi có activeFilters',
      check: ({ root, props }) => {
        const buttons = Array.from(root.querySelectorAll('button'))
        const clearBtn = buttons.find(b => b.textContent?.trim() === 'Clear all')
        const expected = (props.activeFilters?.length ?? 0) > 0
        return !!clearBtn === expected || `clear-all=${!!clearBtn}, expected=${expected}`
      },
    },
    {
      id: 'search-change-receives-value',
      description: 'Gõ từ khóa → onSearchChange nhận đúng giá trị',
      onlyFixtures: ['act-search'],
      check: () =>
        spy.searchCalls.includes('serendipity') ||
        `searchCalls=${JSON.stringify(spy.searchCalls)}`,
    },
    {
      id: 'remove-filter-receives-key',
      description: 'Remove chip → onRemoveFilter nhận đúng key',
      onlyFixtures: ['act-remove-filter'],
      check: () =>
        JSON.stringify(spy.removedKeys) === JSON.stringify(['lang']) ||
        `removedKeys=${JSON.stringify(spy.removedKeys)}`,
    },
    {
      id: 'clear-all-fires-once',
      description: 'Clear all gọi onClearAll đúng 1 lần',
      onlyFixtures: ['act-clear-all'],
      check: () => spy.clearAllCount === 1 || `clearAllCount=${spy.clearAllCount}`,
    },
  ],
})
