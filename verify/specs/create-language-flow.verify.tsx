import { z } from 'zod'
import { LanguageForm } from '@/components/create/LanguageForm'
import { registerUnit } from '@/verify/core/registry'
import type { PendingEntry } from '@/lib/pendingEntry'
import { FormType, LanguageType } from '@/types'

/**
 * Feature spec: luồng end-to-end Create (ngôn ngữ) → handoff sang Preview.
 * Khác với LanguageForm.verify (component-level): tại đây nhìn từ góc độ tính năng —
 * "người dùng nhập từ, hệ thống enrich rồi chuyển sang preview với đúng payload".
 */

const GENERATED = {
  word: '猫',
  meaning_vi: 'con mèo',
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
  if (!form) throw new Error('không tìm thấy form')
  if (typeof form.requestSubmit === 'function') form.requestSubmit()
  else form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
}

registerUnit<Record<string, never>>({
  id: 'create-language-flow',
  title: 'Feature: Create → Preview (Language)',
  description: 'Luồng tạo thẻ ngôn ngữ: nhập từ → /api/generate → lưu pending entry → điều hướng /preview.',
  kind: 'feature',
  render: () => <LanguageForm />,
  propsSchema: z.object({}),
  fixtures: [
    {
      id: 'happy-path',
      description: 'Nhập từ → submit (API 200) → pending entry khớp payload mock + push /preview.',
      props: {},
      mocks: {
        firestore: FIRESTORE_SEED,
        localStorage: { ankiflow_session_form_language: SESSION },
        pathname: '/create',
        fetch: [{ match: '/api/generate', response: { status: 200, json: { content: GENERATED } } }],
      },
      act: async ctx => {
        await ctx.wait(50)
        await ctx.type('input[aria-label="Vocabulary Item"]', '猫')
        submitForm(ctx.root)
        await ctx.wait(1100)
      },
    },
    {
      id: 'probe-api-error-no-handoff',
      probe: true,
      description: 'Probe: API 500 → không lưu pending, không điều hướng (handoff bị chặn an toàn).',
      props: {},
      mocks: {
        firestore: FIRESTORE_SEED,
        localStorage: { ankiflow_session_form_language: SESSION },
        pathname: '/create',
        fetch: [
          { match: '/api/generate', response: { status: 500, json: { error: 'Gemini down' } } },
        ],
      },
      act: async ctx => {
        await ctx.wait(50)
        await ctx.type('input[aria-label="Vocabulary Item"]', '猫')
        submitForm(ctx.root)
        await ctx.wait(150)
      },
    },
  ],
  invariants: [
    {
      id: 'handoff-payload-complete',
      description: 'Pending entry chứa content từ API + đầy đủ config session (language, deck, category, cardTypes, tags)',
      onlyFixtures: ['happy-path'],
      check: () => {
        const pending = loadPending()
        if (!pending) return 'không có pending entry'
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
      description: 'Điều hướng sang /preview đúng 1 lần',
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
      description: 'API lỗi: không pending entry, không điều hướng',
      onlyFixtures: ['probe-api-error-no-handoff'],
      check: ({ root, contract }) => {
        if (loadPending() !== null) return 'pending entry bị lưu dù API lỗi'
        const pushes = navPushes()
        if (pushes !== null && pushes.length > 0) return `điều hướng dù lỗi: ${JSON.stringify(pushes)}`
        if (contract.error !== 'true') return `contract.error="${contract.error}"`
        return (root.textContent ?? '').includes('Gemini down') || 'thông báo lỗi không hiển thị'
      },
    },
  ],
})
