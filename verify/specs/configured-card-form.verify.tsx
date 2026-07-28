import { z } from 'zod'
import { CardFormContent } from '@/components/create/CardForm'
import { registerUnit } from '@/verify/core/registry'
import type { CardFormBlueprint } from '@/lib/create/formBlueprint'
import type { PendingBatch } from '@/lib/pendingBatch'
import type { PendingEntry } from '@/lib/pendingEntry'
import type { AiOutputLanguage } from '@/types'

const BLUEPRINT: CardFormBlueprint = {
  formType: 'custom_configured',
  primaryFieldKey: 'prompt',
  coreFields: [
    {
      key: 'prompt',
      label: 'Prompt',
      type: 'text',
      required: true,
      persistent: false,
      placeholder: 'Question to learn',
    },
    {
      key: 'audience',
      label: 'Audience',
      type: 'text',
      required: true,
      persistent: true,
      placeholder: 'Who is this for?',
    },
    {
      key: 'note',
      label: 'Optional note',
      type: 'textarea',
      required: false,
      persistent: false,
    },
  ],
  configBlocks: [],
  generate: {
    mode: 'local',
    content: values => ({ ...values, word: values.prompt, meaning_vi: values.note || values.audience }),
  },
}

const DROPDOWN_PRIMARY_BLUEPRINT: CardFormBlueprint = {
  formType: 'custom_dropdown_primary',
  primaryFieldKey: 'level',
  coreFields: [
    {
      key: 'level',
      label: 'Level',
      type: 'dropdown',
      required: true,
      options: ['Beginner', 'Advanced'],
    },
  ],
  configBlocks: [],
  generate: {
    mode: 'local',
    content: values => ({ ...values, word: values.level }),
  },
}

function outputLanguageBlueprint(
  persistent: boolean,
  showControl = true,
): CardFormBlueprint {
  return {
    formType: showControl
      ? `custom_output_${persistent ? 'persistent' : 'temporary'}`
      : 'custom_output_hidden',
    primaryFieldKey: 'prompt',
    coreFields: [{
      key: 'prompt',
      label: 'Prompt',
      type: 'text',
      required: true,
    }],
    configBlocks: showControl
      ? [{
          kind: 'outputLanguage',
          fieldKey: 'explanation_locale',
          label: 'Explanation language',
          required: true,
          persistent,
        }]
      : [],
    generate: {
      mode: 'local',
      content: (values, session) => ({
        word: values.prompt,
        generated_output_language: session.outputLanguage,
        generated_output_language_name: session.outputLanguageName,
      }),
    },
  }
}

const OUTPUT_LANGUAGES: AiOutputLanguage[] = [
  { code: 'vi', display_name: 'Vietnamese', enabled: true, sort_order: 0 },
  { code: 'ja', display_name: 'Japanese for explanations', enabled: true, sort_order: 1 },
]

const OUTPUT_LANGUAGE_CARD_TYPES_BLUEPRINT: CardFormBlueprint = {
  ...outputLanguageBlueprint(false),
  formType: 'custom_output_card_types',
  configBlocks: [
    {
      kind: 'outputLanguage',
      fieldKey: 'explanation_locale',
      label: 'Explanation language',
      required: true,
      persistent: false,
    },
    {
      kind: 'cardTypes',
      fieldKey: 'card_type_ids',
      label: 'Card types',
      persistent: true,
    },
  ],
}

function submitForm(root: HTMLElement): void {
  const form = root.querySelector<HTMLFormElement>('form')
  if (!form) throw new Error('form が見つからない')
  form.requestSubmit()
}

function pendingEntry(): PendingEntry | null {
  const raw = localStorage.getItem('ankiflow_pending_result')
  return raw ? JSON.parse(raw) as PendingEntry : null
}

function pendingBatch(): PendingBatch | null {
  const raw = localStorage.getItem('ankiflow_pending_batch')
  return raw ? JSON.parse(raw) as PendingBatch : null
}

interface ConfiguredCardFormVerifyProps {
  primaryType?: 'dropdown'
  outputMode?: 'temporary' | 'persistent' | 'hidden' | 'with-card-types'
  batchMode?: boolean
}

