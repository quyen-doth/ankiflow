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
  meaning_vi: 'sự tình cờ may mắn',
  ipa: '/ˌser.ənˈdɪp.ə.ti/',
  word_type: 'noun',
}

// Session đã lưu từ lần trước — config phải đi vào pending entry
const SESSION = JSON.stringify({
  language: 'en',
  deckId: 'd-en',
  categoryId: 'c-life',
  cardTypeIds: ['ct-en'],
  tags: ['vocab'],
})

const FIRESTORE_SEED = { decks: [], categories: [], card_types: [] }

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
  if (!form) throw new Error('không tìm thấy form')
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
    'Form tạo vocab ngôn ngữ: gọi /api/generate → lưu pending entry → push /preview (vitest-only).',
  kind: 'component',
  render: props => <CardForm blueprint={LANGUAGE_BLUEPRINT} {...props} />,
  propsSchema: z.object({
    onGenerateStart: fn<() => void>().optional(),
    onStepUpdate: fn<(step: number, status: string) => void>().optional(),
    onGenerateEnd: fn<() => void>().optional(),
    onValidityChange: fn<(canSubmit: boolean) => void>().optional(),
    formId: z.string().optional(),
  }),
  fixtures: [
    {
      id: 'initial',
      description: 'Mount với session đã lưu — form render đủ 2 cột, không lỗi.',
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
        'Act: điền từ + submit, mock /api/generate 200 → pending entry lưu đúng + router.push(/preview).',
      props: {},
      mocks: {
        firestore: FIRESTORE_SEED,
        localStorage: { ankiflow_session_form_language: SESSION },
        pathname: '/create',
        fetch: [
          { match: '/api/generate', response: { status: 200, json: { content: GENERATED } } },
        ],
      },
      act: async ctx => {
        await ctx.wait(50)
        await ctx.type('input[aria-label="Vocabulary item"]', 'serendipity')
        submitForm(ctx.root)
        // fetch + 500ms + 400ms các bước giả lập tiến độ
        await ctx.wait(1100)
      },
    },
    {
      id: 'act-submit-api-error',
      description:
        'Act: submit nhưng API trả 500 → hiển thị lỗi, KHÔNG redirect, KHÔNG lưu pending.',
      props: {},
      mocks: {
        firestore: FIRESTORE_SEED,
        localStorage: { ankiflow_session_form_language: SESSION },
        pathname: '/create',
        fetch: [
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
      id: 'probe-empty-input-invalid',
      probe: true,
      description: 'Probe: input rỗng → onValidityChange(false) — page sẽ disable nút submit.',
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
  ],
  invariants: [
    {
      id: 'form-renders-core-fields',
      description: 'Form có input từ vựng, note, language/deck/category selector',
      check: ({ root }) => {
        if (!root.querySelector('input[aria-label="Vocabulary item"]')) return 'thiếu input từ vựng'
        if (!root.querySelector('[data-verify-unit="LanguageSelector"]')) return 'thiếu LanguageSelector'
        if (!root.querySelector('[data-verify-unit="DeckCreatableField"]')) return 'thiếu DeckCreatableField'
        return !!root.querySelector('[data-verify-unit="CategoryCreatableField"]') || 'thiếu CategoryCreatableField'
      },
    },
    {
      id: 'submit-saves-pending-entry',
      description: 'Submit thành công: pending entry chứa content từ API + config từ session',
      onlyFixtures: ['act-submit-success'],
      check: () => {
        const pending = loadPending()
        if (!pending) return 'không có ankiflow_pending_result trong localStorage'
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
      description: 'Submit thành công: router.push("/preview") gọi đúng 1 lần (vitest)',
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
      description: 'API 500: lỗi hiển thị, không redirect, localStorage không có pending',
      onlyFixtures: ['act-submit-api-error'],
      check: ({ root, contract }) => {
        if (contract.error !== 'true') return `contract.error="${contract.error}"`
        if (!(root.textContent ?? '').includes('Gemini quota exceeded')) {
          return 'thông báo lỗi không hiển thị'
        }
        if (loadPending() !== null) return 'pending entry bị lưu dù API lỗi'
        const calls = navCalls()
        if (calls === null) return true
        return calls.filter(c => c.method === 'push').length === 0 || 'vẫn redirect dù lỗi'
      },
    },
    {
      id: 'empty-input-reports-invalid',
      description: 'Input rỗng: onValidityChange cuối cùng là false (đã từng true khi có chữ)',
      onlyFixtures: ['probe-empty-input-invalid'],
      check: () =>
        (validitySpy.last === false && validitySpy.sawTrue) ||
        `last=${validitySpy.last}, sawTrue=${validitySpy.sawTrue}`,
    },
  ],
})
