import { useState, type ComponentProps } from 'react'
import { z } from 'zod'
import { CardTypeSelector } from '@/components/create/CardTypeSelector'
import { filterCardTypesByScope } from '@/lib/cardTypeFilter'
import { renderCardTypeName } from '@/lib/cardTypeName'
import { verifyAttrs } from '@/verify/core/contract'
import { registerUnit } from '@/verify/core/registry'
import { fn } from '@/verify/core/schema-helpers'
import { FormType, LanguageType } from '@/types'
import type { LanguageCode, StudyLanguage } from '@/types'

type CardTypeSelectorProps = ComponentProps<typeof CardTypeSelector>

// 検証用コメント。
const STUDY_LANGUAGES: StudyLanguage[] = [
  { code: 'en', display_name: 'English', enabled: true, sort_order: 0 },
  { code: 'ja', display_name: 'Japanese', enabled: true, sort_order: 1 },
  { code: 'zh', display_name: 'Chinese', enabled: true, sort_order: 2 },
  { code: 'vi', display_name: 'Vietnamese', enabled: true, sort_order: 3 },
]

const CARD_TYPE_SEED = {
  card_types: [
    { id: 'ct-en', name: '{study_language} → {output_language}', form_type: FormType.LANGUAGE, language: LanguageType.ENGLISH, output_language: 'vi', is_active: true, sort_order: 1 },
    { id: 'ct-en-ja', name: 'Japanese output', form_type: FormType.LANGUAGE, language: LanguageType.ENGLISH, output_language: 'ja', is_active: true, sort_order: 2 },
    { id: 'ct-any', name: 'Listening', form_type: FormType.LANGUAGE, language: null, output_language: null, is_active: true, sort_order: 3 },
    { id: 'ct-zh', name: 'ZH Tones', form_type: FormType.LANGUAGE, language: LanguageType.CHINESE, output_language: 'vi', is_active: true, sort_order: 4 },
    { id: 'ct-zh-tw', name: 'Traditional only', form_type: FormType.LANGUAGE, language: 'zh-TW', output_language: 'vi', is_active: true, sort_order: 5 },
    { id: 'ct-zh-cn', name: 'Simplified only', form_type: FormType.LANGUAGE, language: 'zh-CN', output_language: 'vi', is_active: true, sort_order: 6 },
    { id: 'ct-it', name: 'IT Concept', form_type: FormType.IT, language: null, is_active: true, sort_order: 1 },
    { id: 'ct-old', name: 'Old Card', form_type: FormType.LANGUAGE, language: null, is_active: false, sort_order: 7 },
  ],
}

const FALLBACK_SEED = {
  card_types: [
    { id: 'ct-mismatch', name: 'Mismatch', form_type: FormType.LANGUAGE, language: 'zh', output_language: 'ja', is_active: true, is_default: false, sort_order: 2 },
    { id: 'ct-default', name: 'Default fallback', form_type: FormType.LANGUAGE, language: 'ko', output_language: 'fr', is_active: true, is_default: true, sort_order: 1 },
    { id: 'ct-inactive-default', name: 'Inactive fallback', form_type: FormType.LANGUAGE, language: 'ko', output_language: 'fr', is_active: false, is_default: true, sort_order: 0 },
  ],
}

const LANGUAGE_PAIR_FLOW_SEED = {
  card_types: [
    {
      id: 'ct-zh-vi',
      name: '{output_language} → {study_language}',
      form_type: FormType.LANGUAGE,
      language: LanguageType.CHINESE,
      output_language: 'vi',
      is_active: true,
      sort_order: 1,
    },
    {
      id: 'ct-zh-ja',
      name: '{output_language} → {study_language}',
      form_type: FormType.LANGUAGE,
      language: LanguageType.CHINESE,
      output_language: LanguageType.JAPANESE,
      is_active: true,
      sort_order: 2,
    },
    {
      id: 'ct-pair-all',
      name: 'Listening',
      form_type: FormType.LANGUAGE,
      language: LanguageType.CHINESE,
      output_language: null,
      is_active: true,
      sort_order: 3,
    },
  ],
}

// onChange 用 spy — act 内で reset
const changeSpy = { count: 0, lastValue: null as string[] | null }
const recordChange = (ids: string[]) => {
  changeSpy.count++
  changeSpy.lastValue = ids
}
const noop = () => undefined

// Chip buttons render an icon (svg) + name span; the All/Clear links have no svg.
function chipButtons(root: HTMLElement): HTMLButtonElement[] {
  return Array.from(root.querySelectorAll('button')).filter(b => b.querySelector('svg'))
}

