import { useState, type ComponentProps } from 'react'
import { z } from 'zod'
import { HistoryTable } from '@/components/history/HistoryTable'
import { registerUnit } from '@/verify/core/registry'
import { fn } from '@/verify/core/schema-helpers'
import { FormType, LanguageType, type Entry, type FirestoreTimestamp } from '@/types'

type HistoryTableProps = ComponentProps<typeof HistoryTable>

function ts(iso: string): FirestoreTimestamp {
  const date = new Date(iso)
  return {
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: 0,
    toDate: () => date,
  }
}

function makeEntry(overrides: Partial<Entry>): Entry {
  return {
    id: 'e0',
    user_id: 'local-user',
    category_id: null,
    form_type: FormType.LANGUAGE,
    anki_deck: 'English Vocab',
    card_type_ids: [],
    tags: [],
    created_at: ts('2026-06-01T10:00:00Z'),
    updated_at: ts('2026-06-01T10:00:00Z'),
    status: 'draft',
    ...overrides,
  }
}

const ENTRIES: Entry[] = [
  makeEntry({
    id: 'e1',
    word: 'serendipity',
    meaning_vi: '幸運な偶然',
    language: LanguageType.ENGLISH,
    status: 'synced',
  }),
  makeEntry({
    id: 'e2',
    form_type: FormType.IT,
    term: 'Event Loop',
    definition: 'JS の非同期処理メカニズム',
    anki_deck: 'IT Terms',
    status: 'draft',
  }),
]

const noop = () => {}
const DEFAULT_SELECTION_PROPS = {
  selectedIds: new Set<string>(),
  onToggleSelect: noop,
  onToggleSelectAll: noop,
}

// onDelete 用 spy — act 内で reset
const deleteSpy = { count: 0, lastId: null as string | null }
const recordDelete = (id: string) => {
  deleteSpy.count++
  deleteSpy.lastId = id
}

const toggleSpy = { count: 0, lastId: null as string | null }
const recordToggle = (id: string) => {
  toggleSpy.count++
  toggleSpy.lastId = id
}

const toggleAllSpy = { count: 0 }
const recordToggleAll = () => {
  toggleAllSpy.count++
}

const openSpy = { count: 0, lastId: null as string | null }
const recordOpen = (entry: Entry) => {
  openSpy.count++
  openSpy.lastId = entry.id ?? null
}

