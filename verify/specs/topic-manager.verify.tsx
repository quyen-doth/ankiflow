import { z } from 'zod'
import { TopicManager } from '@/components/admin/TopicManager'
import { registerUnit } from '@/verify/core/registry'
import { FormType } from '@/types'
import {
  clickButtonByText,
  collectionDocs,
  modalOpen,
  setFieldValue,
  tableRows,
} from './manager-helpers'

// Query lọc where form_type == IT — seed toàn topic IT
const SEED = {
  topics: [
    { id: 't-be', name: 'Backend', form_type: FormType.IT, sort_order: 1, is_active: true },
    { id: 't-fe', name: 'Frontend', form_type: FormType.IT, sort_order: 2, is_active: false },
  ],
}

registerUnit<Record<string, never>>({
  id: 'TopicManager',
  title: 'TopicManager',
  description: 'Admin CRUD topics IT: create luôn gán form_type=FormType.IT (vitest-only).',
  kind: 'component',
  render: () => <TopicManager />,
  propsSchema: z.object({}),
  fixtures: [
    {
      id: 'loaded',
      description: '2 topic IT load từ stub.',
      props: {},
      mocks: { firestore: SEED },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'empty',
      description: 'Collection rỗng — empty message.',
      props: {},
      mocks: { firestore: { topics: [] } },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'act-open-create-modal',
      description: 'Act: click Add Topic → modal mở.',
      props: {},
      mocks: { firestore: SEED },
      act: async ctx => {
        await ctx.wait(50)
        clickButtonByText(ctx.root, 'Add Topic')
        await ctx.wait(0)
      },
    },
    {
      id: 'act-create',
      description: 'Act: mở modal → điền Name → Save → addDoc với form_type=IT, bảng +1 row.',
      props: {},
      mocks: { firestore: SEED },
      act: async ctx => {
        await ctx.wait(50)
        clickButtonByText(ctx.root, 'Add Topic')
        await ctx.wait(0)
        setFieldValue(ctx.root, 'Name', 'Database')
        clickButtonByText(ctx.root, 'Save')
        await ctx.wait(80)
      },
    },
    {
      id: 'act-toggle-active',
      description: 'Act: click badge Active row đầu → updateDoc lật is_active.',
      props: {},
      mocks: { firestore: SEED },
      act: async ctx => {
        await ctx.wait(50)
        clickButtonByText(ctx.root, 'Active')
        await ctx.wait(80)
      },
    },
    {
      id: 'probe-missing-sort-order',
      probe: true,
      description: 'Probe: topic thiếu sort_order — vẫn render row, không crash.',
      props: {},
      mocks: {
        firestore: {
          topics: [{ id: 't-x', name: 'Misc', form_type: FormType.IT, is_active: true }],
        },
      },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
  ],
  invariants: [
    {
      id: 'self-identifies',
      description: 'Contract tự định danh TopicManager',
      check: ({ contract }) => contract.unit === 'TopicManager' || `contract.unit="${contract.unit}"`,
    },
    {
      id: 'rows-match-store',
      description: 'Số row bảng = số doc IT trong store',
      onlyFixtures: ['loaded', 'empty'],
      check: ({ root }) => {
        const rows = tableRows(root)
        const store = collectionDocs('topics').length
        return rows === store || `tableRows=${rows}, store=${store}`
      },
    },
    {
      id: 'empty-message',
      description: 'Không có doc: empty message',
      onlyFixtures: ['empty'],
      check: ({ root }) =>
        (root.textContent ?? '').includes('No topics yet.') || 'không thấy empty message',
    },
    {
      id: 'create-modal-opens',
      description: 'Click Add: modal mở',
      onlyFixtures: ['act-open-create-modal'],
      check: ({ root, contract }) => {
        if (contract.modalopen !== 'true') return `contract.modalopen="${contract.modalopen}"`
        return modalOpen(root) || 'modal không mở'
      },
    },
    {
      id: 'create-persists-with-it-formtype',
      description: 'Save: doc mới có name đúng + form_type=FormType.IT, modal đóng',
      onlyFixtures: ['act-create'],
      check: ({ root }) => {
        const docs = collectionDocs('topics')
        if (docs.length !== 3) return `store=${docs.length}, expected=3`
        const created = docs.find(d => d.name === 'Database')
        if (!created) return 'không tìm thấy doc vừa tạo'
        if (created.form_type !== FormType.IT) return `form_type=${created.form_type}`
        return !modalOpen(root) || 'modal vẫn mở sau Save'
      },
    },
    {
      id: 'toggle-flips-active',
      description: 'Toggle: doc Backend đảo is_active sang false',
      onlyFixtures: ['act-toggle-active'],
      check: () => {
        const doc = collectionDocs('topics').find(d => d.id === 't-be')
        if (!doc) return 'mất doc t-be'
        return doc.is_active === false || `is_active=${doc.is_active}`
      },
    },
    {
      id: 'missing-field-graceful',
      description: 'Thiếu sort_order: row vẫn render, không "undefined"',
      onlyFixtures: ['probe-missing-sort-order'],
      check: ({ root }) => {
        if (tableRows(root) !== 1) return `tableRows=${tableRows(root)}, expected=1`
        const text = root.textContent ?? ''
        if (!text.includes('Misc')) return 'không thấy name'
        return !text.includes('undefined') || 'leak "undefined" ra UI'
      },
    },
  ],
})
