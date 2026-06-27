import type { ComponentProps } from 'react'
import { z } from 'zod'
import { CardForm } from '@/components/create/CardForm'
import { BUILTIN_BLUEPRINTS } from '@/lib/create/formBlueprint'
import { registerUnit } from '@/verify/core/registry'
import { fn } from '@/verify/core/schema-helpers'
import type { PendingEntry } from '@/lib/pendingEntry'
import { FormType } from '@/types'

type ITFormProps = Omit<ComponentProps<typeof CardForm>, 'blueprint'>
const IT_BLUEPRINT = BUILTIN_BLUEPRINTS[FormType.IT]!

const GENERATED = {
  term: 'Event Loop',
  definition: 'Cơ chế xử lý bất đồng bộ của JavaScript runtime.',
  keywords: ['async', 'callback'],
}

const SESSION = JSON.stringify({
  deckId: 'd-it',
  topicIds: ['t-be'],
  difficulty: 'advanced',
  cardTypeIds: ['ct-it'],
  tags: ['it'],
})

const FIRESTORE_SEED = { decks: [], topics: [], card_types: [] }

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

const TERM_INPUT = 'input[aria-label="Technical term"]'

registerUnit<ITFormProps>({
  id: 'ITForm',
  title: 'ITForm',
  description: 'Form tạo thuật ngữ IT: term + topics + difficulty → /api/generate (vitest-only).',
  kind: 'component',
  render: props => <CardForm blueprint={IT_BLUEPRINT} {...props} />,
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
      description: 'Mount với session — đủ term input, deck/topic selector, difficulty.',
      props: {},
      mocks: {
        firestore: FIRESTORE_SEED,
        localStorage: { ankiflow_session_form_it: SESSION },
        pathname: '/create',
      },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'act-submit-success',
      description: 'Act: điền term + submit, mock 200 → pending entry (formType IT, language null) + push /preview.',
      props: {},
      mocks: {
        firestore: FIRESTORE_SEED,
        localStorage: { ankiflow_session_form_it: SESSION },
        pathname: '/create',
        fetch: [
          { match: '/api/generate', response: { status: 200, json: { content: GENERATED } } },
        ],
      },
      act: async ctx => {
        await ctx.wait(50)
        await ctx.type(TERM_INPUT, 'Event Loop')
        submitForm(ctx.root)
        // fetch + 400ms + 300ms các bước giả lập tiến độ
        await ctx.wait(1000)
      },
    },
    {
      id: 'act-submit-api-error',
      description: 'Act: API 500 → lỗi hiển thị, không redirect, không lưu pending.',
      props: {},
      mocks: {
        firestore: FIRESTORE_SEED,
        localStorage: { ankiflow_session_form_it: SESSION },
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
        await ctx.type(TERM_INPUT, 'Event Loop')
        submitForm(ctx.root)
        await ctx.wait(100)
      },
    },
    {
      id: 'probe-empty-term-invalid',
      probe: true,
      description: 'Probe: term rỗng → onValidityChange(false).',
      props: { onValidityChange: recordValidity },
      mocks: {
        firestore: FIRESTORE_SEED,
        localStorage: { ankiflow_session_form_it: SESSION },
        pathname: '/create',
      },
      act: async ctx => {
        validitySpy.last = null
        validitySpy.sawTrue = false
        await ctx.wait(50)
        await ctx.type(TERM_INPUT, 'Closure')
        await ctx.type(TERM_INPUT, '')
        await ctx.wait(16)
      },
    },
  ],
  invariants: [
    {
      id: 'form-renders-core-fields',
      description: 'Form có term input, DeckSelector, TopicSelector, difficulty select',
      check: ({ root }) => {
        if (!root.querySelector(TERM_INPUT)) return 'thiếu term input'
        if (!root.querySelector('[data-verify-unit="DeckCreatableField"]')) return 'thiếu DeckCreatableField'
        if (!root.querySelector('[data-verify-unit="TopicSelector"]')) return 'thiếu TopicSelector'
        return !!root.querySelector('select[aria-label="Difficulty"]') || 'thiếu difficulty select'
      },
    },
    {
      id: 'submit-saves-pending-entry',
      description: 'Submit thành công: pending entry formType=IT, language=null, config từ session',
      onlyFixtures: ['act-submit-success'],
      check: () => {
        const pending = loadPending()
        if (!pending) return 'không có ankiflow_pending_result trong localStorage'
        if (JSON.stringify(pending.generatedContent) !== JSON.stringify(GENERATED)) {
          return `generatedContent=${JSON.stringify(pending.generatedContent)}`
        }
        if (pending.formType !== FormType.IT) return `formType=${pending.formType}`
        if (pending.language !== null) return `language=${pending.language}`
        if (pending.deckId !== 'd-it') return `deckId=${pending.deckId}`
        return (
          JSON.stringify(pending.tags) === JSON.stringify(['it']) ||
          `tags=${JSON.stringify(pending.tags)}`
        )
      },
    },
    {
      id: 'submit-redirects-to-preview',
      description: 'Submit thành công: router.push("/preview") (vitest)',
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
      description: 'API 500: lỗi hiển thị, không redirect, không pending',
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
      id: 'empty-term-reports-invalid',
      description: 'Term rỗng: onValidityChange cuối là false',
      onlyFixtures: ['probe-empty-term-invalid'],
      check: () =>
        (validitySpy.last === false && validitySpy.sawTrue) ||
        `last=${validitySpy.last}, sawTrue=${validitySpy.sawTrue}`,
    },
  ],
})
