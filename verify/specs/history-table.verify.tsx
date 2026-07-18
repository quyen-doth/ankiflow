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
    meaning_vi: 'tình cờ may mắn',
    language: LanguageType.ENGLISH,
    status: 'synced',
  }),
  makeEntry({
    id: 'e2',
    form_type: FormType.IT,
    term: 'Event Loop',
    definition: 'Cơ chế xử lý bất đồng bộ của JS',
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

// Spy cho onDelete — reset trong act
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
  description: 'Bảng lịch sử entries: chọn dòng, word/meaning/deck/status, edit/delete và điều hướng chi tiết.',
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
      description: '2 entries (1 synced, 1 pending) — đủ word, status badge.',
      props: { data: ENTRIES, ...DEFAULT_SELECTION_PROPS },
    },
    {
      id: 'empty',
      description: 'Không có entry — hiển thị empty message.',
      props: { data: [], ...DEFAULT_SELECTION_PROPS },
    },
    {
      id: 'act-delete',
      description: 'Act: click nút Delete dòng đầu → onDelete nhận đúng id (stopPropagation, không điều hướng).',
      props: { data: ENTRIES, ...DEFAULT_SELECTION_PROPS, onDelete: recordDelete },
      act: async ctx => {
        deleteSpy.count = 0
        deleteSpy.lastId = null
        await ctx.click('button[title="Delete"]')
      },
    },
    {
      id: 'partial-selection',
      description: 'Một trong hai dòng được chọn → checkbox header ở trạng thái indeterminate.',
      props: {
        data: ENTRIES,
        ...DEFAULT_SELECTION_PROPS,
        selectedIds: new Set(['e1']),
      },
    },
    {
      id: 'act-toggle-row',
      description: 'Act: chọn checkbox dòng đầu → callback nhận đúng id và không điều hướng.',
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
      description: 'Act: chọn checkbox header → callback toggle-all chạy đúng một lần.',
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
      description: 'Act: click ô Word gọi callback mở chi tiết với đúng entry.',
      props: { data: ENTRIES, ...DEFAULT_SELECTION_PROPS, onOpen: recordOpen },
      act: async ctx => {
        openSpy.count = 0
        openSpy.lastId = null
        await ctx.click('tbody tr:first-child td:nth-child(2)')
      },
    },
    {
      id: 'custom-language',
      description: 'BCP 47 language ngoài defaults hiển thị badge tổng quát và tên fallback.',
      props: {
        data: [makeEntry({
          id: 'e-fr',
          word: 'bonjour',
          meaning_vi: 'xin chào',
          language: 'fr-FR',
        })],
        ...DEFAULT_SELECTION_PROPS,
      },
    },
    {
      id: 'probe-missing-fields',
      probe: true,
      description: 'Probe: entry thiếu word/term/title và created_at — hiển thị "—", không crash.',
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
      description: 'Contract rows của DataTable bên trong = data.length',
      check: ({ root, props }) => {
        const table = root.querySelector('[data-verify-unit="DataTable"]')
        if (!table) return 'không thấy DataTable bên trong'
        const rows = table.getAttribute('data-verify-rows')
        return rows === String(props.data.length) || `rows="${rows}", expected=${props.data.length}`
      },
    },
    {
      id: 'status-badges-correct',
      description: 'Status synced → "Synced", khác → "Pending"',
      onlyFixtures: ['populated'],
      check: ({ root }) => {
        const text = root.textContent ?? ''
        if (!text.includes('Synced')) return 'không thấy badge Synced'
        return text.includes('Pending') || 'không thấy badge Pending'
      },
    },
    {
      id: 'words-rendered',
      description: 'Word/term của entries hiển thị trong bảng',
      onlyFixtures: ['populated'],
      check: ({ root }) => {
        const text = root.textContent ?? ''
        if (!text.includes('serendipity')) return 'không thấy word entry 1'
        return text.includes('Event Loop') || 'không thấy term entry 2'
      },
    },
    {
      id: 'empty-message-shown',
      description: 'Data rỗng: hiển thị empty message',
      onlyFixtures: ['empty'],
      check: ({ root }) =>
        (root.textContent ?? '').includes('No vocabulary cards created yet.') ||
        'không thấy empty message',
    },
    {
      id: 'custom-language-fallback',
      description: 'Ngôn ngữ tùy chỉnh dùng primary subtag cho badge và display name cho tooltip.',
      onlyFixtures: ['custom-language'],
      check: ({ root }) => {
        const badge = Array.from(root.querySelectorAll('[title]'))
          .find(element => element.getAttribute('title') === 'French (France)')
        if (!badge) return 'không thấy display name fallback cho fr-FR'
        return badge.textContent?.trim() === 'FR' || `badge=${badge.textContent}`
      },
    },
    {
      id: 'delete-fires-id-without-nav',
      description: 'Delete gọi onDelete(id) 1 lần, không router.push (vitest)',
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
        return pushes === 0 || `router.push bị gọi ${pushes} lần`
      },
    },
    {
      id: 'selection-checkboxes-reflect-state',
      description: 'Checkbox dòng phản ánh selectedIds và header indeterminate khi chọn một phần.',
      onlyFixtures: ['partial-selection'],
      check: ({ root }) => {
        const first = root.querySelector<HTMLInputElement>('input[aria-label="Select serendipity"]')
        const second = root.querySelector<HTMLInputElement>('input[aria-label="Select Event Loop"]')
        const header = root.querySelector<HTMLInputElement>('input[aria-label="Select all visible cards"]')
        if (!first?.checked || second?.checked) return 'trạng thái checkbox dòng không khớp selectedIds'
        return header?.indeterminate === true || 'checkbox header không indeterminate'
      },
    },
    {
      id: 'toggle-row-fires-id-without-nav',
      description: 'Checkbox dòng gọi onToggleSelect(id) đúng một lần và không điều hướng.',
      onlyFixtures: ['act-toggle-row'],
      check: () => {
        if (toggleSpy.count !== 1 || toggleSpy.lastId !== 'e1') {
          return `count=${toggleSpy.count}, lastId=${toggleSpy.lastId}`
        }
        const g = globalThis as unknown as {
          __verifyNav?: { calls: Array<{ method: string }> }
        }
        const pushes = g.__verifyNav?.calls.filter(call => call.method === 'push').length ?? 0
        if (pushes !== 0) return `router.push bị gọi ${pushes} lần`
        const checkbox = document.querySelector<HTMLInputElement>('input[aria-label="Select serendipity"]')
        return checkbox?.checked === true || 'checkbox dòng không chuyển sang checked'
      },
    },
    {
      id: 'toggle-all-fires-once',
      description: 'Checkbox header gọi onToggleSelectAll đúng một lần.',
      onlyFixtures: ['act-toggle-all'],
      check: ({ root }) => {
        if (toggleAllSpy.count !== 1) return `count=${toggleAllSpy.count}`
        const checkboxes = Array.from(root.querySelectorAll<HTMLInputElement>('tbody input[type="checkbox"]'))
        return checkboxes.every(checkbox => checkbox.checked) || 'không chọn đủ mọi dòng'
      },
    },
    {
      id: 'row-click-still-navigates',
      description: 'Click ô dữ liệu ngoài checkbox gọi onOpen với entry đúng.',
      onlyFixtures: ['act-row-navigation'],
      check: () => openSpy.count === 1 && openSpy.lastId === 'e1'
        || `count=${openSpy.count}, lastId=${openSpy.lastId}`,
    },
    {
      id: 'eye-action-removed',
      description: 'Không còn action View/Eye vì click row đã mở chi tiết.',
      check: ({ root }) => !root.querySelector('button[title="View"]') || 'vẫn còn nút View',
    },
    {
      id: 'missing-fields-placeholder',
      description: 'Entry thiếu field: hiển thị "—", không leak "undefined"',
      onlyFixtures: ['probe-missing-fields'],
      check: ({ root }) => {
        const text = root.textContent ?? ''
        if (!text.includes('—')) return 'không thấy placeholder "—"'
        return !text.includes('undefined') || 'leak chữ "undefined" ra UI'
      },
    },
  ],
})
