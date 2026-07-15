import { useState, type ComponentProps } from 'react'
import { z } from 'zod'
import { BatchItemList } from '@/components/create/BatchItemList'
import { registerUnit } from '@/verify/core/registry'
import { fn } from '@/verify/core/schema-helpers'

type BatchItemListProps = ComponentProps<typeof BatchItemList>

const changeSpy = { count: 0, lastValue: null as string[] | null }
const shortcutSpy = { caught: false, notCancelled: false }

const recordChange = (items: string[]) => {
  changeSpy.count++
  changeSpy.lastValue = items
}
const noop = () => undefined

function resetSpies(): void {
  changeSpy.count = 0
  changeSpy.lastValue = null
  shortcutSpy.caught = false
  shortcutSpy.notCancelled = false
}

function StatefulBatchItemList({ items, onChange, ...props }: BatchItemListProps) {
  const [currentItems, setCurrentItems] = useState(items)
  return (
    <BatchItemList
      {...props}
      items={currentItems}
      onChange={nextItems => {
        setCurrentItems(nextItems)
        onChange(nextItems)
      }}
    />
  )
}

function pressKey(
  root: HTMLElement,
  index: number,
  init: Pick<KeyboardEventInit, 'key' | 'metaKey' | 'ctrlKey'>,
): void {
  const input = root.querySelectorAll<HTMLInputElement>('input')[index]
  if (!input) throw new Error(`không tìm thấy input ${index}`)

  const windowHandler = () => {
    shortcutSpy.caught = true
  }
  window.addEventListener('keydown', windowHandler, { once: true })
  const notCancelled = input.dispatchEvent(new KeyboardEvent('keydown', {
    ...init,
    bubbles: true,
    cancelable: true,
  }))
  shortcutSpy.notCancelled = notCancelled
}

registerUnit<BatchItemListProps>({
  id: 'BatchItemList',
  title: 'BatchItemList',
  description: 'Danh sách nhập batch với shortcut thêm/xóa dòng và Generate.',
  kind: 'component',
  render: props => <StatefulBatchItemList {...props} />,
  propsSchema: z.object({
    items: z.array(z.string()),
    onChange: fn<(items: string[]) => void>(),
    label: z.string(),
    placeholder: z.string().optional(),
    hint: z.string().optional(),
  }),
  fixtures: [
    {
      id: 'configured',
      description: 'Hiển thị một dòng đã nhập và bộ đếm card.',
      props: { items: ['alpha'], onChange: noop, label: 'Vocabulary item' },
    },
    {
      id: 'act-plain-enter',
      description: 'Act: Enter đơn thêm một dòng trống và focus dòng mới.',
      props: { items: ['alpha'], onChange: recordChange, label: 'Vocabulary item' },
      act: async ctx => {
        resetSpies()
        pressKey(ctx.root, 0, { key: 'Enter' })
        await ctx.wait(16)
      },
    },
    {
      id: 'probe-meta-enter',
      probe: true,
      description: 'Probe: Meta+Enter không thêm dòng và event vẫn bubble cho Generate.',
      props: { items: ['alpha'], onChange: recordChange, label: 'Vocabulary item' },
      act: async ctx => {
        resetSpies()
        pressKey(ctx.root, 0, { key: 'Enter', metaKey: true })
        await ctx.wait(16)
      },
    },
    {
      id: 'act-ctrl-enter',
      description: 'Act: Ctrl+Enter không thêm dòng và event vẫn bubble cho Generate.',
      props: { items: ['alpha'], onChange: recordChange, label: 'Vocabulary item' },
      act: async ctx => {
        resetSpies()
        pressKey(ctx.root, 0, { key: 'Enter', ctrlKey: true })
        await ctx.wait(16)
      },
    },
    {
      id: 'act-backspace-empty',
      description: 'Act: Backspace ở dòng trống xóa dòng và focus dòng trước.',
      props: { items: ['alpha', ''], onChange: recordChange, label: 'Vocabulary item' },
      act: async ctx => {
        resetSpies()
        pressKey(ctx.root, 1, { key: 'Backspace' })
        await ctx.wait(16)
      },
    },
  ],
  invariants: [
    {
      id: 'configured-count',
      description: 'Số input và contract count khớp dữ liệu ban đầu.',
      onlyFixtures: ['configured'],
      check: ({ root, contract }) => (
        root.querySelectorAll('input').length === 1 && contract.count === '1'
      ) || `inputs=${root.querySelectorAll('input').length}, count=${contract.count}`,
    },
    {
      id: 'plain-enter-adds-row',
      description: 'Enter đơn thêm đúng một dòng và focus dòng mới.',
      onlyFixtures: ['act-plain-enter'],
      check: ({ root, contract }) => {
        const inputs = root.querySelectorAll<HTMLInputElement>('input')
        return (
          changeSpy.count === 1
          && JSON.stringify(changeSpy.lastValue) === JSON.stringify(['alpha', ''])
          && inputs.length === 2
          && document.activeElement === inputs[1]
          && contract.count === '2'
        ) || `count=${changeSpy.count}, value=${JSON.stringify(changeSpy.lastValue)}, inputs=${inputs.length}`
      },
    },
    {
      id: 'meta-enter-does-not-add',
      description: 'Meta+Enter không thay đổi items và không chặn event bubble.',
      onlyFixtures: ['probe-meta-enter'],
      check: ({ root }) => (
        changeSpy.count === 0
        && root.querySelectorAll('input').length === 1
        && shortcutSpy.caught
        && shortcutSpy.notCancelled
      ) || `count=${changeSpy.count}, caught=${shortcutSpy.caught}, notCancelled=${shortcutSpy.notCancelled}`,
    },
    {
      id: 'ctrl-enter-does-not-add',
      description: 'Ctrl+Enter không thay đổi items và không chặn event bubble.',
      onlyFixtures: ['act-ctrl-enter'],
      check: ({ root }) => (
        changeSpy.count === 0
        && root.querySelectorAll('input').length === 1
        && shortcutSpy.caught
        && shortcutSpy.notCancelled
      ) || `count=${changeSpy.count}, caught=${shortcutSpy.caught}, notCancelled=${shortcutSpy.notCancelled}`,
    },
    {
      id: 'backspace-removes-empty-row',
      description: 'Backspace giữ nguyên hành vi xóa dòng trống và focus dòng trước.',
      onlyFixtures: ['act-backspace-empty'],
      check: ({ root }) => {
        const inputs = root.querySelectorAll<HTMLInputElement>('input')
        return (
          changeSpy.count === 1
          && JSON.stringify(changeSpy.lastValue) === JSON.stringify(['alpha'])
          && inputs.length === 1
          && document.activeElement === inputs[0]
        ) || `count=${changeSpy.count}, value=${JSON.stringify(changeSpy.lastValue)}, inputs=${inputs.length}`
      },
    },
  ],
})
