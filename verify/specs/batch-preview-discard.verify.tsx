import { z } from 'zod'
import BatchPreviewPage from '@/app/preview/batch/page'
import { registerUnit } from '@/verify/core/registry'
import { FormType } from '@/types'

const CARD_TYPE_ID = 'ct-general'
const DECK_ID = 'deck-general'
const PENDING_BATCH_KEY = 'ankiflow_pending_batch'

const FIRESTORE_SEED = {
  decks: [
    {
      id: DECK_ID,
      anki_deck_name: 'General',
      display_name: 'General',
      form_type: FormType.GENERAL,
      default_card_type_ids: [CARD_TYPE_ID],
      is_active: true,
      sort_order: 1,
    },
  ],
  card_types: [
    {
      id: CARD_TYPE_ID,
      code: 'title_to_content',
      name: 'Title → Content',
      description: 'Review the content from its title',
      form_type: FormType.GENERAL,
      template: {
        front: ['word'],
        back: ['meaning'],
      },
      is_default: true,
      is_active: true,
      sort_order: 1,
    },
  ],
  user_content_types: [
    {
      id: 'form-general-test-user',
      code: FormType.GENERAL,
      name: 'General',
      description: 'General knowledge',
      icon: 'BookOpen',
      fields: [],
      is_active: true,
      sort_order: 1,
    },
  ],
  settings: [
    {
      id: 'test-user',
      tts_enabled: false,
      unsplash_enabled: false,
    },
  ],
}

function pendingBatch(firstContent: string): string {
  return JSON.stringify({
    items: [
      { title: 'Alpha', content: firstContent, audio_url: 'data:audio/mp3;base64,QQ==' },
      { title: 'Beta', content: 'Beta content', audio_url: 'data:audio/mp3;base64,Qg==' },
      { title: 'Gamma', content: 'Gamma content', audio_url: 'data:audio/mp3;base64,Rw==' },
    ],
    formType: FormType.GENERAL,
    deckId: DECK_ID,
    cardTypeIds: [CARD_TYPE_ID],
    tags: [],
    savedAt: '2026-07-22T00:00:00.000Z',
  })
}

function findButton(root: HTMLElement, label: string, occurrence = 0): HTMLButtonElement {
  const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('button'))
    .filter(button => button.textContent?.trim() === label)
  const button = buttons[occurrence]
  if (!button) throw new Error(`ボタン「${label}」(${occurrence + 1} 件目) が見つかりません`)
  return button
}

async function discardCard(root: HTMLElement, wait: (ms: number) => Promise<void>, cardNumber = 1): Promise<void> {
  // chip 内の × (span[role=button]) → 確認 modal の Discard ボタン。
  const x = root.querySelector<HTMLElement>(`[role="button"][aria-label="Discard card ${cardNumber}"]`)
  if (!x) throw new Error(`Chip の × (Discard card ${cardNumber}) が見つかりません`)
  x.click()
  await wait(20)
  findButton(root, 'Discard').click()
  await wait(20)
}

const validationFlow = { bannerWasVisible: false }

registerUnit<Record<string, never>>({
  id: 'BatchPreviewDiscard',
  title: 'Batch preview discard',
  description: 'Batch preview で現在のカードだけを確認後に破棄する。',
  kind: 'feature',
  render: () => <BatchPreviewPage />,
  propsSchema: z.object({}),
  fixtures: [
    {
      id: 'discard-first-card',
      description: '3 件の先頭を破棄すると次のカードを表示し、保存件数を 2 件へ更新する。',
      props: {},
      mocks: {
        firestore: FIRESTORE_SEED,
        localStorage: { [PENDING_BATCH_KEY]: pendingBatch('Alpha content') },
        pathname: '/preview/batch',
        fetch: [
          { match: 'localhost:8765', response: { json: { result: 6, error: null } } },
        ],
      },
      act: async ctx => {
        await ctx.wait(100)
        await discardCard(ctx.root, ctx.wait)
      },
    },
    {
      id: 'discard-nonactive-card',
      description: '表示中でない 3 件目を chip の × から破棄しても表示中カードは変わらない。',
      props: {},
      mocks: {
        firestore: FIRESTORE_SEED,
        localStorage: { [PENDING_BATCH_KEY]: pendingBatch('Alpha content') },
        pathname: '/preview/batch',
        fetch: [
          { match: 'localhost:8765', response: { json: { result: 6, error: null } } },
        ],
      },
      act: async ctx => {
        await ctx.wait(100)
        await discardCard(ctx.root, ctx.wait, 3)
      },
    },
    {
      id: 'probe-clears-validation-banner',
      probe: true,
      description: 'Validation error のカードを破棄すると index ベースの古い banner を消去する。',
      props: {},
      mocks: {
        firestore: FIRESTORE_SEED,
        localStorage: { [PENDING_BATCH_KEY]: pendingBatch('') },
        pathname: '/preview/batch',
        fetch: [
          { match: 'localhost:8765', response: { json: { result: 6, error: null } } },
        ],
      },
      act: async ctx => {
        validationFlow.bannerWasVisible = false
        await ctx.wait(100)
        findButton(ctx.root, 'Save all (3)').click()
        await ctx.wait(20)
        validationFlow.bannerWasVisible = ctx.root.querySelector('[role="alert"]') !== null
        await discardCard(ctx.root, ctx.wait)
      },
    },
  ],
  invariants: [
    {
      id: 'discard-updates-batch-and-shows-next-card',
      description: '破棄後は件数が 2 になり、元の 2 件目を新しい先頭として表示する。',
      onlyFixtures: ['discard-first-card', 'probe-clears-validation-banner'],
      check: ({ root }) => {
        const text = root.textContent ?? ''
        const firstTab = root.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]')
        return (
          text.includes('Save all (2)')
          && text.includes('Save & Export (2)')
          && text.includes('Reviewing card 1 of 2')
          && firstTab?.getAttribute('aria-label') === 'Card 1: Beta'
          && !text.includes('Discard this card?')
        ) || `text=${text.slice(0, 300)}, active=${firstTab?.getAttribute('aria-label')}`
      },
    },
    {
      id: 'discard-nonactive-keeps-current-card',
      description: '表示中でないカードの破棄後も表示中カード (Alpha) を維持する。',
      onlyFixtures: ['discard-nonactive-card'],
      check: ({ root }) => {
        const text = root.textContent ?? ''
        const activeTab = root.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]')
        return (
          text.includes('Save all (2)')
          && text.includes('Reviewing card 1 of 2')
          && activeTab?.getAttribute('aria-label') === 'Card 1: Alpha'
          && !text.includes('Gamma')
        ) || `text=${text.slice(0, 300)}, active=${activeTab?.getAttribute('aria-label')}`
      },
    },
    {
      id: 'discard-clears-stale-validation',
      description: 'ValidationBanner が表示された後の破棄で banner を消去する。',
      onlyFixtures: ['probe-clears-validation-banner'],
      check: ({ root }) => (
        validationFlow.bannerWasVisible && root.querySelector('[role="alert"]') === null
      ) || `before=${validationFlow.bannerWasVisible}, after=${root.querySelector('[role="alert"]') !== null}`,
    },
  ],
})
