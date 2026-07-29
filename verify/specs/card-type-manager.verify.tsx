import { z } from 'zod'
import { CardTypeManager } from '@/components/admin/CardTypeManager'
import { registerUnit } from '@/verify/core/registry'
import { DEFAULTS_OWNER_ID } from '@/lib/constants'
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
      name: '{study_language} → {output_language}',
      form_type: FormType.LANGUAGE,
      language: 'EN',
      output_language: 'JA',
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

const AI_OUTPUT_LANGUAGES = [
  { code: 'vi', display_name: 'Vietnamese', enabled: true, sort_order: 0 },
  { code: 'ja', display_name: 'Japanese', enabled: true, sort_order: 1 },
]

const INDEPENDENT_OUTPUT_LANGUAGES = [
  { code: 'vi', display_name: 'Vietnamese', enabled: true, sort_order: 0 },
  { code: 'ko', display_name: 'Korean explanations', enabled: true, sort_order: 1 },
]

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

const CONTENT_TYPES_WITH_EXCLUDED_DEFAULT_NOTE = CUSTOM_CONTENT_TYPES.map(contentType => (
  contentType.id === 'language-test-user'
    ? {
        ...contentType,
        ai_output_profiles: contentType.ai_output_profiles?.map(profile => (
          profile.profile === 'zh'
            ? { ...profile, inherit: true as const, exclude: ['default_note'] }
            : profile
        )),
      }
    : contentType
))

interface CardTypeManagerFixtureProps {
  ownerId?: string
}

