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

// Spy ghi lại row được click — act reset trước
const clickSpy = { rows: [] as SampleRow[] }

registerUnit<SampleTableProps>({
  id: 'DataTable',
  title: 'DataTable',
  description: 'Bảng generic: columns + data + empty state + row click.',
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
      description: '3 hàng × 2 cột.',
      props: { data: sampleRows, columns: sampleColumns, keyField: 'id' },
    },
    {
      id: 'empty',
      description: 'Không có dữ liệu → hiện emptyMessage tùy chỉnh.',
      props: {
        data: [],
        columns: sampleColumns,
        emptyMessage: 'No entries found. Create your first card!',
      },
    },
    {
      id: 'custom-render',
      description: 'Cột dùng render function tùy chỉnh.',
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
      description: 'Act: click hàng đầu → onRowClick nhận đúng row.',
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
      description: 'Probe (EXPECTED_FAIL): columns rỗng — bảng không có cột nào.',
      props: { data: sampleRows, columns: [], keyField: 'id' },
    },
  ],
  invariants: [
    {
      id: 'has-at-least-one-column',
      description: 'Bảng phải có ít nhất 1 cột',
      check: ({ root }) => {
        const headers = root.querySelectorAll('thead th').length
        return headers > 0 || 'bảng không có cột nào'
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
      description: 'Số hàng dữ liệu = data.length (hoặc 1 hàng emptyMessage khi rỗng)',
      check: ({ root, props }) => {
        const rows = root.querySelectorAll('tbody tr').length
        const expected = props.data.length === 0 ? 1 : props.data.length
        return rows === expected || `tbody tr=${rows}, expected=${expected}`
      },
    },
    {
      id: 'empty-message-iff-no-data',
      description: 'emptyMessage hiện khi và chỉ khi data rỗng',
      check: ({ root, props }) => {
        if (props.data.length > 0) return true
        const msg = props.emptyMessage ?? 'No data'
        return (root.textContent ?? '').includes(msg) || `không thấy emptyMessage "${msg}"`
      },
    },
    {
      id: 'custom-render-applied',
      description: 'Cột render tùy chỉnh được áp dụng',
      onlyFixtures: ['custom-render'],
      check: ({ root }) => {
        const custom = root.querySelectorAll('[data-custom="status"]').length
        return custom === sampleRows.length || `custom cells=${custom}`
      },
    },
    {
      id: 'row-click-receives-row',
      description: 'Click hàng → onRowClick nhận đúng row object',
      onlyFixtures: ['act-row-click'],
      check: () =>
        (clickSpy.rows.length === 1 && clickSpy.rows[0]?.id === 'r1') ||
        `rows=${JSON.stringify(clickSpy.rows.map(r => r.id))}`,
    },
  ],
})
