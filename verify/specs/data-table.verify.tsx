import type { ComponentProps } from 'react'
import { z } from 'zod'
import { DataTable } from '@/components/ui/DataTable'
import { registerUnit } from '@/verify/core/registry'

interface SampleRow {
  id: string
  word: string
  status: string
  [key: string]: unknown
}

type SampleTableProps = ComponentProps<typeof DataTable<SampleRow>>

const sampleRows: SampleRow[] = [
  { id: 'r1', word: 'serendipity', status: 'exported' },
  { id: 'r2', word: '你好', status: 'draft' },
  { id: 'r3', word: 'ありがとう', status: 'ready' },
]

const sampleColumns = [
  { key: 'word', header: 'Word' },
  { key: 'status', header: 'Status' },
]

// 検証用コメント。
const clickSpy = { rows: [] as SampleRow[] }

registerUnit<SampleTableProps>({
  id: 'DataTable',
  title: 'DataTable',
  description: '検証ケース。',
  kind: 'component',
  render: props => <DataTable<SampleRow> {...props} />,
  propsSchema: z.object({
    data: z.array(z.record(z.string(), z.unknown())),
    columns: z.array(
      z.object({
        key: z.string(),
        header: z.string(),
        width: z.string().optional(),
        align: z.enum(['left', 'center', 'right']).optional(),
        render: z.any().optional(),
      })
    ),
    onRowClick: z.any().optional(),
    keyField: z.string().optional(),
    emptyMessage: z.string().optional(),
    className: z.string().optional(),
  }),
  fixtures: [
    {
      id: 'populated',
      description: '検証ケース。',
      props: { data: sampleRows, columns: sampleColumns, keyField: 'id' },
    },
    {
      id: 'empty',
      description: '検証ケース。',
      props: {
        data: [],
        columns: sampleColumns,
        emptyMessage: 'No entries found. Create your first card!',
      },
    },
    {
      id: 'custom-render',
      description: '検証ケース。',
      props: {
        data: sampleRows,
        columns: [
          { key: 'word', header: 'Word' },
          {
            key: 'status',
            header: 'Status',
            render: (value: unknown) => <em data-custom="status">{String(value)}</em>,
          },
        ],
        keyField: 'id',
      },
    },
    {
      id: 'act-row-click',
      description: '検証ケース。',
      props: {
        data: sampleRows,
        columns: sampleColumns,
        keyField: 'id',
        onRowClick: (row: SampleRow) => clickSpy.rows.push(row),
      },
      act: async ctx => {
        clickSpy.rows = []
        await ctx.click('tbody tr')
      },
    },
    {
      id: 'probe-empty-columns',
      probe: true,
      description: '検証ケース。',
      props: { data: sampleRows, columns: [], keyField: 'id' },
    },
  ],
  invariants: [
    {
      id: 'has-at-least-one-column',
      description: '検証ケース。',
      check: ({ root }) => {
        const headers = root.querySelectorAll('thead th').length
        return headers > 0 || '対象がありません'
      },
    },
    {
      id: 'header-count-matches',
      description: 'Số th = columns.length',
      check: ({ root, props }) => {
        const headers = root.querySelectorAll('thead th').length
        return (
          headers === props.columns.length ||
          `th=${headers}, columns=${props.columns.length}`
        )
      },
    },
    {
      id: 'row-count-matches',
      description: '検証ケース。',
      check: ({ root, props }) => {
        const rows = root.querySelectorAll('tbody tr').length
        const expected = props.data.length === 0 ? 1 : props.data.length
        return rows === expected || `tbody tr=${rows}, expected=${expected}`
      },
    },
    {
      id: 'empty-message-iff-no-data',
      description: '検証ケース。',
      check: ({ root, props }) => {
        if (props.data.length > 0) return true
        const msg = props.emptyMessage ?? 'No data'
        return (root.textContent ?? '').includes(msg) || `emptyMessage が見つかりません "${msg}"`
      },
    },
    {
      id: 'custom-render-applied',
      description: '検証ケース。',
      onlyFixtures: ['custom-render'],
      check: ({ root }) => {
        const custom = root.querySelectorAll('[data-custom="status"]').length
        return custom === sampleRows.length || `custom cells=${custom}`
      },
    },
    {
      id: 'row-click-receives-row',
      description: '検証ケース。',
      onlyFixtures: ['act-row-click'],
      check: () =>
        (clickSpy.rows.length === 1 && clickSpy.rows[0]?.id === 'r1') ||
        `rows=${JSON.stringify(clickSpy.rows.map(r => r.id))}`,
    },
  ],
})