registerUnit<CardTypeManagerFixtureProps>({
  id: 'CardTypeManager',
  title: 'CardTypeManager',
  description: '検証ケース。',
  kind: 'component',
  render: props => <CardTypeManager {...props} />,
  propsSchema: z.object({
    ownerId: z.string().optional(),
  }),
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
      description: 'Collection が空 — empty message。',
      props: {},
      mocks: { firestore: { card_types: [] } },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'act-open-create-modal',
      description: 'Act: Add card type を click → modal が開く。',
      props: {},
      mocks: {
        firestore: SEED,
        aiOutputLanguages: INDEPENDENT_OUTPUT_LANGUAGES,
        defaultAiOutputLanguage: 'vi',
      },
      act: async ctx => {
        await ctx.wait(50)
        clickButtonByText(ctx.root, 'Add card type')
        await ctx.wait(0)
      },
    },
    {
      id: 'act-create',
      description: 'All scope の新規 Card Type は両言語を null で保存する。',
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
      id: 'act-filter-language-pair',
      description: 'Act: 大文字小文字を正規化して学習言語と出力言語を絞り込む。',
      props: {},
      mocks: { firestore: SEED },
      act: async ctx => {
        await ctx.wait(50)
        const studyLanguage = ctx.root.querySelector<HTMLSelectElement>(
          'select[aria-label="Filter by study language"]',
        )
        if (!studyLanguage) throw new Error('学習言語 filter が見つからない')
        studyLanguage.value = LanguageType.ENGLISH
        studyLanguage.dispatchEvent(new Event('change', { bubbles: true }))
        await ctx.wait(0)

        const outputLanguage = ctx.root.querySelector<HTMLSelectElement>(
          'select[aria-label="Filter by output language"]',
        )
        if (!outputLanguage) throw new Error('出力言語 filter が見つからない')
        outputLanguage.value = LanguageType.JAPANESE
        outputLanguage.dispatchEvent(new Event('change', { bubbles: true }))
        await ctx.wait(0)
      },
    },
    {
      id: 'act-name-placeholders',
      description: 'Act: 言語 placeholder を挿入し、scope に応じた名前を preview する。',
      props: {},
      mocks: {
        firestore: SEED,
        aiOutputLanguages: AI_OUTPUT_LANGUAGES,
        defaultAiOutputLanguage: 'vi',
      },
      act: async ctx => {
        await ctx.wait(50)
        clickButtonByText(ctx.root, 'Add card type')
        await ctx.wait(0)

        const studyLanguage = ctx.root.querySelector<HTMLSelectElement>(
          'select[aria-label="Study language"]',
        )
        const outputLanguage = ctx.root.querySelector<HTMLSelectElement>(
          'select[aria-label="Output language"]',
        )
        if (!studyLanguage || !outputLanguage) {
          throw new Error('Card Type の言語 select が見つからない')
        }
        studyLanguage.value = LanguageType.ENGLISH
        studyLanguage.dispatchEvent(new Event('change', { bubbles: true }))
        outputLanguage.value = LanguageType.JAPANESE
        outputLanguage.dispatchEvent(new Event('change', { bubbles: true }))
        await ctx.wait(0)

        clickButtonByText(ctx.root, 'Insert study language')
        await ctx.wait(0)
        setFieldValue(ctx.root, 'Name', '{study_language} → ')
        await ctx.wait(0)
        clickButtonByText(ctx.root, 'Insert output language')
        await ctx.wait(0)
        clickButtonByText(ctx.root, 'Advanced')
        await ctx.wait(0)
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

        const language = ctx.root.querySelector<HTMLSelectElement>(
          'select[aria-label="Study language"]',
        )
        if (!language) throw new Error('Language select が見つからない')
        language.value = '__none__'
        language.dispatchEvent(new Event('change', { bubbles: true }))
        await ctx.wait(0)
      },
    },
    {
      id: 'act-excluded-template-field',
      description: 'Act: selected profile が除外した custom field の理由と編集 link を表示する。',
      props: {},
      mocks: {
        firestore: {
          card_types: [{
            ...SEED.card_types[0],
            id: 'ct-zh-excluded',
            name: 'Chinese excluded field',
            language: LanguageType.CHINESE,
            template: {
              front: ['word'],
              back: ['meaning', 'custom:default_note'],
            },
          }],
          user_content_types: CONTENT_TYPES_WITH_EXCLUDED_DEFAULT_NOTE,
        },
      },
      act: async ctx => {
        await ctx.wait(80)
        const edit = ctx.root.querySelector<HTMLButtonElement>('[aria-label="Edit card type Chinese excluded field"]')
        if (!edit) throw new Error('編集 button が見つからない')
        edit.click()
        await ctx.wait(0)
      },
    },
    {
      id: 'act-defaults-excluded-template-field',
      description: 'Act: defaults scope の Content Type 編集 link は scope query を保持する。',
      props: { ownerId: DEFAULTS_OWNER_ID },
      mocks: {
        firestore: {
          card_types: [{
            ...SEED.card_types[0],
            id: 'ct-defaults-excluded',
            user_id: DEFAULTS_OWNER_ID,
            name: 'Defaults excluded field',
            language: LanguageType.CHINESE,
            template: {
              front: ['word'],
              back: ['meaning', 'custom:default_note'],
            },
          }],
          content_types: CONTENT_TYPES_WITH_EXCLUDED_DEFAULT_NOTE,
        },
      },
      act: async ctx => {
        await ctx.wait(80)
        const edit = ctx.root.querySelector<HTMLButtonElement>('[aria-label="Edit card type Defaults excluded field"]')
        if (!edit) throw new Error('編集 button が見つからない')
        edit.click()
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
      id: 'table-renders-language-pair',
      description: '一覧に両言語列と scope で解決した動的 Card Type 名を表示する。',
      onlyFixtures: ['loaded'],
      check: ({ root }) => {
        const text = root.textContent ?? ''
        if (!text.includes('Study Lang')) return 'Study Lang 列が見つからない'
        if (!text.includes('Output Lang')) return 'Output Lang 列が見つからない'
        return text.includes('English → Japanese')
          || '動的 Card Type 名が表示されない'
      },
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
        const docs = collectionDocs('card_types')
        if (docs.length !== 3) return `store=${docs.length}, expected=3`
        const created = docs.find(d => d.code === 'cloze')
        if (!created) return '要素が見つかりません'
        if (created.name !== 'Cloze') return `name=${created.name}`
        if (created.form_type !== FormType.LANGUAGE) return `form_type=${created.form_type}`
        if (created.language !== null) return `language=${created.language}`
        if (created.output_language !== null) {
          return `output_language=${created.output_language}`
        }
        return !modalOpen(root) || 'Save 後も modal が開いたままです'
      },
    },
    {
      id: 'language-pair-filter-is-canonical',
      description: 'canonical 化した学習・出力言語 filter の両方に一致する行だけを表示する。',
      onlyFixtures: ['act-filter-language-pair'],
      check: ({ root }) => {
        if (tableRows(root) !== 1) return `tableRows=${tableRows(root)}, expected=1`
        return (root.textContent ?? '').includes('English → Japanese')
          || '対象 Card Type が見つからない'
      },
    },
    {
      id: 'placeholder-controls-render-preview-without-junk-code',
      description: 'placeholder button、動的 preview、空の自動 code を確認する。',
      onlyFixtures: ['act-name-placeholders'],
      check: ({ root }) => {
        const name = root.querySelector<HTMLInputElement>('input[placeholder="e.g. Word → Meaning"]')
        if (name?.value !== '{study_language} → {output_language}') {
          return `name="${name?.value}"`
        }
        const preview = root.querySelector<HTMLElement>(
          '[aria-label="Card type name preview"]',
        )
        if (!preview?.textContent?.includes('English → Japanese')) {
          return `preview="${preview?.textContent}"`
        }
        const codeLabel = Array.from(root.querySelectorAll('label'))
          .find(label => label.textContent?.trim() === 'Code')
        const code = codeLabel?.parentElement?.querySelector<HTMLInputElement>('input')
        return code?.value === '' || `code="${code?.value}"`
      },
    },
    {
      id: 'output-language-editor-offers-current-setting',
      description: '出力言語 editor は現在の AI output language と説明を表示する。',
      onlyFixtures: ['act-open-create-modal'],
      check: ({ root }) => {
        const select = root.querySelector<HTMLSelectElement>(
          'select[aria-label="Output language"]',
        )
        const values = Array.from(select?.options ?? []).map(option => option.value)
        if (!values.includes('vi')) return '現在の AI output language が option にない'
        if (!values.includes('ko')) return 'AI output language list の Korean が option にない'
        if (values.includes('en')) return 'Study Language の English が output option に混入している'
        const text = root.textContent ?? ''
        return text.includes('Leave as All unless the card type only makes sense')
          || 'Output language の hint が見つからない'
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
        if (!alertText.includes(
          '"Phon the" is not defined for the Default profile — add it to Default.',
        )) {
          return `alert="${alertText}"`
        }
        const link = alert?.querySelector<HTMLAnchorElement>(
          'a[aria-label="Edit Content Type for Phon the"]',
        )
        if (link?.getAttribute('href') !== '/admin/content-types/language-test-user') {
          return `href="${link?.getAttribute('href')}"`
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
      id: 'excluded-warning-is-actionable',
      description: 'exclude 理由、matched profile、対象 Content Type link を表示する',
      onlyFixtures: ['act-excluded-template-field'],
      check: ({ root }) => {
        const alert = root.querySelector<HTMLElement>('[role="alert"]')
        const alertText = alert?.textContent ?? ''
        if (!alertText.includes(
          '"Default note" is excluded in the Chinese profile — restore it in Content Type settings.',
        )) {
          return `alert="${alertText}"`
        }
        const link = alert?.querySelector<HTMLAnchorElement>(
          'a[aria-label="Edit Content Type for Default note"]',
        )
        return link?.getAttribute('href') === '/admin/content-types/language-test-user'
          || `href="${link?.getAttribute('href')}"`
      },
    },
    {
      id: 'defaults-warning-keeps-global-scope',
      description: 'defaults warning の link は global Content Type editor を開く',
      onlyFixtures: ['act-defaults-excluded-template-field'],
      check: ({ root }) => {
        const link = root.querySelector<HTMLAnchorElement>(
          'a[aria-label="Edit Content Type for Default note"]',
        )
        return link?.getAttribute('href')
          === '/admin/content-types/language-test-user?scope=global-defaults'
          || `href="${link?.getAttribute('href')}"`
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
      description: 'description/language 不足: row が render され、"undefined" を出さない',
      onlyFixtures: ['probe-missing-optional'],
      check: ({ root }) => {
        if (tableRows(root) !== 1) return `tableRows=${tableRows(root)}, expected=1`
        const text = root.textContent ?? ''
        if (!text.includes('Basic')) return '表示が見つかりません'
        return !text.includes('undefined') || '"undefined" が UI に漏れています'
      },
    },
  ],
})