function isChecked(btn: HTMLButtonElement): boolean {
  return btn.className.includes('rgba(49,99,66,0.07)')
}

// Click a header link (All / Clear) — a button with no svg matching exact text.
function clickLinkByText(root: HTMLElement, text: string): void {
  const btn = Array.from(root.querySelectorAll('button')).find(
    b => !b.querySelector('svg') && b.textContent?.trim() === text
  )
  if (!btn) throw new Error(`link が見つかりません "${text}"`)
  btn.click()
}

function visibleNames(root: HTMLElement): string[] {
  return chipButtons(root).map(b => b.querySelector('span')?.textContent?.trim() ?? '')
}

function flowVisibleNames(root: HTMLElement): string[] {
  return Array.from(root.querySelectorAll('[data-pair-card-type]'))
    .map(element => element.textContent?.trim() ?? '')
}

function CardTypeLanguagePairFlow() {
  const [outputLanguage, setOutputLanguage] = useState<LanguageCode>('vi')
  const cardTypes = filterCardTypesByScope(LANGUAGE_PAIR_FLOW_SEED.card_types, {
    studyLanguage: LanguageType.CHINESE,
    outputLanguage,
  })

  return (
    <div {...verifyAttrs({
      unit: 'CardTypeLanguagePairFlow',
      outputLanguage,
      count: cardTypes.length,
    })}>
      <fieldset className="mb-4">
        <legend>AI output language</legend>
        <button
          type="button"
          aria-pressed={outputLanguage === 'vi'}
          onClick={() => setOutputLanguage('vi')}
        >
          Vietnamese
        </button>
        <button
          type="button"
          aria-pressed={outputLanguage === LanguageType.JAPANESE}
          onClick={() => setOutputLanguage(LanguageType.JAPANESE)}
        >
          Japanese
        </button>
      </fieldset>
      <div aria-label="Create card types">
        {cardTypes.map(cardType => (
          <button key={cardType.id} type="button" data-pair-card-type>
            {renderCardTypeName(cardType.name, {
              studyLanguage: LanguageType.CHINESE,
              outputLanguage,
              cardType,
              languages: STUDY_LANGUAGES,
            })}
          </button>
        ))}
      </div>
    </div>
  )
}