registerUnit<ConfiguredCardFormVerifyProps>({
  id: 'ConfiguredCardForm',
  title: 'Configured CardForm fields',
  description: 'fields[] の required/persistent metadata を CardForm runtime で検証する。',
  kind: 'feature',
  render: props => {
    const blueprint = props.outputMode
      ? props.outputMode === 'with-card-types'
        ? OUTPUT_LANGUAGE_CARD_TYPES_BLUEPRINT
        : outputLanguageBlueprint(
          props.outputMode === 'persistent',
          props.outputMode !== 'hidden',
        )
      : props.primaryType === 'dropdown' ? DROPDOWN_PRIMARY_BLUEPRINT : BLUEPRINT
    return (
      <CardFormContent
        blueprint={blueprint}
        batchMode={props.batchMode}
        navigate={() => undefined}
      />
    )
  },
  propsSchema: z.object({
    primaryType: z.enum(['dropdown']).optional(),
    outputMode: z.enum(['temporary', 'persistent', 'hidden', 'with-card-types']).optional(),
    batchMode: z.boolean().optional(),
  }),
  fixtures: [
    {
      id: 'primary-dropdown-renders-as-select',
      description: 'Custom primary dropdown は text input ではなく static options の select を表示する。',
      props: { primaryType: 'dropdown' },
      mocks: { pathname: '/create' },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'persistent-field-hydrates',
      description: 'Persistent core field は session.fieldValues から復元する。',
      props: {},
      mocks: {
        localStorage: {
          ankiflow_session_custom_configured: JSON.stringify({
            fieldValues: { audience: 'Software engineers' },
          }),
        },
        pathname: '/create',
      },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'submit-resets-only-nonpersistent',
      description: 'Generate 成功後、nonpersistent field を reset し persistent field を保持する。',
      props: {},
      mocks: { pathname: '/create' },
      act: async ctx => {
        await ctx.wait(50)
        await ctx.type('input[aria-label="Prompt"]', 'Explain event loops')
        await ctx.type('input[aria-label="Audience"]', 'Beginners')
        submitForm(ctx.root)
        await ctx.wait(100)
      },
    },
    {
      id: 'probe-all-required-fields',
      probe: true,
      description: 'Probe: primary だけ入力しても他の required field が空なら submit を拒否する。',
      props: {},
      mocks: { pathname: '/create' },
      act: async ctx => {
        await ctx.wait(50)
        await ctx.type('input[aria-label="Prompt"]', 'Explain event loops')
        submitForm(ctx.root)
        await ctx.wait(50)
      },
    },
    {
      id: 'output-language-temporary',
      description: '一時 output language を AI/pending に渡し、成功後は default へ戻す。',
      props: { outputMode: 'temporary' },
      mocks: {
        aiOutputLanguages: OUTPUT_LANGUAGES,
        defaultAiOutputLanguage: 'vi',
        pathname: '/create',
      },
      act: async ctx => {
        await ctx.wait(50)
        const select = ctx.root.querySelector<HTMLSelectElement>(
          'select[aria-label="Explanation language"]',
        )
        if (!select) throw new Error('Output language select が見つからない')
        select.value = 'ja'
        select.dispatchEvent(new Event('change', { bubbles: true }))
        await ctx.type('input[aria-label="Prompt"]', 'Explain closures')
        submitForm(ctx.root)
        await ctx.wait(100)
      },
    },
    {
      id: 'output-language-persistent',
      description: 'persistent output language は session から復元し、成功後も保持する。',
      props: { outputMode: 'persistent' },
      mocks: {
        aiOutputLanguages: OUTPUT_LANGUAGES,
        defaultAiOutputLanguage: 'vi',
        localStorage: {
          ankiflow_session_custom_output_persistent: JSON.stringify({
            outputLanguage: 'ja',
          }),
        },
        pathname: '/create',
      },
      act: async ctx => {
        await ctx.wait(50)
        await ctx.type('input[aria-label="Prompt"]', 'Explain closures')
        submitForm(ctx.root)
        await ctx.wait(100)
      },
    },
    {
      id: 'output-language-hidden',
      description: 'control がない Content Type は selector を隠して Settings default を使う。',
      props: { outputMode: 'hidden' },
      mocks: {
        aiOutputLanguages: OUTPUT_LANGUAGES,
        defaultAiOutputLanguage: 'ja',
        pathname: '/create',
      },
      act: async ctx => {
        await ctx.wait(50)
        await ctx.type('input[aria-label="Prompt"]', 'Explain closures')
        submitForm(ctx.root)
        await ctx.wait(100)
      },
    },
    {
      id: 'e2e-output-language-control',
      description: 'Playwright が実 CardForm の output language を切り替えて pending を確認する。',
      props: { outputMode: 'temporary' },
      mocks: {
        aiOutputLanguages: OUTPUT_LANGUAGES,
        defaultAiOutputLanguage: 'vi',
        pathname: '/create',
      },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'output-language-batch',
      description: 'Custom Content Type の batch でも一時 output language を全 item と pending に渡す。',
      props: { outputMode: 'temporary', batchMode: true },
      mocks: {
        aiOutputLanguages: OUTPUT_LANGUAGES,
        defaultAiOutputLanguage: 'vi',
        pathname: '/create',
      },
      act: async ctx => {
        await ctx.wait(50)
        const select = ctx.root.querySelector<HTMLSelectElement>(
          'select[aria-label="Explanation language"]',
        )
        if (!select) throw new Error('Output language select が見つからない')
        select.value = 'ja'
        select.dispatchEvent(new Event('change', { bubbles: true }))
        await ctx.type('input[aria-label="Prompt 1"]', 'Explain closures')
        submitForm(ctx.root)
        await ctx.wait(100)
      },
    },
    {
      id: 'e2e-output-language-batch',
      description: 'Playwright が custom batch の output language と pending batch を確認する。',
      props: { outputMode: 'temporary', batchMode: true },
      mocks: {
        aiOutputLanguages: OUTPUT_LANGUAGES,
        defaultAiOutputLanguage: 'vi',
        pathname: '/create',
      },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'output-language-prunes-card-types',
      description: 'output language 切替時に不一致 Card Type だけを外し universal 選択を保持する。',
      props: { outputMode: 'with-card-types' },
      mocks: {
        aiOutputLanguages: OUTPUT_LANGUAGES,
        defaultAiOutputLanguage: 'vi',
        firestore: {
          card_types: [
            {
              id: 'ct-vi',
              user_id: 'test-user',
              code: 'vi',
              name: 'Vietnamese only',
              form_type: 'custom_output_card_types',
              language: null,
              output_language: 'vi',
              is_active: true,
              sort_order: 1,
            },
            {
              id: 'ct-ja',
              user_id: 'test-user',
              code: 'ja',
              name: 'Japanese only',
              form_type: 'custom_output_card_types',
              language: null,
              output_language: 'ja',
              is_active: true,
              sort_order: 2,
            },
            {
              id: 'ct-all',
              user_id: 'test-user',
              code: 'all',
              name: 'Universal',
              form_type: 'custom_output_card_types',
              language: null,
              output_language: null,
              is_active: true,
              sort_order: 3,
            },
          ],
        },
        localStorage: {
          ankiflow_session_custom_output_card_types: JSON.stringify({
            outputLanguage: 'vi',
            cardTypeIds: ['ct-vi', 'ct-all'],
          }),
        },
        pathname: '/create',
      },
      act: async ctx => {
        await ctx.wait(100)
        const select = ctx.root.querySelector<HTMLSelectElement>(
          'select[aria-label="Explanation language"]',
        )
        if (!select) throw new Error('Output language select が見つからない')
        select.value = 'ja'
        select.dispatchEvent(new Event('change', { bubbles: true }))
        await ctx.wait(100)
      },
    },
  ],
  invariants: [
    {
      id: 'primary-field-keeps-configured-type',
      description: 'Primary field でも fields[] の input type を上書きしない。',
      onlyFixtures: ['primary-dropdown-renders-as-select'],
      check: ({ root }) => {
        const select = root.querySelector<HTMLSelectElement>('select[aria-label="Level"]')
        if (!select) return 'Level dropdown が表示されていない'
        return Array.from(select.options).map(option => option.textContent).join('|') === 'Select…|Beginner|Advanced'
          || `options=${Array.from(select.options).map(option => option.textContent).join('|')}`
      },
    },
    {
      id: 'persistent-value-hydrated',
      description: 'Session の persistent field value を input に復元する。',
      onlyFixtures: ['persistent-field-hydrates'],
      check: ({ root }) => root.querySelector<HTMLInputElement>('input[aria-label="Audience"]')?.value === 'Software engineers'
        || 'Audience が session から復元されていない',
    },
    {
      id: 'success-resets-by-persistence',
      description: '成功後は Prompt を空にし、Audience と session.fieldValues を保持する。',
      onlyFixtures: ['submit-resets-only-nonpersistent'],
      check: ({ root }) => {
        const prompt = root.querySelector<HTMLInputElement>('input[aria-label="Prompt"]')?.value
        const audience = root.querySelector<HTMLInputElement>('input[aria-label="Audience"]')?.value
        const session = JSON.parse(localStorage.getItem('ankiflow_session_custom_configured') || '{}') as {
          fieldValues?: Record<string, string>
        }
        if (!pendingEntry()) return 'pending entry が保存されていない'
        if (prompt !== '') return `Prompt=${prompt}`
        if (audience !== 'Beginners') return `Audience=${audience}`
        return session.fieldValues?.audience === 'Beginners'
          || `session=${JSON.stringify(session)}`
      },
    },
    {
      id: 'all-required-fields-block-submit',
      description: '空の required field に英語エラーを表示し、generation side effect を起こさない。',
      onlyFixtures: ['probe-all-required-fields'],
      check: ({ root }) => {
        if (!root.textContent?.includes('Audience is required.')) return 'field error が表示されていない'
        if (root.querySelector('input[aria-label="Audience"]')?.getAttribute('aria-invalid') !== 'true') {
          return 'Audience に aria-invalid がない'
        }
        return pendingEntry() === null || 'validation failure でも pending entry が保存された'
      },
    },
    {
      id: 'temporary-output-language-flows-and-resets',
      description: '一時選択を generated content/pending に反映し、session と UI は default へ戻す。',
      onlyFixtures: ['output-language-temporary'],
      check: ({ root }) => {
        const pending = pendingEntry()
        const select = root.querySelector<HTMLSelectElement>(
          'select[aria-label="Explanation language"]',
        )
        const session = JSON.parse(
          localStorage.getItem('ankiflow_session_custom_output_temporary') || '{}',
        ) as { outputLanguage?: string }
        if (pending?.outputLanguage !== 'ja') return `pending="${pending?.outputLanguage}"`
        if (pending.generatedContent.generated_output_language !== 'ja') {
          return `generated="${pending.generatedContent.generated_output_language}"`
        }
        if (session.outputLanguage !== undefined) return `session="${session.outputLanguage}"`
        return select?.value === 'vi' || `select="${select?.value}"`
      },
    },
    {
      id: 'persistent-output-language-survives-success',
      description: 'persistent control は UI/session/pending のすべてで選択を保持する。',
      onlyFixtures: ['output-language-persistent'],
      check: ({ root }) => {
        const pending = pendingEntry()
        const select = root.querySelector<HTMLSelectElement>(
          'select[aria-label="Explanation language"]',
        )
        const session = JSON.parse(
          localStorage.getItem('ankiflow_session_custom_output_persistent') || '{}',
        ) as { outputLanguage?: string }
        if (pending?.outputLanguage !== 'ja') return `pending="${pending?.outputLanguage}"`
        if (session.outputLanguage !== 'ja') return `session="${session.outputLanguage}"`
        return select?.value === 'ja' || `select="${select?.value}"`
      },
    },
    {
      id: 'hidden-control-uses-settings-default',
      description: 'selector を持たない Content Type も default を AI/pending に渡す。',
      onlyFixtures: ['output-language-hidden'],
      check: ({ root }) => {
        const pending = pendingEntry()
        if (root.querySelector('select[aria-label="Explanation language"]')) {
          return 'output language selector が表示されている'
        }
        if (pending?.outputLanguage !== 'ja') return `pending="${pending?.outputLanguage}"`
        return pending.generatedContent.generated_output_language === 'ja'
          || `generated="${pending.generatedContent.generated_output_language}"`
      },
    },
    {
      id: 'temporary-output-language-flows-through-batch',
      description: 'Batch の各 generated item/pending に一時選択を反映し、成功後は default へ戻す。',
      onlyFixtures: ['output-language-batch'],
      check: ({ root }) => {
        const pending = pendingBatch()
        const select = root.querySelector<HTMLSelectElement>(
          'select[aria-label="Explanation language"]',
        )
        const session = JSON.parse(
          localStorage.getItem('ankiflow_session_custom_output_temporary') || '{}',
        ) as { outputLanguage?: string }
        if (pending?.outputLanguage !== 'ja') return `pending="${pending?.outputLanguage}"`
        if (pending.items.length !== 1) return `items=${pending.items.length}`
        if (pending.items[0]?.generated_output_language !== 'ja') {
          return `generated="${pending.items[0]?.generated_output_language}"`
        }
        if (session.outputLanguage !== undefined) return `session="${session.outputLanguage}"`
        return select?.value === 'vi' || `select="${select?.value}"`
      },
    },
    {
      id: 'output-language-reconciles-card-type-selection',
      description: '切替後は新 pair + universal を表示し、互換な既存選択だけを保持する。',
      onlyFixtures: ['output-language-prunes-card-types'],
      check: ({ root }) => {
        const text = root.textContent ?? ''
        const session = JSON.parse(
          localStorage.getItem('ankiflow_session_custom_output_card_types') || '{}',
        ) as { cardTypeIds?: string[] }
        if (text.includes('Vietnamese only')) return '旧 output language の Card Type が残っている'
        if (!text.includes('Japanese only')) return '新 output language の Card Type がない'
        if (!text.includes('Universal')) return 'universal Card Type がない'
        return JSON.stringify(session.cardTypeIds) === JSON.stringify(['ct-all'])
          || `cardTypeIds=${JSON.stringify(session.cardTypeIds)}`
      },
    },
  ],
})
