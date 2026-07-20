import type { ComponentProps } from 'react'
import { z } from 'zod'
import { CardForm } from '@/components/create/CardForm'
import { BUILTIN_BLUEPRINTS } from '@/lib/create/formBlueprint'
import { registerUnit } from '@/verify/core/registry'
import { fn } from '@/verify/core/schema-helpers'
import type { PendingEntry } from '@/lib/pendingEntry'
import { FormType } from '@/types'

type LanguageFormProps = Omit<ComponentProps<typeof CardForm>, 'blueprint'>
const LANGUAGE_BLUEPRINT = BUILTIN_BLUEPRINTS[FormType.LANGUAGE]!

const GENERATED = {
  word: 'serendipity',
  meaning_vi: '幸運な偶然',
  ipa: '/ˌser.ənˈdɪp.ə.ti/',
  word_type: 'noun',
}

// 検証用コメント。
const SESSION = JSON.stringify({
  language: 'en',
  deckId: 'd-en',
  categoryId: 'c-life',
  cardTypeIds: ['ct-en'],
  tags: ['vocab'],
})

const FIRESTORE_SEED = { decks: [], categories: [], card_types: [] }
const DETECT_EN = {
  detections: [{ index: 0, code: 'en', display_name: 'English', confidence: 0.98 }],
}
const DETECT_JA = {
  detections: [{ index: 0, code: 'ja', display_name: 'Japanese', confidence: 0.99 }],
}
const DETECT_FR = {
  detections: [{ index: 0, code: 'fr', display_name: 'French', confidence: 0.91 }],
}
const DETECT_MIXED = {
  detections: [
    { index: 0, code: 'en', display_name: 'English', confidence: 0.98 },
    { index: 1, code: 'ja', display_name: 'Japanese', confidence: 0.99 },
  ],
}

// Spy cho onValidityChange — reset trong act
const validitySpy = { last: null as boolean | null, sawTrue: false }
const recordValidity = (canSubmit: boolean) => {
  validitySpy.last = canSubmit
  if (canSubmit) validitySpy.sawTrue = true
}

function navCalls(): Array<{ method: string; args: unknown[] }> | null {
  const g = globalThis as unknown as {
    __verifyNav?: { calls: Array<{ method: string; args: unknown[] }> }
  }
  return g.__verifyNav?.calls ?? null
}

function submitForm(root: HTMLElement): void {
  const form = root.querySelector<HTMLFormElement>('form')
  if (!form) throw new Error('要素が見つかりません')
  if (typeof form.requestSubmit === 'function') {
    form.requestSubmit()
  } else {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  }
}

function loadPending(): PendingEntry | null {
  const raw = localStorage.getItem('ankiflow_pending_result')
  return raw ? (JSON.parse(raw) as PendingEntry) : null
}

