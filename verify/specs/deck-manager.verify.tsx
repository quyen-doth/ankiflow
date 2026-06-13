import { z } from 'zod'
import { DeckManager } from '@/components/admin/DeckManager'
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
  decks: [
    {
      id: 'd-en',
      anki_deck_name: 'AnkiFlow::English',
      display_name: 'English Vocab',
      form_type: FormType.LANGUAGE,
      language: LanguageType.ENGLISH,
      sort_order: 1,
      is_active: true,
    },
    {
      id: 'd-it',
      anki_deck_name: 'AnkiFlow::IT',
      display_name: 'IT Terms',
      form_type: FormType.IT,
      sort_order: 2,
      is_active: false,
    },
  ],
}

registerUnit<Record<string, never>>({
  id: 'DeckManager',
  title: 'DeckManager',
  description: 'Admin CRUD decks: create cần cả anki_deck_name + display_name, lưu form_type enum (vitest-only).',
  kind: 'component',
  render: () => <DeckManager />,
  propsSchema: z.object({}),
  fixtures: [
    {
      id: 'loaded',
      description: '2 deck load từ stub, deck không có language hiển thị "—".',
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
      mocks: { firestore: { decks: [] } },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'act-open-create-modal',
      description: 'Act: click Add Deck → modal mở.',
      props: {},
      mocks: { firestore: SEED },
      act: async ctx => {
        await ctx.wait(50)
        clickButtonByText(ctx.root, 'Add Deck')
        await ctx.wait(0)
      },
    },
    {
      id: 'act-create',
      description: 'Act: mở modal → điền Anki Deck Name + Display Name → Save → addDoc (form_type enum, default_card_type_ids=[]).',
      props: {},
      mocks: { firestore: SEED },
      act: async ctx => {
        await ctx.wait(50)
        clickButtonByText(ctx.root, 'Add Deck')
        await ctx.wait(0)
        setFieldValue(ctx.root, 'Anki Deck Name', 'AnkiFlow::Japanese')
        setFieldValue(ctx.root, 'Display Name', 'Japanese Vocab')
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
      id: 'probe-missing-language',
      probe: true,
      description: 'Probe: deck thiếu language — cột Language hiển thị "—", không crash.',
      props: {},
      mocks: {
        firestore: {
          decks: [
            {
              id: 'd-x',
              anki_deck_name: 'AnkiFlow::General',
              display_name: 'General',
              form_type: FormType.GENERAL,
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
      description: 'Contract tự định danh DeckManager',
      check: ({ contract }) => contract.unit === 'DeckManager' || `contract.unit="${contract.unit}"`,
    },
    {
      id: 'rows-match-store',
      description: 'Số row bảng = số doc trong store',
      onlyFixtures: ['loaded', 'empty'],
      check: ({ root }) => {
        const rows = tableRows(root)
        const store = collectionDocs('decks').length
        return rows === store || `tableRows=${rows}, store=${store}`
      },
    },
    {
      id: 'empty-message',
      description: 'Không có doc: empty message',
      onlyFixtures: ['empty'],
      check: ({ root }) =>
        (root.textContent ?? '').includes('No decks yet.') || 'không thấy empty message',
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
      description: 'Save: doc mới đủ trường, form_type enum hợp lệ, default_card_type_ids=[], modal đóng',
      onlyFixtures: ['act-create'],
      check: ({ root }) => {
        const docs = collectionDocs('decks')
        if (docs.length !== 3) return `store=${docs.length}, expected=3`
        const created = docs.find(d => d.display_name === 'Japanese Vocab')
        if (!created) return 'không tìm thấy doc vừa tạo'
        if (created.anki_deck_name !== 'AnkiFlow::Japanese') return `anki_deck_name=${created.anki_deck_name}`
        if (created.form_type !== FormType.LANGUAGE) return `form_type=${created.form_type}`
        if (!Array.isArray(created.default_card_type_ids)) return 'thiếu default_card_type_ids'
        return !modalOpen(root) || 'modal vẫn mở sau Save'
      },
    },
    {
      id: 'toggle-flips-active',
      description: 'Toggle: doc English đảo is_active sang false',
      onlyFixtures: ['act-toggle-active'],
      check: () => {
        const doc = collectionDocs('decks').find(d => d.id === 'd-en')
        if (!doc) return 'mất doc d-en'
        return doc.is_active === false || `is_active=${doc.is_active}`
      },
    },
    {
      id: 'missing-language-graceful',
      description: 'Thiếu language: row render, không "undefined"',
      onlyFixtures: ['probe-missing-language'],
      check: ({ root }) => {
        if (tableRows(root) !== 1) return `tableRows=${tableRows(root)}, expected=1`
        const text = root.textContent ?? ''
        if (!text.includes('General')) return 'không thấy display_name'
        return !text.includes('undefined') || 'leak "undefined" ra UI'
      },
    },
  ],
})