registerUnit<CardTypeSelectorProps>({
  id: 'CardTypeSelector',
  title: 'CardTypeSelector',
  description:
    'Card Type を学習・出力言語 pair で厳密に filter し、動的 name と selection prune を検証する。',
  kind: 'component',
  render: props => <CardTypeSelector {...props} />,
  propsSchema: z.object({
    formType: z.string().optional(),
    language: z.string().optional(),
    outputLanguage: z.string().optional(),
    languages: z.array(z.object({
      code: z.string(),
      display_name: z.string(),
      enabled: z.boolean(),
      sort_order: z.number(),
    })),
    selectedIds: z.array(z.string()),
    onChange: fn<(ids: string[]) => void>(),
  }),
  fixtures: [
    {
      id: 'loaded-language-en',
      description: '検証ケース。',
      props: { formType: 'Language', language: LanguageType.ENGLISH, outputLanguage: 'vi', languages: STUDY_LANGUAGES, selectedIds: ['ct-en'], onChange: noop },
      mocks: { firestore: CARD_TYPE_SEED },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'act-toggle',
      description: '検証ケース。',
      props: { formType: 'Language', language: LanguageType.ENGLISH, outputLanguage: 'vi', languages: STUDY_LANGUAGES, selectedIds: ['ct-en'], onChange: recordChange },
      mocks: { firestore: CARD_TYPE_SEED },
      act: async ctx => {
        await ctx.wait(50)
        changeSpy.count = 0
        changeSpy.lastValue = null
        const unchecked = chipButtons(ctx.root).find(b => !isChecked(b))
        if (!unchecked) throw new Error('対象がありません')
        unchecked.click()
        await ctx.wait(0)
      },
    },
    {
      id: 'act-select-all',
      description: '検証ケース。',
      props: { formType: 'Language', language: LanguageType.ENGLISH, outputLanguage: 'vi', languages: STUDY_LANGUAGES, selectedIds: [], onChange: recordChange },
      mocks: { firestore: CARD_TYPE_SEED },
      act: async ctx => {
        await ctx.wait(50)
        changeSpy.count = 0
        changeSpy.lastValue = null
        clickLinkByText(ctx.root, 'All')
        await ctx.wait(0)
      },
    },
    {
      id: 'act-clear',
      description: 'Act: Clear → onChange([]).',
      props: { formType: 'Language', language: LanguageType.ENGLISH, outputLanguage: 'vi', languages: STUDY_LANGUAGES, selectedIds: ['ct-en', 'ct-any'], onChange: recordChange },
      mocks: { firestore: CARD_TYPE_SEED },
      act: async ctx => {
        await ctx.wait(50)
        changeSpy.count = 0
        changeSpy.lastValue = null
        clickLinkByText(ctx.root, 'Clear')
        await ctx.wait(0)
      },
    },
    {
      id: 'probe-language-mismatch',
      probe: true,
      description: '検証ケース。',
      props: { formType: 'Language', language: LanguageType.JAPANESE, outputLanguage: 'vi', languages: STUDY_LANGUAGES, selectedIds: [], onChange: noop },
      mocks: { firestore: CARD_TYPE_SEED },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'regional-language-includes-generic',
      description: 'zh-TW では generic zh と exact zh-TW を表示し、zh-CN は除外する。',
      props: { formType: 'Language', language: 'zh-TW', outputLanguage: 'vi', languages: STUDY_LANGUAGES, selectedIds: [], onChange: noop },
      mocks: { firestore: CARD_TYPE_SEED },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'output-language-switch',
      description: '同じ学習言語でも AI output language に一致する Card Type だけを表示する。',
      props: { formType: 'Language', language: 'en', outputLanguage: 'ja', languages: STUDY_LANGUAGES, selectedIds: [], onChange: noop },
      mocks: { firestore: CARD_TYPE_SEED },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'fallback-defaults',
      description: 'default でも pair に一致しない Card Type は表示しない。',
      props: { formType: 'Language', language: 'en', outputLanguage: 'de', languages: STUDY_LANGUAGES, selectedIds: [], onChange: noop },
      mocks: { firestore: FALLBACK_SEED },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'empty-language-pair',
      description: '一致 Card Type も default もなければ案内を表示する。',
      props: { formType: 'Language', language: 'en', outputLanguage: 'de', languages: STUDY_LANGUAGES, selectedIds: [], onChange: noop },
      mocks: { firestore: { card_types: [FALLBACK_SEED.card_types[0]] } },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'prunes-hidden-selection',
      description: 'output language 変更後に非表示となった選択 ID だけを除外する。',
      props: { formType: 'Language', language: 'en', outputLanguage: 'vi', languages: STUDY_LANGUAGES, selectedIds: ['ct-en', 'ct-en-ja'], onChange: recordChange },
      mocks: { firestore: CARD_TYPE_SEED },
      act: async ctx => {
        changeSpy.count = 0
        changeSpy.lastValue = null
        await ctx.wait(50)
      },
    },
  ],
  invariants: [
    {
      id: 'filtered-by-language',
      description: '検証ケース。',
      onlyFixtures: ['loaded-language-en', 'act-toggle', 'act-select-all', 'act-clear'],
      check: ({ root }) => {
        const names = visibleNames(root)
        return (
          JSON.stringify(names) === JSON.stringify(['English → Vietnamese', 'Listening']) ||
          `表示: ${names.join(' | ')}`
        )
      },
    },
    {
      id: 'checked-matches-selection',
      description: 'Chip checked が selectedIds と一致し、contract selected も一致',
      onlyFixtures: ['loaded-language-en'],
      check: ({ root, contract }) => {
        const checked = chipButtons(root).filter(isChecked).length
        if (checked !== 1) return `checked=${checked}, expected=1`
        return contract.selected === '1' || `contract.selected="${contract.selected}"`
      },
    },
    {
      id: 'toggle-adds-id',
      description: '検証ケース。',
      onlyFixtures: ['act-toggle'],
      check: () =>
        (changeSpy.count === 1 &&
          JSON.stringify(changeSpy.lastValue) === JSON.stringify(['ct-en', 'ct-any'])) ||
        `count=${changeSpy.count}, lastValue=${JSON.stringify(changeSpy.lastValue)}`,
    },
    {
      id: 'select-all-returns-visible-ids',
      description: '検証ケース。',
      onlyFixtures: ['act-select-all'],
      check: () =>
        (changeSpy.count === 1 &&
          JSON.stringify(changeSpy.lastValue) === JSON.stringify(['ct-en', 'ct-any'])) ||
        `count=${changeSpy.count}, lastValue=${JSON.stringify(changeSpy.lastValue)}`,
    },
    {
      id: 'clear-returns-empty',
      description: '検証ケース。',
      onlyFixtures: ['act-clear'],
      check: () =>
        (changeSpy.count === 1 && JSON.stringify(changeSpy.lastValue) === JSON.stringify([])) ||
        `count=${changeSpy.count}, lastValue=${JSON.stringify(changeSpy.lastValue)}`,
    },
    {
      id: 'language-mismatch-only-null',
      description: '検証ケース。',
      onlyFixtures: ['probe-language-mismatch'],
      check: ({ root, contract }) => {
        const names = visibleNames(root)
        if (JSON.stringify(names) !== JSON.stringify(['Listening'])) {
          return `表示: ${names.join(' | ')}`
        }
        return contract.count === '1' || `contract.count="${contract.count}"`
      },
    },
    {
      id: 'regional-language-scope',
      description: 'generic scope は regional entry に適用するが、別 regional scope は適用しない。',
      onlyFixtures: ['regional-language-includes-generic'],
      check: ({ root }) => {
        const names = visibleNames(root)
        return (
          JSON.stringify(names) === JSON.stringify(['Listening', 'ZH Tones', 'Traditional only'])
          || `表示: ${names.join(' | ')}`
        )
      },
    },
    {
      id: 'output-language-scope-and-dynamic-name',
      description: 'output language scope と動的 Card Type 名を反映する。',
      onlyFixtures: ['output-language-switch'],
      check: ({ root }) => {
        const names = visibleNames(root)
        return (
          JSON.stringify(names) === JSON.stringify(['Japanese output', 'Listening'])
          || `表示: ${names.join(' | ')}`
        )
      },
    },
    {
      id: 'mismatched-default-is-hidden',
      description: 'pair 不一致の default は選択肢へ戻さない。',
      onlyFixtures: ['fallback-defaults'],
      check: ({ root }) => {
        const names = visibleNames(root)
        return (
          names.length === 0
          || `表示: ${names.join(' | ')}`
        )
      },
    },
    {
      id: 'empty-pair-is-actionable',
      description: 'Card Type がないとき Admin への案内を表示する。',
      onlyFixtures: ['empty-language-pair'],
      check: ({ root, contract }) => {
        if (contract.count !== '0') return `contract.count="${contract.count}"`
        return (root.textContent ?? '').includes(
          'No card type matches the current language pair. Add one in Admin → Card Types.',
        ) || 'empty state が表示されない'
      },
    },
    {
      id: 'hidden-selection-is-pruned',
      description: '表示対象外 ID を選択状態から除外する。',
      onlyFixtures: ['prunes-hidden-selection'],
      check: () => (
        changeSpy.count === 1
        && JSON.stringify(changeSpy.lastValue) === JSON.stringify(['ct-en'])
      ) || `count=${changeSpy.count}, lastValue=${JSON.stringify(changeSpy.lastValue)}`,
    },
  ],
})

