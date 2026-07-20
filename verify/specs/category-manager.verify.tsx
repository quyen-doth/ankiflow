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

// 検証用コメント。
const SEED = {
  categories: [
    { id: 'c-life', name: 'Daily Life', form_type: FormType.LANGUAGE, sort_order: 1, is_active: true },
    { id: 'c-biz', name: 'Business', form_type: FormType.IT, sort_order: 2, is_active: false },
  ],
}

registerUnit<Record<string, never>>({
  id: 'CategoryManager',
  title: 'CategoryManager',
  description: '検証ケース。',
  kind: 'component',
  render: () => <CategoryManager />,
  propsSchema: z.object({}),
  fixtures: [
    {
      id: 'loaded',
      description: 'stub から 2 category を load し、sort_order で sort。',
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
      description: '検証ケース。',
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
      description: '検証ケース。',
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
      description: 'Probe: unknown form_type + sort_order 不足 — raw value を render し、crash せず、"undefined" を出さない。',
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
      description: '検証ケース。',
      check: ({ contract }) =>
        contract.unit === 'CategoryManager' || `contract.unit="${contract.unit}"`,
    },
    {
      id: 'rows-match-store',
      description: '検証ケース。',
      onlyFixtures: ['loaded', 'empty'],
      check: ({ root }) => {
        const rows = tableRows(root)
        const store = collectionDocs('categories').length
        return rows === store || `tableRows=${rows}, store=${store}`
      },
    },
    {
      id: 'sorted-by-sort-order',
      description: '検証ケース。',
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
      description: '検証ケース。',
      onlyFixtures: ['empty'],
      check: ({ root }) =>
        (root.textContent ?? '').includes('No categories yet.') || '表示が見つかりません',
    },
    {
      id: 'modal-closed-initially',
      description: '検証ケース。',
      onlyFixtures: ['loaded'],
      check: ({ root, contract }) => {
        if (contract.modalopen !== 'false') return `contract.modalopen="${contract.modalopen}"`
        return !modalOpen(root) || 'まだ開いていないのに modal が表示されています'
      },
    },
    {
      id: 'create-modal-opens',
      description: 'Click Add: modal mở, contract modalopen=true',
      onlyFixtures: ['act-open-create-modal'],
      check: ({ root, contract }) => {
        if (contract.modalopen !== 'true') return `contract.modalopen="${contract.modalopen}"`
        return modalOpen(root) || 'modal が開いていません'
      },
    },
    {
      id: 'create-persists-doc',
      description: '検証ケース。',
      onlyFixtures: ['act-create'],
      check: ({ root }) => {
        const docs = collectionDocs('categories')
        if (docs.length !== 3) return `store=${docs.length}, expected=3`
        const created = docs.find(d => d.name === 'Travel')
        if (!created) return '要素が見つかりません'
        if (created.form_type !== FormType.LANGUAGE) return `form_type=${created.form_type}`
        return !modalOpen(root) || 'modal vẫn mở sau khi Save'
      },
    },
    {
      id: 'toggle-flips-active',
      description: '検証ケース。',
      onlyFixtures: ['act-toggle-active'],
      check: () => {
        const doc = collectionDocs('categories').find(d => d.id === 'c-life')
        if (!doc) return 'doc が消えています c-life'
        return doc.is_active === false || `is_active=${doc.is_active}`
      },
    },
    {
      id: 'unknown-formtype-graceful',
      description: 'unknown form_type: row が render され、"undefined" を出さない',
      onlyFixtures: ['probe-unknown-formtype'],
      check: ({ root }) => {
        if (tableRows(root) !== 1) return `tableRows=${tableRows(root)}, expected=1`
        const text = root.textContent ?? ''
        if (!text.includes('Mystery')) return '表示が見つかりません'
        return !text.includes('undefined') || 'leak "undefined" ra UI'
      },
    },
  ],
})
