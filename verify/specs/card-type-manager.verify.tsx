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
        inherit: true,
        exclude: [],
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
      description: 'Act: mở modal → điền Name → code tự sinh (slugify) → Save → addDoc (form_type enum), bảng +1 row.',
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
      description: 'Act: Language/zh card type は Default と zh profile の custom field を表示する。',
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
      id: 'act-language-switch-keeps-unavailable-field',
      description: 'Act: Chinese から All へ変更すると zh 固有 field を保持したまま警告する。',
      props: {},
      mocks: {
        firestore: {
          card_types: [{
            ...SEED.card_types[0],
            id: 'ct-zh-template',
            name: 'Chinese field template',
            language: LanguageType.CHINESE,
            template: {
              front: ['word'],
              back: ['meaning', 'custom:phon_the'],
            },
          }],
          user_content_types: CUSTOM_CONTENT_TYPES,
        },
      },
      act: async ctx => {
        await ctx.wait(80)
        const edit = ctx.root.querySelector<HTMLButtonElement>('[aria-label="Edit card type Chinese field template"]')
        if (!edit) throw new Error('編集 button が見つからない')
        edit.click()
        await ctx.wait(0)

        const language = ctx.root.querySelector<HTMLSelectElement>('select[aria-label="Language"]')
        if (!language) throw new Error('Language select が見つからない')
        language.value = '__none__'
        language.dispatchEvent(new Event('change', { bubbles: true }))
        await ctx.wait(0)
      },
    },
    {
      id: 'act-content-types-load-failure',
      description: 'Act: Content Type の読み込み失敗時は custom field を保持し、availability 警告を出さない。',
      props: {},
      mocks: {
        firestore: {
          card_types: [{
            ...SEED.card_types[0],
            id: 'ct-load-failure',
            name: 'Content type load failure',
            language: LanguageType.CHINESE,
            template: {
              front: ['word'],
              back: ['meaning', 'custom:phon_the'],
            },
          }],
          user_content_types: CUSTOM_CONTENT_TYPES,
          __verify_failures__: [{
            id: 'fail-content-type-read',
            operation: 'getDocs',
            collection: 'user_content_types',
            message: 'Simulated content type read failure',
          }],
        },
      },
      act: async ctx => {
        await ctx.wait(80)
        const edit = ctx.root.querySelector<HTMLButtonElement>('[aria-label="Edit card type Content type load failure"]')
        if (!edit) throw new Error('編集 button が見つからない')
        edit.click()
        await ctx.wait(0)
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
        const expected = ['custom:phon_the', 'custom:related_words', 'custom:default_note']
        const missing = expected.filter(value => !values.includes(value))
        if (missing.length > 0) return `missing=${missing.join(',')}`
        const forbidden = [
          'custom:word',
          'custom:pinyin',
          'custom:furigana_extra',
          'custom:analogy_vi',
        ].filter(value => values.includes(value))
        if (forbidden.length > 0) return `unexpected=${forbidden.join(',')}`
        const label = options.find(option => option.value === 'custom:phon_the')?.textContent
        if (label !== 'Phon the') return `label=${label}`
        return (root.textContent ?? '').includes("'All' shows Default fields only.")
          || 'language field hint が表示されない'
      },
    },
    {
      id: 'language-switch-warns-without-removing-field',
      description: 'All で利用不可になった zh 固有 field を警告し、template から削除しない',
      onlyFixtures: ['act-language-switch-keeps-unavailable-field'],
      check: ({ root }) => {
        const alert = root.querySelector<HTMLElement>('[role="alert"]')
        const alertText = alert?.textContent ?? ''
        if (!alertText.includes('Unavailable for the current selection: Phon the.')) {
          return `alert="${alertText}"`
        }
        if (!root.querySelector('[aria-label="Remove Phon the"]')) {
          return 'custom:phon_the was removed from the template'
        }

        const select = root.querySelector<HTMLSelectElement>('select[aria-label="Add field to front"]')
        const values = Array.from(select?.options ?? []).map(option => option.value)
        if (!values.includes('custom:default_note')) return 'Default field is missing for All'
        const unavailable = ['custom:phon_the', 'custom:related_words'].filter(value => values.includes(value))
        return unavailable.length === 0 || `language-specific options=${unavailable.join(',')}`
      },
    },
    {
      id: 'load-failure-does-not-claim-field-is-unavailable',
      description: 'Content Type の読み込み失敗を unavailable field と誤表示しない',
      onlyFixtures: ['act-content-types-load-failure'],
      check: ({ root }) => {
        if (root.querySelector('[role="alert"]')) {
          return 'availability alert is visible while content types are unknown'
        }
        return root.querySelector('[aria-label="Remove Phon the"]')
          ? true
          : 'custom:phon_the was removed from the template'
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