registerUnit<Record<string, never>>({
  id: 'CardTypeLanguagePairFlow',
  title: 'CardTypeLanguagePairFlow',
  description: 'production の pair filter/name helper で Settings 変更後の Create 表示を検証する。',
  kind: 'feature',
  render: () => <CardTypeLanguagePairFlow />,
  propsSchema: z.object({}),
  fixtures: [
    {
      id: 'initial-vietnamese',
      probe: true,
      description: 'Vietnamese output と Chinese study language の pair を初期表示する。',
      props: {},
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'switches-to-japanese',
      description: 'AI output language を Japanese に切り替えて表示対象を更新する。',
      props: {},
      act: async ctx => {
        await ctx.wait(50)
        const button = Array.from(ctx.root.querySelectorAll('button')).find(
          item => item.textContent?.trim() === 'Japanese' && !item.querySelector('svg'),
        )
        if (!button) throw new Error('Japanese output button が見つかりません')
        button.click()
        await ctx.wait(50)
      },
    },
    {
      id: 'e2e-settings-to-create',
      description: 'Playwright が AI output language の切り替えと Card Type filter を操作する。',
      props: {},
    },
  ],
  invariants: [
    {
      id: 'initial-pair',
      description: '初期状態は Vietnamese → Chinese と共通 Card Type だけを表示する。',
      onlyFixtures: ['initial-vietnamese'],
      check: ({ root }) => {
        const names = flowVisibleNames(root)
        return (
          JSON.stringify(names) === JSON.stringify(['Vietnamese → Chinese', 'Listening'])
          || `表示: ${names.join(' | ')}`
        )
      },
    },
    {
      id: 'updated-pair',
      description: '切り替え後は Japanese → Chinese と共通 Card Type だけを表示する。',
      onlyFixtures: ['switches-to-japanese'],
      check: ({ root }) => {
        const names = flowVisibleNames(root)
        return (
          JSON.stringify(names) === JSON.stringify(['Japanese → Chinese', 'Listening'])
          || `表示: ${names.join(' | ')}`
        )
      },
    },
  ],
})
