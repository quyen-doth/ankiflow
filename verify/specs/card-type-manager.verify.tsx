import { z } from 'zod'
import { CardTypeManager } from '@/components/admin/CardTypeManager'
import { registerUnit } from '@/verify/core/registry'
import { FormType, LanguageType } from '@/types'
import {
  clickButtonByText,
  collectionDocs,
  modalOpen,
  setFieldValue,
  tableRows,
} from './manager-helpers'

const SEED = {
  card_types: [
    {
      id: 'ct-wm',
      code: 'word_meaning',
      name: 'Word → Meaning',
      form_type: FormType.LANGUAGE,
      language: LanguageType.ENGLISH,
      is_default: true,
      sort_order: 1,
      is_active: true,
    },
    {
      id: 'ct-listen',
      code: 'listening',
      name: 'Listening',
      form_type: FormType.LANGUAGE,
      is_default: false,
      sort_order: 2,
      is_active: false,
    },
  ],
}

registerUnit<Record<string, never>>({
  id: 'CardTypeManager',
  title: 'CardTypeManager',
  description: 'Admin CRUD card types: create cần code + name, lưu form_type enum (vitest-only).',
  kind: 'component',
  render: () => <CardTypeManager />,
  propsSchema: z.object({}),
  fixtures: [
    {
      id: 'loaded',
      description: '2 card type load từ stub, hiển thị badge Default.',
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
      mocks: { firestore: { card_types: [] } },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'act-open-create-modal',
      description: 'Act: click Add Card Type → modal mở.',
      props: {},
      mocks: { firestore: SEED },
      act: async ctx => {
        await ctx.wait(50)
        clickButtonByText(ctx.root, 'Add Card Type')
        await ctx.wait(0)
      },
    },
    {
      id: 'act-create',
      description: 'Act: mở modal → điền Code + Name → Save → addDoc (form_type enum), bảng +1 row.',
      props: {},
      mocks: { firestore: SEED },
      act: async ctx => {
        await ctx.wait(50)
        clickButtonByText(ctx.root, 'Add Card Type')
        await ctx.wait(0)
        setFieldValue(ctx.root, 'Code', 'cloze')
        setFieldValue(ctx.root, 'Name', 'Cloze')
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
      id: 'probe-missing-optional',
      probe: true,
      description: 'Probe: card type thiếu description + language — render row, không crash.',
      props: {},
      mocks: {
        firestore: {
          card_types: [
            {
              id: 'ct-x',
              code: 'basic',
              name: 'Basic',
              form_type: FormType.GENERAL,
              is_default: false,
              sort_order: 1,
              is_active: true,
            },
          ],
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
      description: 'Contract tự định danh CardTypeManager',
      check: ({ contract }) =>
        contract.unit === 'CardTypeManager' || `contract.unit="${contract.unit}"`,
    },
    {
      id: 'rows-match-store',
      description: 'Số row bảng = số doc trong store',
      onlyFixtures: ['loaded', 'empty'],
      check: ({ root }) => {
        const rows = tableRows(root)
        const store = collectionDocs('card_types').length
        return rows === store || `tableRows=${rows}, store=${store}`
      },
    },
    {
      id: 'default-badge-shown',
      description: 'Card type is_default hiển thị badge Default',
      onlyFixtures: ['loaded'],
      check: ({ root }) =>
        (root.textContent ?? '').includes('Default') || 'không thấy badge Default',
    },
    {
      id: 'empty-message',
      description: 'Không có doc: empty message',
      onlyFixtures: ['empty'],
      check: ({ root }) =>
        (root.textContent ?? '').includes('No card types yet.') || 'không thấy empty message',
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
      id: 'create-persists-doc',
      description: 'Save: doc mới có code + name đúng, form_type enum hợp lệ, modal đóng',
      onlyFixtures: ['act-create'],
      check: ({ root }) => {
        const docs = collectionDocs('card_types')
        if (docs.length !== 3) return `store=${docs.length}, expected=3`
        const created = docs.find(d => d.code === 'cloze')
        if (!created) return 'không tìm thấy doc vừa tạo'
        if (created.name !== 'Cloze') return `name=${created.name}`
        if (created.form_type !== FormType.LANGUAGE) return `form_type=${created.form_type}`
        return !modalOpen(root) || 'modal vẫn mở sau Save'
      },
    },
    {
      id: 'toggle-flips-active',
      description: 'Toggle: doc Word → Meaning đảo is_active sang false',
      onlyFixtures: ['act-toggle-active'],
      check: () => {
        const doc = collectionDocs('card_types').find(d => d.id === 'ct-wm')
        if (!doc) return 'mất doc ct-wm'
        return doc.is_active === false || `is_active=${doc.is_active}`
      },
    },
    {
      id: 'missing-optional-graceful',
      description: 'Thiếu description/language: row render, không "undefined"',
      onlyFixtures: ['probe-missing-optional'],
      check: ({ root }) => {
        if (tableRows(root) !== 1) return `tableRows=${tableRows(root)}, expected=1`
        const text = root.textContent ?? ''
        if (!text.includes('Basic')) return 'không thấy name'
        return !text.includes('undefined') || 'leak "undefined" ra UI'
      },
    },
  ],
})