registerUnit<LanguageFormProps>({
  id: 'LanguageForm',
  title: 'LanguageForm',
  description:
    'Language vocab 作成 form: /api/generate 呼び出し → pending entry 保存 → /preview へ push (vitest-only)。',
  kind: 'component',
  render: props => <CardForm blueprint={LANGUAGE_BLUEPRINT} {...props} />,
  propsSchema: z.object({
    onGenerateStart: fn<() => void>().optional(),
    onStepUpdate: fn<(step: number, status: string) => void>().optional(),
    onGenerateEnd: fn<() => void>().optional(),
    onValidityChange: fn<(canSubmit: boolean) => void>().optional(),
    batchMode: z.boolean().optional(),
    formId: z.string().optional(),
  }),
  fixtures: [
    {
      id: 'initial',
      description: '検証ケース。',
      props: {},
      mocks: {
        firestore: FIRESTORE_SEED,
        localStorage: { ankiflow_session_form_language: SESSION },
        pathname: '/create',
      },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'act-submit-success',
      description:
        'Act: 単語入力 + submit、mock /api/generate 200 → pending entry を正しく保存 + router.push(/preview)。',
      props: {},
      mocks: {
        firestore: FIRESTORE_SEED,
        localStorage: { ankiflow_session_form_language: SESSION },
        pathname: '/create',
        fetch: [
          { match: '/api/languages/detect', response: { status: 200, json: DETECT_EN } },
          { match: '/api/generate', response: { status: 200, json: { content: GENERATED } } },
        ],
      },
      act: async ctx => {
        await ctx.wait(50)
        await ctx.type('input[aria-label="Vocabulary item"]', 'serendipity')
        submitForm(ctx.root)
        // 検証用コメント。
        await ctx.wait(1100)
      },
    },
    {
      id: 'act-submit-api-error',
      description:
        'Act: submit で API が 500 を返す → error を表示し、redirect せず、pending を保存しない。',
      props: {},
      mocks: {
        firestore: FIRESTORE_SEED,
        localStorage: { ankiflow_session_form_language: SESSION },
        pathname: '/create',
        fetch: [
          { match: '/api/languages/detect', response: { status: 200, json: DETECT_EN } },
          {
            match: '/api/generate',
            response: { status: 500, json: { error: 'Gemini quota exceeded' } },
          },
        ],
      },
      act: async ctx => {
        await ctx.wait(50)
        await ctx.type('input[aria-label="Vocabulary item"]', 'serendipity')
        submitForm(ctx.root)
        await ctx.wait(100)
      },
    },
    {
      id: 'act-detection-overrides-session',
      description: '検証ケース。',
      props: {},
      mocks: {
        firestore: FIRESTORE_SEED,
        localStorage: { ankiflow_session_form_language: SESSION },
        pathname: '/create',
        fetch: [
          { match: '/api/languages/detect', response: { status: 200, json: DETECT_JA } },
          { match: '/api/generate', response: { status: 200, json: { content: GENERATED } } },
        ],
      },
      act: async ctx => {
        await ctx.wait(50)
        await ctx.type('input[aria-label="Vocabulary item"]', '猫')
        submitForm(ctx.root)
        await ctx.wait(1100)
      },
    },
    {
      id: 'probe-empty-input-invalid',
      probe: true,
      description: '検証ケース。',
      props: { onValidityChange: recordValidity },
      mocks: {
        firestore: FIRESTORE_SEED,
        localStorage: { ankiflow_session_form_language: SESSION },
        pathname: '/create',
      },
      act: async ctx => {
        validitySpy.last = null
        validitySpy.sawTrue = false
        await ctx.wait(50)
        await ctx.type('input[aria-label="Vocabulary item"]', 'hello')
        await ctx.type('input[aria-label="Vocabulary item"]', '')
        await ctx.wait(16)
      },
    },
    {
      id: 'probe-unconfigured-language',
      probe: true,
      description: '検証ケース。',
      props: {},
      mocks: {
        firestore: FIRESTORE_SEED,
        localStorage: { ankiflow_session_form_language: SESSION },
        pathname: '/create',
        fetch: [
          { match: '/api/languages/detect', response: { status: 200, json: DETECT_FR } },
        ],
      },
      act: async ctx => {
        await ctx.wait(50)
        await ctx.type('input[aria-label="Vocabulary item"]', 'bonjour')
        submitForm(ctx.root)
        await ctx.wait(100)
      },
    },
    {
      id: 'act-detection-error-uses-manual',
      description: '検証ケース。',
      props: {},
      mocks: {
        firestore: FIRESTORE_SEED,
        localStorage: { ankiflow_session_form_language: SESSION },
        pathname: '/create',
        fetch: [
          { match: '/api/languages/detect', response: { status: 503, json: { error: 'Detector unavailable' } } },
          { match: '/api/generate', response: { status: 200, json: { content: GENERATED } } },
        ],
      },
      act: async ctx => {
        await ctx.wait(50)
        await ctx.type('input[aria-label="Vocabulary item"]', 'serendipity')
        submitForm(ctx.root)
        await ctx.wait(1100)
      },
    },
    {
      id: 'probe-mixed-language-batch',
      probe: true,
      description: '検証ケース。',
      props: { batchMode: true },
      mocks: {
        firestore: FIRESTORE_SEED,
        localStorage: { ankiflow_session_form_language: SESSION },
        pathname: '/create',
        fetch: [
          { match: '/api/languages/detect', response: { status: 200, json: DETECT_MIXED } },
        ],
      },
      act: async ctx => {
        await ctx.wait(50)
        await ctx.type('input[aria-label="Vocabulary item 1"]', 'cat')
        const addButton = Array.from(ctx.root.querySelectorAll('button'))
          .find(button => button.textContent?.trim() === 'Add item')
        if (!addButton) throw new Error('要素が見つかりません')
        addButton.click()
        await ctx.wait(16)
        await ctx.type('input[aria-label="Vocabulary item 2"]', '猫')
        submitForm(ctx.root)
        await ctx.wait(100)
      },
    },
  ],
  invariants: [
    {
      id: 'form-renders-core-fields',
      description: '検証ケース。',
      check: ({ root }) => {
        if (!root.querySelector('input[aria-label^="Vocabulary item"]')) return '不足しています'
        if (!root.querySelector('[data-verify-unit="LanguageSelector"]')) return '不足しています'
        if (!root.querySelector('[data-verify-unit="DeckCreatableField"]')) return '不足しています'
        return !!root.querySelector('[data-verify-unit="CategoryCreatableField"]') || '不足しています'
      },
    },
    {
      id: 'submit-saves-pending-entry',
      description: '検証ケース。',
      onlyFixtures: ['act-submit-success'],
      check: () => {
        const pending = loadPending()
        if (!pending) return '対象がありません'
        if (JSON.stringify(pending.generatedContent) !== JSON.stringify(GENERATED)) {
          return `generatedContent=${JSON.stringify(pending.generatedContent)}`
        }
        if (pending.formType !== FormType.LANGUAGE) return `formType=${pending.formType}`
        if (pending.deckId !== 'd-en') return `deckId=${pending.deckId}`
        if (pending.categoryId !== 'c-life') return `categoryId=${pending.categoryId}`
        if (JSON.stringify(pending.tags) !== JSON.stringify(['vocab'])) {
          return `tags=${JSON.stringify(pending.tags)}`
        }
        return true
      },
    },
    {
      id: 'submit-redirects-to-preview',
      description: 'submit 成功: router.push("/preview") が 1 回だけ呼ばれる (vitest)',
      onlyFixtures: ['act-submit-success'],
      check: () => {
        const calls = navCalls()
        if (calls === null) return true
        const pushes = calls.filter(c => c.method === 'push')
        return (
          (pushes.length === 1 && pushes[0].args[0] === '/preview') ||
          `pushes=${JSON.stringify(pushes)}`
        )
      },
    },
    {
      id: 'api-error-shows-message-no-side-effects',
      description: '検証ケース。',
      onlyFixtures: ['act-submit-api-error'],
      check: ({ root, contract }) => {
        if (contract.error !== 'true') return `contract.error="${contract.error}"`
        if (!(root.textContent ?? '').includes('Gemini quota exceeded')) {
          return 'error message が表示されていません'
        }
        if (loadPending() !== null) return 'API error でも pending entry が保存されています'
        const calls = navCalls()
        if (calls === null) return true
        return calls.filter(c => c.method === 'push').length === 0 || 'error でも redirect されています'
      },
    },
    {
      id: 'detected-language-overrides-session',
      description: '検証ケース。',
      onlyFixtures: ['act-detection-overrides-session'],
      check: () => {
        const pending = loadPending()
        if (!pending) return '対象がありません'
        if (pending.language !== 'ja') return `language=${pending.language}`
        if (pending.deckId !== '') return `deckId=${pending.deckId}`
        return pending.cardTypeIds.length === 0 || `cardTypeIds=${JSON.stringify(pending.cardTypeIds)}`
      },
    },
    {
      id: 'empty-input-reports-invalid',
      description: '検証ケース。',
      onlyFixtures: ['probe-empty-input-invalid'],
      check: () =>
        (validitySpy.last === false && validitySpy.sawTrue) ||
        `last=${validitySpy.last}, sawTrue=${validitySpy.sawTrue}`,
    },
    {
      id: 'unconfigured-language-prompts',
      description: '検証ケース。',
      onlyFixtures: ['probe-unconfigured-language'],
      check: ({ root }) => {
        const text = root.textContent ?? ''
        if (!text.includes('Add detected language?') || !text.includes('French')) return text
        if (loadPending() !== null) return 'ユーザー確認前に pending が作成されています'
        const calls = navCalls()
        return calls === null || calls.filter(call => call.method === 'push').length === 0 || 'redirect されています'
      },
    },
    {
      id: 'detection-error-uses-explicit-selection',
      description: '検証ケース。',
      onlyFixtures: ['act-detection-error-uses-manual'],
      check: () => {
        const pending = loadPending()
        if (!pending) return '対象がありません'
        if (pending.language !== 'en') return `language=${pending.language}`
        if (pending.deckId !== 'd-en') return `deckId=${pending.deckId}`
        return JSON.stringify(pending.cardTypeIds) === JSON.stringify(['ct-en'])
          || `cardTypeIds=${JSON.stringify(pending.cardTypeIds)}`
      },
    },
    {
      id: 'mixed-batch-is-blocked',
      description: '検証ケース。',
      onlyFixtures: ['probe-mixed-language-batch'],
      check: ({ root, contract }) => {
        const text = root.textContent ?? ''
        if (contract.error !== 'true') return `contract.error=${contract.error}`
        if (!text.includes('#1 “cat” → English (en)')) return text
        if (!text.includes('#2 “猫” → Japanese (ja)')) return text
        return loadPending() === null || 'mixed batch で pending が作成されています'
      },
    },
  ],
})
