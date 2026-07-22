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

// 検証用コメント。
const SEED = {
  topics: [
    { id: 't-be', name: 'Backend', form_type: FormType.IT, sort_order: 1, is_active: true },
    { id: 't-fe', name: 'Frontend', form_type: FormType.IT, sort_order: 2, is_active: false },
  ],
}

registerUnit<Record<string, never>>({
  id: 'TopicManager',
  title: 'TopicManager',
  description: '検証ケース。',
  kind: 'component',
  render: () => <TopicManager />,
  propsSchema: z.object({}),
  fixtures: [
    {
      id: 'loaded',
      description: 'stub から 2 つの IT topic を load。',
      props: {},
      mocks: { firestore: SEED },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'empty',
      description: 'Collection が空 — empty message。',
      props: {},
      mocks: { firestore: { topics: [] } },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'act-open-create-modal',
      description: 'Act: Add Topic を click → modal が開く。',
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
      description: '検証ケース。',
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
      id: 'probe-missing-sort-order',
      probe: true,
      description: '検証ケース。',
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
      description: '検証ケース。',
      check: ({ contract }) => contract.unit === 'TopicManager' || `contract.unit="${contract.unit}"`,
    },
    {
      id: 'rows-match-store',
      description: '検証ケース。',
      onlyFixtures: ['loaded', 'empty'],
      check: ({ root }) => {
        const rows = tableRows(root)
        const store = collectionDocs('topics').length
        return rows === store || `tableRows=${rows}, store=${store}`
      },
    },
    {
      id: 'empty-message',
      description: '検証ケース。',
      onlyFixtures: ['empty'],
      check: ({ root }) =>
        (root.textContent ?? '').includes('No topics yet.') || '表示が見つかりません',
    },
    {
      id: 'create-modal-opens',
      description: 'Add を click すると modal が開く',
      onlyFixtures: ['act-open-create-modal'],
      check: ({ root, contract }) => {
        if (contract.modalopen !== 'true') return `contract.modalopen="${contract.modalopen}"`
        return modalOpen(root) || 'modal が開いていません'
      },
    },
    {
      id: 'create-persists-with-it-formtype',
      description: '検証ケース。',
      onlyFixtures: ['act-create'],
      check: ({ root }) => {
        const docs = collectionDocs('topics')
        if (docs.length !== 3) return `store=${docs.length}, expected=3`
        const created = docs.find(d => d.name === 'Database')
        if (!created) return '要素が見つかりません'
        if (created.form_type !== FormType.IT) return `form_type=${created.form_type}`
        return !modalOpen(root) || 'Save 後も modal が開いたままです'
      },
    },
    {
      id: 'toggle-flips-active',
      description: '検証ケース。',
      onlyFixtures: ['act-toggle-active'],
      check: () => {
        const doc = collectionDocs('topics').find(d => d.id === 't-be')
        if (!doc) return 'doc が消えています t-be'
        return doc.is_active === false || `is_active=${doc.is_active}`
      },
    },
    {
      id: 'missing-field-graceful',
      description: 'sort_order 不足: row が render され、"undefined" を出さない',
      onlyFixtures: ['probe-missing-sort-order'],
      check: ({ root }) => {
        if (tableRows(root) !== 1) return `tableRows=${tableRows(root)}, expected=1`
        const text = root.textContent ?? ''
        if (!text.includes('Misc')) return '表示が見つかりません'
        return !text.includes('undefined') || '"undefined" が UI に漏れています'
      },
    },
  ],
})
