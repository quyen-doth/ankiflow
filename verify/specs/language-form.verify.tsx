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

// 学習言語が未選択の session — detect が値を埋める経路だけがこれを使う。
const SESSION_NO_LANGUAGE = JSON.stringify({
  language: '',
  deckId: 'd-en',
  categoryId: 'c-life',
  cardTypeIds: ['ct-en'],
  tags: ['vocab'],
})

// 学習言語が日本語の session — 漢字入力で AI 呼び出しが不要になる経路の検証用。
const SESSION_JA = JSON.stringify({
  language: 'ja',
  deckId: 'd-ja',
  categoryId: 'c-life',
  cardTypeIds: ['ct-ja'],
  tags: ['vocab'],
})

const FIRESTORE_SEED = {
  decks: [],
  categories: [],
  card_types: [
    {
      id: 'ct-en',
      form_type: FormType.LANGUAGE,
      language: 'en',
      output_language: null,
      name: 'English card',
      is_active: true,
      sort_order: 1,
    },
    {
      id: 'ct-ja',
      form_type: FormType.LANGUAGE,
      language: 'ja',
      output_language: null,
      name: 'Japanese card',
      is_active: true,
      sort_order: 2,
    },
  ],
}
const DETECT_FR = {
  detections: [{ index: 0, code: 'fr', display_name: 'French', confidence: 0.91 }],
}

// 入力がすでに学習言語 → 変換なし。
const RESOLVE_UNCHANGED = {
  resolutions: [{ index: 0, resolved_term: 'serendipity', source_language: 'en', was_translated: false }],
}
// 入力が別言語 → 学習言語 (英語) の語へ変換。
const RESOLVE_TRANSLATED = {
  resolutions: [{ index: 0, resolved_term: 'cat', source_language: 'ja', was_translated: true }],
}
const RESOLVE_MIXED_BATCH = {
  resolutions: [
    { index: 0, resolved_term: 'cat', source_language: 'en', was_translated: false },
    { index: 1, resolved_term: 'cat', source_language: 'ja', was_translated: true },
  ],
}

// onValidityChange 用 spy — act 内で reset
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

function loadPendingBatch(): { language?: string | null; items: unknown[] } | null {
  const raw = localStorage.getItem('ankiflow_pending_batch')
  return raw ? (JSON.parse(raw) as { language?: string | null; items: unknown[] }) : null
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
          { match: '/api/languages/resolve-terms', response: { status: 200, json: RESOLVE_UNCHANGED } },
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
          { match: '/api/languages/resolve-terms', response: { status: 200, json: RESOLVE_UNCHANGED } },
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
      id: 'act-selected-language-wins',
      description:
        '選択済みの学習言語 (en) は入力の言語で上書きされず、入力側が英語へ変換される。',
      props: {},
      mocks: {
        firestore: FIRESTORE_SEED,
        localStorage: { ankiflow_session_form_language: SESSION },
        pathname: '/create',
        // detect を mock しない = 呼ばれたら unmatched URL で失敗する (呼ばれないことの検証)。
        fetch: [
          { match: '/api/languages/resolve-terms', response: { status: 200, json: RESOLVE_TRANSLATED } },
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
      id: 'act-script-compatible-skips-ai',
      description:
        '漢字だけの語 + 学習言語 ja → detect も resolve も呼ばず、そのまま生成する (冪等性 の回帰)。',
      props: {},
      mocks: {
        firestore: FIRESTORE_SEED,
        localStorage: { ankiflow_session_form_language: SESSION_JA },
        pathname: '/create',
        // detect / resolve は意図的に mock しない — 呼ばれたら失敗する。
        fetch: [
          { match: '/api/generate', response: { status: 200, json: { content: GENERATED } } },
        ],
      },
      act: async ctx => {
        await ctx.wait(50)
        await ctx.type('input[aria-label="Vocabulary item"]', '冪等性')
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
      description: '学習言語が未選択のときだけ detect が走り、未設定言語は user 確認を求める。',
      props: {},
      mocks: {
        firestore: FIRESTORE_SEED,
        localStorage: { ankiflow_session_form_language: SESSION_NO_LANGUAGE },
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
      id: 'act-resolution-error-uses-input',
      description: 'term 変換が失敗しても生成は止めず、入力そのままと選択済み言語で続行する。',
      props: {},
      mocks: {
        firestore: FIRESTORE_SEED,
        localStorage: { ankiflow_session_form_language: SESSION },
        pathname: '/create',
        fetch: [
          { match: '/api/languages/resolve-terms', response: { status: 503, json: { error: 'Resolver unavailable' } } },
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
      id: 'act-mixed-batch-converges',
      description: '言語が混ざった batch も学習言語へ揃えられ、ブロックされない。',
      props: { batchMode: true },
      mocks: {
        firestore: FIRESTORE_SEED,
        localStorage: { ankiflow_session_form_language: SESSION },
        pathname: '/create',
        fetch: [
          { match: '/api/languages/resolve-terms', response: { status: 200, json: RESOLVE_MIXED_BATCH } },
          { match: '/api/generate', response: { status: 200, json: { content: GENERATED } } },
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
        await ctx.wait(1100)
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
      id: 'selected-language-wins-over-input',
      description:
        '選択済みの学習言語が正 — 入力が別言語でも language は変わらず、deck/cardType も維持される。',
      onlyFixtures: ['act-selected-language-wins'],
      check: () => {
        const pending = loadPending()
        if (!pending) return '対象がありません'
        if (pending.language !== 'en') return `language=${pending.language}`
        // 言語が変わらない = config reset も起きない。
        if (pending.deckId !== 'd-en') return `deckId=${pending.deckId}`
        return JSON.stringify(pending.cardTypeIds) === JSON.stringify(['ct-en'])
          || `cardTypeIds=${JSON.stringify(pending.cardTypeIds)}`
      },
    },
    {
      id: 'script-compatible-input-skips-ai-calls',
      description:
        '漢字だけの語 + 学習言語 ja は AI を呼ばずに生成へ進む (detect/resolve が呼ばれると mock が失敗する)。',
      onlyFixtures: ['act-script-compatible-skips-ai'],
      check: ({ contract }) => {
        if (contract.error === 'true') return 'AI 呼び出しが発生しています'
        const pending = loadPending()
        if (!pending) return '対象がありません'
        if (pending.language !== 'ja') return `language=${pending.language}`
        return pending.deckId === 'd-ja' || `deckId=${pending.deckId}`
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
      id: 'resolution-error-does-not-block-generation',
      description: 'term 変換の失敗は生成をブロックせず、選択済み言語と設定を維持する。',
      onlyFixtures: ['act-resolution-error-uses-input'],
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
      id: 'mixed-batch-converges-to-study-language',
      description: '言語が混ざった batch もブロックされず、学習言語で pending batch を作る。',
      onlyFixtures: ['act-mixed-batch-converges'],
      check: ({ contract }) => {
        if (contract.error === 'true') return 'mixed batch がブロックされています'
        const batch = loadPendingBatch()
        if (!batch) return '対象がありません'
        if (batch.language !== 'en') return `language=${batch.language}`
        return batch.items.length === 2 || `items=${batch.items.length}`
      },
    },
  ],
})
