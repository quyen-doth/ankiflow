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
  description: '検証ケース。',
  kind: 'component',
  render: () => <DeckManager />,
  propsSchema: z.object({}),
  fixtures: [
    {
      id: 'loaded',
      description: 'stub から 2 deck を load し、language なし deck は "—" を表示する。',
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
      mocks: { firestore: { decks: [] } },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'act-open-create-modal',
      description: 'Act: Add Deck を click → modal が開く。',
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
      description: '検証ケース。',
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
      id: 'probe-missing-language',
      probe: true,
      description: 'Probe: language 不足 deck は Language column に "—" を表示し、crash しない。',
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
      description: '検証ケース。',
      check: ({ contract }) => contract.unit === 'DeckManager' || `contract.unit="${contract.unit}"`,
    },
    {
      id: 'rows-match-store',
      description: '検証ケース。',
      onlyFixtures: ['loaded', 'empty'],
      check: ({ root }) => {
        const rows = tableRows(root)
        const store = collectionDocs('decks').length
        return rows === store || `tableRows=${rows}, store=${store}`
      },
    },
    {
      id: 'empty-message',
      description: '検証ケース。',
      onlyFixtures: ['empty'],
      check: ({ root }) =>
        (root.textContent ?? '').includes('No decks yet.') || '表示が見つかりません',
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
      id: 'create-persists-doc',
      description: '検証ケース。',
      onlyFixtures: ['act-create'],
      check: ({ root }) => {
        const docs = collectionDocs('decks')
        if (docs.length !== 3) return `store=${docs.length}, expected=3`
        const created = docs.find(d => d.display_name === 'Japanese Vocab')
        if (!created) return '要素が見つかりません'
        if (created.anki_deck_name !== 'AnkiFlow::Japanese') return `anki_deck_name=${created.anki_deck_name}`
        if (created.form_type !== FormType.LANGUAGE) return `form_type=${created.form_type}`
        if (!Array.isArray(created.default_card_type_ids)) return '不足しています'
        return !modalOpen(root) || 'Save 後も modal が開いたままです'
      },
    },
    {
      id: 'toggle-flips-active',
      description: '検証ケース。',
      onlyFixtures: ['act-toggle-active'],
      check: () => {
        const doc = collectionDocs('decks').find(d => d.id === 'd-en')
        if (!doc) return 'doc が消えています d-en'
        return doc.is_active === false || `is_active=${doc.is_active}`
      },
    },
    {
      id: 'missing-language-graceful',
      description: 'language 不足: row が render され、"undefined" を出さない',
      onlyFixtures: ['probe-missing-language'],
      check: ({ root }) => {
        if (tableRows(root) !== 1) return `tableRows=${tableRows(root)}, expected=1`
        const text = root.textContent ?? ''
        if (!text.includes('General')) return '表示が見つかりません'
        return !text.includes('undefined') || '"undefined" が UI に漏れています'
      },
    },
  ],
})
