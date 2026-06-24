import type { ComponentProps } from 'react'
import { z } from 'zod'
import { CardForm } from '@/components/create/CardForm'
import { BUILTIN_BLUEPRINTS } from '@/lib/create/formBlueprint'
import { registerUnit } from '@/verify/core/registry'
import { fn } from '@/verify/core/schema-helpers'
import type { PendingEntry } from '@/lib/pendingEntry'
import { FormType } from '@/types'

type GeneralFormProps = Omit<ComponentProps<typeof CardForm>, 'blueprint'>
const GENERAL_BLUEPRINT = BUILTIN_BLUEPRINTS[FormType.GENERAL]!

const SESSION = JSON.stringify({
  deckId: 'd-gen',
  cardTypeIds: ['ct-basic'],
  tags: ['general'],
})

const FIRESTORE_SEED = { decks: [] }

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

const TITLE_INPUT = 'input[aria-label="Card title"]'

registerUnit<GeneralFormProps>({
  id: 'GeneralForm',
  title: 'GeneralForm',
  description: 'Form kiến thức chung: không gọi API — build content cục bộ rồi lưu pending (vitest-only).',
  kind: 'component',
  render: props => <CardForm blueprint={GENERAL_BLUEPRINT} {...props} />,
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
      description: 'Mount với session — title input, content textarea, DeckSelector, TagInput.',
      props: {},
      mocks: {
        firestore: FIRESTORE_SEED,
        localStorage: { ankiflow_session_form_general: SESSION },
        pathname: '/create',
      },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'act-submit-success',
      description: 'Act: điền title + content rồi submit → pending entry build cục bộ + push /preview.',
      props: {},
      mocks: {
        firestore: FIRESTORE_SEED,
        localStorage: { ankiflow_session_form_general: SESSION },
        pathname: '/create',
      },
      act: async ctx => {
        await ctx.wait(50)
        await ctx.type(TITLE_INPUT, 'Mitochondria')
        await ctx.type('textarea', 'Nhà máy năng lượng của tế bào.')
        submitForm(ctx.root)
        // 300 + 200 + 200ms các bước giả lập tiến độ
        await ctx.wait(900)
      },
    },
    {
      id: 'probe-empty-title-invalid',
      probe: true,
      description: 'Probe: title rỗng → onValidityChange(false).',
      props: { onValidityChange: recordValidity },
      mocks: {
        firestore: FIRESTORE_SEED,
        localStorage: { ankiflow_session_form_general: SESSION },
        pathname: '/create',
      },
      act: async ctx => {
        validitySpy.last = null
        validitySpy.sawTrue = false
        await ctx.wait(50)
        await ctx.type(TITLE_INPUT, 'Some title')
        await ctx.type(TITLE_INPUT, '')
        await ctx.wait(16)
      },
    },
  ],
  invariants: [
    {
      id: 'form-renders-core-fields',
      description: 'Form có title input, content textarea, DeckSelector, TagInput',
      check: ({ root }) => {
        if (!root.querySelector(TITLE_INPUT)) return 'thiếu title input'
        if (!root.querySelector('textarea')) return 'thiếu content textarea'
        if (!root.querySelector('[data-verify-unit="DeckSelector"]')) return 'thiếu DeckSelector'
        return !!root.querySelector('[data-verify-unit="TagInput"]') || 'thiếu TagInput'
      },
    },
    {
      id: 'submit-saves-local-content',
      description: 'Submit: generatedContent build cục bộ (title→word, content→meaning_vi), formType GENERAL',
      onlyFixtures: ['act-submit-success'],
      check: () => {
        const pending = loadPending()
        if (!pending) return 'không có ankiflow_pending_result trong localStorage'
        const c = pending.generatedContent as Record<string, string>
        if (c.title !== 'Mitochondria') return `title=${c.title}`
        if (c.word !== 'Mitochondria') return `word=${c.word}`
        if (c.meaning_vi !== 'Nhà máy năng lượng của tế bào.') return `meaning_vi=${c.meaning_vi}`
        if (pending.formType !== FormType.GENERAL) return `formType=${pending.formType}`
        if (pending.language !== null) return `language=${pending.language}`
        return pending.deckId === 'd-gen' || `deckId=${pending.deckId}`
      },
    },
    {
      id: 'submit-redirects-to-preview',
      description: 'Submit: router.push("/preview") (vitest)',
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
      id: 'empty-title-reports-invalid',
      description: 'Title rỗng: onValidityChange cuối là false',
      onlyFixtures: ['probe-empty-title-invalid'],
      check: () =>
        (validitySpy.last === false && validitySpy.sawTrue) ||
        `last=${validitySpy.last}, sawTrue=${validitySpy.sawTrue}`,
    },
  ],
})
