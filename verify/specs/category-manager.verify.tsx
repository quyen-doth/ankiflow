import { z } from 'zod'
import { CategoryManager } from '@/components/admin/CategoryManager'
import { registerUnit } from '@/verify/core/registry'
import { FormType } from '@/types'
import {
  clickButtonByText,
  collectionDocs,
  modalOpen,
  setFieldValue,
  tableRows,
} from './manager-helpers'

// Seed: 2 category (sort_order đảo để kiểm orderBy), row đầu active
const SEED = {
  categories: [
    { id: 'c-life', name: 'Daily Life', form_type: FormType.LANGUAGE, sort_order: 1, is_active: true },
    { id: 'c-biz', name: 'Business', form_type: FormType.IT, sort_order: 2, is_active: false },
  ],
}

registerUnit<Record<string, never>>({
  id: 'CategoryManager',
  title: 'CategoryManager',
  description: 'Admin CRUD categories: bảng từ Firestore + modal create/edit (vitest-only).',
  kind: 'component',
  render: () => <CategoryManager />,
  propsSchema: z.object({}),
  fixtures: [
    {
      id: 'loaded',
      description: '2 category load từ stub, sort theo sort_order.',
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
      mocks: { firestore: { categories: [] } },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'act-open-create-modal',
      description: 'Act: click Add Category → modal mở.',
      props: {},
      mocks: { firestore: SEED },
      act: async ctx => {
        await ctx.wait(50)
        clickButtonByText(ctx.root, 'Add Category')
        await ctx.wait(0)
      },
    },
    {
      id: 'act-create',
      description: 'Act: mở modal → điền Name → Save → addDoc lưu doc (form_type enum), bảng +1 row, modal đóng.',
      props: {},
      mocks: { firestore: SEED },
      act: async ctx => {
        await ctx.wait(50)
        clickButtonByText(ctx.root, 'Add Category')
        await ctx.wait(0)
        setFieldValue(ctx.root, 'Name', 'Travel')
        clickButtonByText(ctx.root, 'Save')
        await ctx.wait(80)
      },
    },
    {
      id: 'act-toggle-active',
      description: 'Act: click badge trạng thái row đầu (Active) → updateDoc lật is_active.',
      props: {},
      mocks: { firestore: SEED },
      act: async ctx => {
        await ctx.wait(50)
        clickButtonByText(ctx.root, 'Active')
        await ctx.wait(80)
      },
    },
    {
      id: 'probe-unknown-formtype',
      probe: true,
      description: 'Probe: form_type lạ + thiếu sort_order — render raw value, không crash, không "undefined".',
      props: {},
      mocks: {
        firestore: {
          categories: [{ id: 'c-x', name: 'Mystery', form_type: 'form_unknown', is_active: true }],
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
      description: 'Contract tự định danh CategoryManager (qua Card forward props)',
      check: ({ contract }) =>
        contract.unit === 'CategoryManager' || `contract.unit="${contract.unit}"`,
    },
    {
      id: 'rows-match-store',
      description: 'Số row bảng = số doc trong store',
      onlyFixtures: ['loaded', 'empty'],
      check: ({ root }) => {
        const rows = tableRows(root)
        const store = collectionDocs('categories').length
        return rows === store || `tableRows=${rows}, store=${store}`
      },
    },
    {
      id: 'sorted-by-sort-order',
      description: 'Row hiển thị theo thứ tự sort_order',
      onlyFixtures: ['loaded'],
      check: ({ root }) => {
        const text = root.textContent ?? ''
        return (
          text.indexOf('Daily Life') < text.indexOf('Business') ||
          'thứ tự sort_order sai'
        )
      },
    },
    {
      id: 'empty-message',
      description: 'Không có doc: hiển thị empty message',
      onlyFixtures: ['empty'],
      check: ({ root }) =>
        (root.textContent ?? '').includes('No categories yet.') || 'không thấy empty message',
    },
    {
      id: 'modal-closed-initially',
      description: 'Chưa tương tác: modal đóng (contract modalopen=false)',
      onlyFixtures: ['loaded'],
      check: ({ root, contract }) => {
        if (contract.modalopen !== 'false') return `contract.modalopen="${contract.modalopen}"`
        return !modalOpen(root) || 'modal hiện dù chưa mở'
      },
    },
    {
      id: 'create-modal-opens',
      description: 'Click Add: modal mở, contract modalopen=true',
      onlyFixtures: ['act-open-create-modal'],
      check: ({ root, contract }) => {
        if (contract.modalopen !== 'true') return `contract.modalopen="${contract.modalopen}"`
        return modalOpen(root) || 'modal không mở'
      },
    },
    {
      id: 'create-persists-doc',
      description: 'Save: store +1 doc, doc mới có name đúng + form_type là enum hợp lệ, modal đóng',
      onlyFixtures: ['act-create'],
      check: ({ root }) => {
        const docs = collectionDocs('categories')
        if (docs.length !== 3) return `store=${docs.length}, expected=3`
        const created = docs.find(d => d.name === 'Travel')
        if (!created) return 'không tìm thấy doc vừa tạo'
        if (created.form_type !== FormType.LANGUAGE) return `form_type=${created.form_type}`
        return !modalOpen(root) || 'modal vẫn mở sau khi Save'
      },
    },
    {
      id: 'toggle-flips-active',
      description: 'Toggle: doc row đầu (Daily Life) đảo is_active sang false',
      onlyFixtures: ['act-toggle-active'],
      check: () => {
        const doc = collectionDocs('categories').find(d => d.id === 'c-life')
        if (!doc) return 'mất doc c-life'
        return doc.is_active === false || `is_active=${doc.is_active}`
      },
    },
    {
      id: 'unknown-formtype-graceful',
      description: 'form_type lạ: row vẫn render, không "undefined"',
      onlyFixtures: ['probe-unknown-formtype'],
      check: ({ root }) => {
        if (tableRows(root) !== 1) return `tableRows=${tableRows(root)}, expected=1`
        const text = root.textContent ?? ''
        if (!text.includes('Mystery')) return 'không thấy name'
        return !text.includes('undefined') || 'leak "undefined" ra UI'
      },
    },
  ],
})
