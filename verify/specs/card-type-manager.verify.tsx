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

const CUSTOM_CONTENT_TYPES = [
  {
    id: 'language-test-user',
    user_id: 'test-user',
    code: 'language',
    name: 'Language',
    description: '',
    icon: 'Languages',
    fields: [
      { field_key: 'language', label: 'Language', type: 'dropdown', is_required: true, is_session_persistent: true, sort_order: 0, data_source: null },
      { field_key: 'word', label: 'Word', type: 'text', is_required: true, is_session_persistent: false, sort_order: 0 },
    ],
    ai_output_profiles: [
      {
        profile: 'default',
        fields: [
          { key: 'word', type: 'string', instruction: 'Word' },
          { key: 'default_note', type: 'string', instruction: 'Default note' },
        ],
      },
      {
        profile: 'zh',
        fields: [
          { key: 'word', type: 'string', instruction: 'Word' },
          { key: 'pinyin', type: 'string', instruction: 'Pinyin' },
          { key: 'phon_the', type: 'string', instruction: 'Traditional form' },
          { key: 'related_words', type: 'string_array', instruction: 'Related words' },
        ],
      },
      {
        profile: 'ja',
        fields: [
          { key: 'word', type: 'string', instruction: 'Word' },
          { key: 'furigana_extra', type: 'string', instruction: 'Furigana' },
        ],
      },
    ],
    is_active: true,
    sort_order: 1,
  },
  {
    id: 'it-test-user',
    user_id: 'test-user',
    code: 'it',
    name: 'IT Vocabulary',
    description: '',
    icon: 'Code',
    fields: [
      { field_key: 'term', label: 'Term', type: 'text', is_required: true, is_session_persistent: false, sort_order: 0 },
    ],
    ai_output_profiles: [{
      profile: 'default',
      fields: [
        { key: 'term', type: 'string', instruction: 'Term' },
        { key: 'analogy_vi', type: 'string', instruction: 'Analogy' },
      ],
    }],
    is_active: true,
    sort_order: 2,
  },
]

