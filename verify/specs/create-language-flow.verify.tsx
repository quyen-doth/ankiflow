import { z } from 'zod'
import { CardForm } from '@/components/create/CardForm'
import { BUILTIN_BLUEPRINTS } from '@/lib/create/formBlueprint'
import { registerUnit } from '@/verify/core/registry'
import type { PendingEntry } from '@/lib/pendingEntry'
import { FormType, LanguageType } from '@/types'

const LANGUAGE_BLUEPRINT = BUILTIN_BLUEPRINTS[FormType.LANGUAGE]!

/**
 * 検証用コメント。
 * 検証用コメント。
 * 検証用コメント。
 */

const GENERATED = {
  word: '猫',
  meaning_vi: '猫',
  hiragana: 'ねこ',
  word_type: 'noun',
  example_sentence: '猫が好きです。',
}

const SESSION = JSON.stringify({
  language: LanguageType.JAPANESE,
  deckId: 'd-ja',
  categoryId: 'c-animal',
  cardTypeIds: ['ct-ja-word'],
  tags: ['jlpt-n5'],
})

const FIRESTORE_SEED = { decks: [], categories: [], card_types: [] }
const DETECT_JA = {
  detections: [{ index: 0, code: 'ja', display_name: 'Japanese', confidence: 0.99 }],
}

function navPushes(): string[] | null {
  const g = globalThis as unknown as {
    __verifyNav?: { calls: Array<{ method: string; args: unknown[] }> }
  }
  if (!g.__verifyNav) return null
  return g.__verifyNav.calls.filter(c => c.method === 'push').map(c => String(c.args[0]))
}

function loadPending(): PendingEntry | null {
  const raw = localStorage.getItem('ankiflow_pending_result')
  return raw ? (JSON.parse(raw) as PendingEntry) : null
}

function submitForm(root: HTMLElement): void {
  const form = root.querySelector<HTMLFormElement>('form')
  if (!form) throw new Error('要素が見つかりません')
  if (typeof form.requestSubmit === 'function') form.requestSubmit()
  else form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
}

registerUnit<Record<string, never>>({
  id: 'create-language-flow',
  title: 'Feature: Create → Preview (Language)',
  description: '検証ケース。',
  kind: 'feature',
  render: () => <CardForm blueprint={LANGUAGE_BLUEPRINT} />,
  propsSchema: z.object({}),
  fixtures: [
    {
      id: 'happy-path',
      description: '単語入力 → submit (API 200) → pending entry が mock payload と一致し /preview へ push。',
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
      id: 'probe-api-error-no-handoff',
      probe: true,
      description: '検証ケース。',
      props: {},
      mocks: {
        firestore: FIRESTORE_SEED,
        localStorage: { ankiflow_session_form_language: SESSION },
        pathname: '/create',
        fetch: [
          { match: '/api/languages/detect', response: { status: 200, json: DETECT_JA } },
          { match: '/api/generate', response: { status: 500, json: { error: 'Gemini down' } } },
        ],
      },
      act: async ctx => {
        await ctx.wait(50)
        await ctx.type('input[aria-label="Vocabulary item"]', '猫')
        submitForm(ctx.root)
        await ctx.wait(150)
      },
    },
  ],
  invariants: [
    {
      id: 'handoff-payload-complete',
      description: '検証ケース。',
      onlyFixtures: ['happy-path'],
      check: () => {
        const pending = loadPending()
        if (!pending) return '対象がありません'
        if (JSON.stringify(pending.generatedContent) !== JSON.stringify(GENERATED)) {
          return `generatedContent sai: ${JSON.stringify(pending.generatedContent)}`
        }
        if (pending.formType !== FormType.LANGUAGE) return `formType=${pending.formType}`
        if (pending.language !== LanguageType.JAPANESE) return `language=${pending.language}`
        if (pending.deckId !== 'd-ja') return `deckId=${pending.deckId}`
        if (pending.categoryId !== 'c-animal') return `categoryId=${pending.categoryId}`
        if (JSON.stringify(pending.cardTypeIds) !== JSON.stringify(['ct-ja-word'])) {
          return `cardTypeIds=${JSON.stringify(pending.cardTypeIds)}`
        }
        return (
          JSON.stringify(pending.tags) === JSON.stringify(['jlpt-n5']) ||
          `tags=${JSON.stringify(pending.tags)}`
        )
      },
    },
    {
      id: 'navigates-to-preview',
      description: '検証ケース。',
      onlyFixtures: ['happy-path'],
      check: () => {
        const pushes = navPushes()
        if (pushes === null) return true
        return (
          (pushes.length === 1 && pushes[0] === '/preview') || `pushes=${JSON.stringify(pushes)}`
        )
      },
    },
    {
      id: 'error-blocks-handoff',
      description: '検証ケース。',
      onlyFixtures: ['probe-api-error-no-handoff'],
      check: ({ root, contract }) => {
        if (loadPending() !== null) return 'API error でも pending entry が保存されています'
        const pushes = navPushes()
        if (pushes !== null && pushes.length > 0) return `error でも navigation されています: ${JSON.stringify(pushes)}`
        if (contract.error !== 'true') return `contract.error="${contract.error}"`
        return (root.textContent ?? '').includes('Gemini down') || 'error message が表示されていません'
      },
    },
  ],
})