function HistoryTableHarness(props: HistoryTableProps) {
  const [selectedIds, setSelectedIds] = useState(() => new Set(props.selectedIds))

  const handleToggleSelect = (id: string) => {
    setSelectedIds(current => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    props.onToggleSelect(id)
  }

  const handleToggleSelectAll = () => {
    const visibleIds = props.data.flatMap(entry => entry.id ? [entry.id] : [])
    setSelectedIds(current => {
      const next = new Set(current)
      const allSelected = visibleIds.length > 0 && visibleIds.every(id => next.has(id))
      visibleIds.forEach(id => {
        if (allSelected) next.delete(id)
        else next.add(id)
      })
      return next
    })
    props.onToggleSelectAll()
  }

  return (
    <HistoryTable
      {...props}
      selectedIds={selectedIds}
      onToggleSelect={handleToggleSelect}
      onToggleSelectAll={handleToggleSelectAll}
    />
  )
}

registerUnit<HistoryTableProps>({
  id: 'HistoryTable',
  title: 'HistoryTable',
  description: '検証ケース。',
  kind: 'component',
  render: props => <HistoryTableHarness {...props} />,
  propsSchema: z.object({
    data: z.array(z.looseObject({})),
    selectedIds: z.custom<ReadonlySet<string>>(value => value instanceof Set),
    onToggleSelect: fn<(id: string) => void>(),
    onToggleSelectAll: fn<() => void>(),
    onOpen: fn<(entry: Entry) => void>().optional(),
    onDelete: fn<(id: string) => void>().optional(),
  }),
  fixtures: [
    {
      id: 'populated',
      description: '検証ケース。',
      props: { data: ENTRIES, ...DEFAULT_SELECTION_PROPS },
    },
    {
      id: 'empty',
      description: '検証ケース。',
      props: { data: [], ...DEFAULT_SELECTION_PROPS },
    },
    {
      id: 'act-delete',
      description: '検証ケース。',
      props: { data: ENTRIES, ...DEFAULT_SELECTION_PROPS, onDelete: recordDelete },
      act: async ctx => {
        deleteSpy.count = 0
        deleteSpy.lastId = null
        await ctx.click('button[title="Delete"]')
      },
    },
    {
      id: 'partial-selection',
      description: '検証ケース。',
      props: {
        data: ENTRIES,
        ...DEFAULT_SELECTION_PROPS,
        selectedIds: new Set(['e1']),
      },
    },
    {
      id: 'act-toggle-row',
      description: '検証ケース。',
      props: {
        data: ENTRIES,
        ...DEFAULT_SELECTION_PROPS,
        onToggleSelect: recordToggle,
      },
      act: async ctx => {
        toggleSpy.count = 0
        toggleSpy.lastId = null
        await ctx.click('input[aria-label="Select serendipity"]')
      },
    },
    {
      id: 'act-toggle-all',
      description: '検証ケース。',
      props: {
        data: ENTRIES,
        ...DEFAULT_SELECTION_PROPS,
        onToggleSelectAll: recordToggleAll,
      },
      act: async ctx => {
        toggleAllSpy.count = 0
        await ctx.click('input[aria-label="Select all visible cards"]')
      },
    },
    {
      id: 'act-row-navigation',
      description: '検証ケース。',
      props: { data: ENTRIES, ...DEFAULT_SELECTION_PROPS, onOpen: recordOpen },
      act: async ctx => {
        openSpy.count = 0
        openSpy.lastId = null
        await ctx.click('tbody tr:first-child td:nth-child(2)')
      },
    },
    {
      id: 'custom-language',
      description: '検証ケース。',
      props: {
        data: [makeEntry({
          id: 'e-fr',
          word: 'bonjour',
          meaning_vi: 'こんにちは',
          language: 'fr-FR',
        })],
        ...DEFAULT_SELECTION_PROPS,
      },
    },
    {
      id: 'probe-missing-fields',
      probe: true,
      description: 'Probe: word/term/title と created_at が不足する entry は "—" を表示し、crash しない。',
      props: {
        data: [
          makeEntry({ id: 'e3', created_at: undefined as unknown as FirestoreTimestamp }),
        ],
        ...DEFAULT_SELECTION_PROPS,
      },
    },
  ],
  invariants: [
    {
      id: 'row-count-matches-data',
      description: '検証ケース。',
      check: ({ root, props }) => {
        const table = root.querySelector('[data-verify-unit="DataTable"]')
        if (!table) return '表示が見つかりません'
        const rows = table.getAttribute('data-verify-rows')
        return rows === String(props.data.length) || `rows="${rows}", expected=${props.data.length}`
      },
    },
    {
      id: 'status-badges-correct',
      description: 'status synced → "Synced"、それ以外 → "Pending"',
      onlyFixtures: ['populated'],
      check: ({ root }) => {
        const text = root.textContent ?? ''
        if (!text.includes('Synced')) return '表示が見つかりません'
        return text.includes('Pending') || '表示が見つかりません'
      },
    },
    {
      id: 'words-rendered',
      description: '検証ケース。',
      onlyFixtures: ['populated'],
      check: ({ root }) => {
        const text = root.textContent ?? ''
        if (!text.includes('serendipity')) return '表示が見つかりません'
        return text.includes('Event Loop') || '表示が見つかりません'
      },
    },
    {
      id: 'empty-message-shown',
      description: '検証ケース。',
      onlyFixtures: ['empty'],
      check: ({ root }) =>
        (root.textContent ?? '').includes('No vocabulary cards created yet.') ||
        '表示が見つかりません',
    },
    {
      id: 'custom-language-fallback',
      description: '検証ケース。',
      onlyFixtures: ['custom-language'],
      check: ({ root }) => {
        const badge = Array.from(root.querySelectorAll('[title]'))
          .find(element => element.getAttribute('title') === 'French (France)')
        if (!badge) return '表示が見つかりません'
        return badge.textContent?.trim() === 'FR' || `badge=${badge.textContent}`
      },
    },
    {
      id: 'delete-fires-id-without-nav',
      description: '検証ケース。',
      onlyFixtures: ['act-delete'],
      check: () => {
        if (deleteSpy.count !== 1 || deleteSpy.lastId !== 'e1') {
          return `count=${deleteSpy.count}, lastId=${deleteSpy.lastId}`
        }
        const g = globalThis as unknown as {
          __verifyNav?: { calls: Array<{ method: string }> }
        }
        if (!g.__verifyNav) return true
        const pushes = g.__verifyNav.calls.filter(c => c.method === 'push').length
        return pushes === 0 || `router.push が ${pushes} 回呼ばれています`
      },
    },
    {
      id: 'selection-checkboxes-reflect-state',
      description: '検証ケース。',
      onlyFixtures: ['partial-selection'],
      check: ({ root }) => {
        const first = root.querySelector<HTMLInputElement>('input[aria-label="Select serendipity"]')
        const second = root.querySelector<HTMLInputElement>('input[aria-label="Select Event Loop"]')
        const header = root.querySelector<HTMLInputElement>('input[aria-label="Select all visible cards"]')
        if (!first?.checked || second?.checked) return 'row checkbox state が selectedIds と一致しません'
        return header?.indeterminate === true || 'header checkbox が indeterminate ではありません'
      },
    },
    {
      id: 'toggle-row-fires-id-without-nav',
      description: '検証ケース。',
      onlyFixtures: ['act-toggle-row'],
      check: () => {
        if (toggleSpy.count !== 1 || toggleSpy.lastId !== 'e1') {
          return `count=${toggleSpy.count}, lastId=${toggleSpy.lastId}`
        }
        const g = globalThis as unknown as {
          __verifyNav?: { calls: Array<{ method: string }> }
        }
        const pushes = g.__verifyNav?.calls.filter(call => call.method === 'push').length ?? 0
        if (pushes !== 0) return `router.push が ${pushes} 回呼ばれています`
        const checkbox = document.querySelector<HTMLInputElement>('input[aria-label="Select serendipity"]')
        return checkbox?.checked === true || 'row checkbox が checked に変わりません'
      },
    },
    {
      id: 'toggle-all-fires-once',
      description: '検証ケース。',
      onlyFixtures: ['act-toggle-all'],
      check: ({ root }) => {
        if (toggleAllSpy.count !== 1) return `count=${toggleAllSpy.count}`
        const checkboxes = Array.from(root.querySelectorAll<HTMLInputElement>('tbody input[type="checkbox"]'))
        return checkboxes.every(checkbox => checkbox.checked) || 'すべての row が選択されていません'
      },
    },
    {
      id: 'row-click-still-navigates',
      description: '検証ケース。',
      onlyFixtures: ['act-row-navigation'],
      check: () => openSpy.count === 1 && openSpy.lastId === 'e1'
        || `count=${openSpy.count}, lastId=${openSpy.lastId}`,
    },
    {
      id: 'eye-action-removed',
      description: '検証ケース。',
      check: ({ root }) => !root.querySelector('button[title="View"]') || 'button がまだ残っています View',
    },
    {
      id: 'missing-fields-placeholder',
      description: 'field 不足 entry は "—" を表示し、"undefined" を漏らさない',
      onlyFixtures: ['probe-missing-fields'],
      check: ({ root }) => {
        const text = root.textContent ?? ''
        if (!text.includes('—')) return 'placeholder が見つかりません "—"'
        return !text.includes('undefined') || '"undefined" が UI に漏れています'
      },
    },
  ],
})