registerUnit<Record<string, never>>({
  id: 'CardTypeManager',
  title: 'CardTypeManager',
  description: '検証ケース。',
  kind: 'component',
  render: () => <CardTypeManager />,
  propsSchema: z.object({}),
  fixtures: [
    {
      id: 'loaded',
      description: '検証ケース。',
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
      description: 'Act: click Add card type → modal mở.',
      props: {},
      mocks: { firestore: SEED },
      act: async ctx => {
        await ctx.wait(50)
        clickButtonByText(ctx.root, 'Add card type')
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
        clickButtonByText(ctx.root, 'Add card type')
        await ctx.wait(0)
        setFieldValue(ctx.root, 'Name', 'Cloze')
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
      id: 'act-reject-invalid-template',
      description: 'Act: malformed custom source を持つ既存 card type は Save できない。',
      props: {},
      mocks: {
        firestore: {
          card_types: [{
            ...SEED.card_types[0],
            id: 'ct-invalid',
            name: 'Invalid template',
            template: { front: ['word'], back: ['custom:UPPER'] },
          }],
        },
      },
      act: async ctx => {
        await ctx.wait(50)
        const edit = ctx.root.querySelector<HTMLButtonElement>('[aria-label="Edit card type Invalid template"]')
        if (!edit) throw new Error('編集 button が見つからない')
        edit.click()
        await ctx.wait(0)
        clickButtonByText(ctx.root, 'Save')
        await ctx.wait(0)
      },
    },
    {
      id: 'act-custom-options-zh',
      description: 'Act: Language/zh card type は zh profile の custom field だけを表示する。',
      props: {},
      mocks: {
        firestore: {
          card_types: [{
            ...SEED.card_types[0],
            id: 'ct-zh',
            name: 'Chinese custom',
            language: LanguageType.CHINESE,
          }],
          user_content_types: CUSTOM_CONTENT_TYPES,
        },
      },
      act: async ctx => {
        await ctx.wait(80)
        const edit = ctx.root.querySelector<HTMLButtonElement>('[aria-label="Edit card type Chinese custom"]')
        if (!edit) throw new Error('編集 button が見つからない')
        edit.click()
        await ctx.wait(0)
      },
    },
    {
      id: 'probe-missing-optional',
      probe: true,
      description: '検証ケース。',
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
      description: '検証ケース。',
      check: ({ contract }) =>
        contract.unit === 'CardTypeManager' || `contract.unit="${contract.unit}"`,
    },
    {
      id: 'rows-match-store',
      description: '検証ケース。',
      onlyFixtures: ['loaded', 'empty'],
      check: ({ root }) => {
        const rows = tableRows(root)
        const store = collectionDocs('card_types').length
        return rows === store || `tableRows=${rows}, store=${store}`
      },
    },
    {
      id: 'default-badge-shown',
      description: '検証ケース。',
      onlyFixtures: ['loaded'],
      check: ({ root }) =>
        (root.textContent ?? '').includes('Default') || '表示が見つかりません',
    },
    {
      id: 'empty-message',
      description: '検証ケース。',
      onlyFixtures: ['empty'],
      check: ({ root }) =>
        (root.textContent ?? '').includes('No card types yet.') || '表示が見つかりません',
    },
    {
      id: 'create-modal-opens',
      description: 'Click Add: modal mở',
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
        const docs = collectionDocs('card_types')
        if (docs.length !== 3) return `store=${docs.length}, expected=3`
        const created = docs.find(d => d.code === 'cloze')
        if (!created) return '要素が見つかりません'
        if (created.name !== 'Cloze') return `name=${created.name}`
        if (created.form_type !== FormType.LANGUAGE) return `form_type=${created.form_type}`
        return !modalOpen(root) || 'modal vẫn mở sau Save'
      },
    },
    {
      id: 'toggle-flips-active',
      description: '検証ケース。',
      onlyFixtures: ['act-toggle-active'],
      check: () => {
        const doc = collectionDocs('card_types').find(d => d.id === 'ct-wm')
        if (!doc) return 'doc が消えています ct-wm'
        return doc.is_active === false || `is_active=${doc.is_active}`
      },
    },
    {
      id: 'invalid-template-save-blocked',
      description: '不正 custom source は editor save validation で拒否される',
      onlyFixtures: ['act-reject-invalid-template'],
      check: ({ root }) => {
        const text = root.textContent ?? ''
        if (!text.includes('Card fields must be supported built-in fields or valid custom fields.')) {
          return 'template validation error が表示されない'
        }
        return modalOpen(root) || '不正 template の Save 後に modal が閉じた'
      },
    },
    {
      id: 'custom-options-match-content-type-and-language',
      description: 'route と zh profile が一致する custom options だけを表示する',
      onlyFixtures: ['act-custom-options-zh'],
      check: ({ root }) => {
        const select = root.querySelector<HTMLSelectElement>('select[aria-label="Add field to back"]')
        const options = Array.from(select?.options ?? [])
        const values = options.map(option => option.value)
        const expected = ['custom:phon_the', 'custom:related_words']
        const missing = expected.filter(value => !values.includes(value))
        if (missing.length > 0) return `missing=${missing.join(',')}`
        const forbidden = [
          'custom:word',
          'custom:pinyin',
          'custom:default_note',
          'custom:furigana_extra',
          'custom:analogy_vi',
        ].filter(value => values.includes(value))
        if (forbidden.length > 0) return `unexpected=${forbidden.join(',')}`
        const label = options.find(option => option.value === 'custom:phon_the')?.textContent
        return label === 'Phon the' || `label=${label}`
      },
    },
    {
      id: 'missing-optional-graceful',
      description: 'description/language 不足: row が render され、"undefined" を出さない',
      onlyFixtures: ['probe-missing-optional'],
      check: ({ root }) => {
        if (tableRows(root) !== 1) return `tableRows=${tableRows(root)}, expected=1`
        const text = root.textContent ?? ''
        if (!text.includes('Basic')) return '表示が見つかりません'
        return !text.includes('undefined') || 'leak "undefined" ra UI'
      },
    },
  ],
})
