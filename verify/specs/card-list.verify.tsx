import type { ComponentProps } from 'react'
import { z } from 'zod'
import { CardList } from '@/components/preview/CardList'
import { registerUnit } from '@/verify/core/registry'
import { fn } from '@/verify/core/schema-helpers'

type CardListProps = ComponentProps<typeof CardList>

const CARD_TYPES = [
  { id: 'ct-word', name: 'Word → Meaning', description: 'Mặt trước là từ' },
  { id: 'ct-meaning', name: 'Meaning → Word' },
  { id: 'ct-cloze', name: 'Cloze', description: 'Điền vào chỗ trống' },
]

// Spy cho onChange — reset trong act
const changeSpy = { count: 0, lastValue: null as string[] | null }
const recordChange = (ids: string[]) => {
  changeSpy.count++
  changeSpy.lastValue = ids
}
const noop = () => undefined

registerUnit<CardListProps>({
  id: 'CardList',
  title: 'CardList',
  description: 'Danh sách card type dạng Toggle — bật/tắt loại card sẽ generate.',
  kind: 'component',
  render: props => <CardList {...props} />,
  propsSchema: z.object({
    cardTypes: z.array(
      z.object({ id: z.string(), name: z.string(), description: z.string().optional() })
    ),
    selectedIds: z.array(z.string()),
    onChange: fn<(ids: string[]) => void>(),
  }),
  fixtures: [
    {
      id: 'populated',
      description: '3 card types, 1 đang chọn.',
      props: { cardTypes: CARD_TYPES, selectedIds: ['ct-word'], onChange: noop },
    },
    {
      id: 'empty',
      description: 'Không có card type nào — chỉ còn label, không switch.',
      props: { cardTypes: [], selectedIds: [], onChange: noop },
    },
    {
      id: 'act-toggle-on',
      description: 'Act: bật toggle chưa chọn → onChange nhận mảng có thêm id đó.',
      props: { cardTypes: CARD_TYPES, selectedIds: ['ct-word'], onChange: recordChange },
      act: async ctx => {
        changeSpy.count = 0
        changeSpy.lastValue = null
        await ctx.click('[role="switch"][aria-label="Cloze"]')
      },
    },
    {
      id: 'act-toggle-off',
      description: 'Act: tắt toggle đang chọn → onChange nhận mảng không còn id đó.',
      props: { cardTypes: CARD_TYPES, selectedIds: ['ct-word'], onChange: recordChange },
      act: async ctx => {
        changeSpy.count = 0
        changeSpy.lastValue = null
        await ctx.click('[role="switch"][aria-label="Word → Meaning"]')
      },
    },
    {
      id: 'probe-unknown-selected',
      probe: true,
      description: 'Probe: selectedIds chứa id không tồn tại — mọi switch off, không crash.',
      props: { cardTypes: CARD_TYPES, selectedIds: ['ghost-id'], onChange: noop },
    },
  ],
  invariants: [
    {
      id: 'switch-count-matches',
      description: 'Số switch = cardTypes.length, contract count khớp',
      check: ({ root, props, contract }) => {
        const switches = root.querySelectorAll('[role="switch"]').length
        if (switches !== props.cardTypes.length) {
          return `switches=${switches}, cardTypes=${props.cardTypes.length}`
        }
        return contract.count === String(props.cardTypes.length) || `contract.count="${contract.count}"`
      },
    },
    {
      id: 'checked-state-matches-selection',
      description: 'aria-checked của từng switch khớp membership trong selectedIds',
      check: ({ root, props }) => {
        for (const ct of props.cardTypes) {
          const sw = root.querySelector(`[role="switch"][aria-label="${ct.name}"]`)
          if (!sw) return `thiếu switch "${ct.name}"`
          const expected = String(props.selectedIds.includes(ct.id))
          if (sw.getAttribute('aria-checked') !== expected) {
            return `"${ct.name}" aria-checked=${sw.getAttribute('aria-checked')}, expected=${expected}`
          }
        }
        return true
      },
    },
    {
      id: 'toggle-on-adds-id',
      description: 'Bật switch: onChange nhận selectedIds + id mới',
      onlyFixtures: ['act-toggle-on'],
      check: () =>
        (changeSpy.count === 1 &&
          JSON.stringify(changeSpy.lastValue) === JSON.stringify(['ct-word', 'ct-cloze'])) ||
        `count=${changeSpy.count}, lastValue=${JSON.stringify(changeSpy.lastValue)}`,
    },
    {
      id: 'toggle-off-removes-id',
      description: 'Tắt switch: onChange nhận selectedIds bỏ id đó',
      onlyFixtures: ['act-toggle-off'],
      check: () =>
        (changeSpy.count === 1 && JSON.stringify(changeSpy.lastValue) === JSON.stringify([])) ||
        `count=${changeSpy.count}, lastValue=${JSON.stringify(changeSpy.lastValue)}`,
    },
  ],
})
