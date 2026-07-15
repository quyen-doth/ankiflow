import type { ComponentProps } from 'react'
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

// Spy cho onDelete — reset trong act
const deleteSpy = { count: 0, lastId: null as string | null }
const recordDelete = (id: string) => {
  deleteSpy.count++
  deleteSpy.lastId = id
}

registerUnit<HistoryTableProps>({
  id: 'HistoryTable',
  title: 'HistoryTable',
  description: 'Bảng lịch sử entries: word/meaning/category/deck/status + view/delete.',
  kind: 'component',
  render: props => <HistoryTable {...props} />,
  propsSchema: z.object({
    data: z.array(z.looseObject({})),
    onDelete: fn<(id: string) => void>().optional(),
  }),
  fixtures: [
    {
      id: 'populated',
      description: '2 entries (1 synced, 1 pending) — đủ word, status badge.',
      props: { data: ENTRIES },
    },
    {
      id: 'empty',
      description: 'Không có entry — hiển thị empty message.',
      props: { data: [] },
    },
    {
      id: 'act-delete',
      description: 'Act: click nút Delete dòng đầu → onDelete nhận đúng id (stopPropagation, không điều hướng).',
      props: { data: ENTRIES, onDelete: recordDelete },
      act: async ctx => {
        deleteSpy.count = 0
        deleteSpy.lastId = null
        await ctx.click('button[title="Delete"]')
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
