import { useState } from 'react'
import { z } from 'zod'
import PreviewPage from '@/app/preview/page'
import { ValidationBanner } from '@/components/review/ValidationBanner'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import {
  validateCardEntry,
  type CardValidationCardType,
  type InvalidCard,
} from '@/lib/cardValidation'
import { registerUnit } from '@/verify/core/registry'
import { FormType, type Entry } from '@/types'

const CARD_TYPE_ID = 'ct-vi-zh'
const DECK_ID = 'deck-vi-zh'
const PENDING_ENTRY_KEY = 'ankiflow_pending_result'

const ORDINARY_USER = {
  uid: 'test-user',
  email: 'learner@ankiflow.local',
}

const VIETNAMESE_CHINESE_CARD_TYPE: CardValidationCardType = {
  id: CARD_TYPE_ID,
  code: 'vietnamese_to_chinese',
  name: 'Vietnamese → Chinese',
  template: {
    front: ['meaning'],
    back: ['word', 'custom:phon_the'],
  },
}

const FIRESTORE_SEED = {
  decks: [
    {
      id: DECK_ID,
      anki_deck_name: 'Vietnamese - Chinese',
      display_name: 'Vietnamese - Chinese',
      form_type: FormType.LANGUAGE,
      language: 'zh',
      is_active: true,
      sort_order: 1,
    },
  ],
  card_types: [
    {
      id: CARD_TYPE_ID,
      code: VIETNAMESE_CHINESE_CARD_TYPE.code,
      name: VIETNAMESE_CHINESE_CARD_TYPE.name,
      description: 'Recall the Chinese form from its Vietnamese meaning',
      form_type: FormType.LANGUAGE,
      language: 'zh',
      template: VIETNAMESE_CHINESE_CARD_TYPE.template,
      is_active: true,
      sort_order: 1,
    },
  ],
  user_content_types: [
    {
      id: 'language-test-user',
      code: FormType.LANGUAGE,
      name: 'Language',
      description: 'Language vocabulary',
      icon: 'Languages',
      fields: [
        {
          field_key: 'phon_the',
          label: 'Traditional form',
          type: 'text',
          is_required: false,
          sort_order: 1,
        },
      ],
      ai_output_profiles: [
        {
          profile: 'zh',
          fields: [
            {
              key: 'phon_the',
              type: 'string',
              instruction: 'Return the Traditional Chinese form.',
            },
          ],
        },
      ],
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

function pendingEntry(
  includeTraditionalForm: boolean,
  language = 'zh',
  cardTypeIds = [CARD_TYPE_ID],
): string {
  return JSON.stringify({
    generatedContent: {
      word: '吃饭',
      meaning_vi: 'ăn cơm',
      ...(includeTraditionalForm ? { phon_the: '吃飯' } : {}),
    },
    formType: FormType.LANGUAGE,
    language,
    outputLanguage: 'vi',
    deckId: DECK_ID,
    cardTypeIds,
    tags: [],
    savedAt: '2026-07-23T00:00:00.000Z',
  })
}

function findExportButton(root: HTMLElement): HTMLButtonElement {
  const button = Array.from(root.querySelectorAll<HTMLButtonElement>('button'))
    .find(candidate => candidate.textContent?.includes('Save & Export'))
  if (!button) throw new Error('Save & Export button が見つかりません')
  return button
}

function hasConfirmationModal(root: HTMLElement): boolean {
  return Array.from(root.querySelectorAll('h2'))
    .some(heading => heading.textContent?.trim() === 'Save & Export to Anki')
}

interface BrowserHarnessProps {
  phonThe: string
  customOnlyBack: boolean
}

function PreviewValidationBrowserHarness({ phonThe, customOnlyBack }: BrowserHarnessProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [invalid, setInvalid] = useState<InvalidCard[]>([])
  const entry = {
    form_type: FormType.LANGUAGE,
    language: 'zh',
    word: '吃饭',
    meaning_vi: 'ăn cơm',
    phon_the: phonThe,
    anki_deck: 'Vietnamese - Chinese',
  } as Partial<Entry> & Record<string, unknown>
  const cardType = customOnlyBack
    ? {
        ...VIETNAMESE_CHINESE_CARD_TYPE,
        template: {
          front: ['meaning'],
          back: ['custom:phon_the'],
        },
      } satisfies CardValidationCardType
    : VIETNAMESE_CHINESE_CARD_TYPE

  const requestConfirm = () => {
    const errors = validateCardEntry(entry, [CARD_TYPE_ID], [cardType])
    if (errors.length > 0) {
      setInvalid([{ index: 0, errors }])
      return
    }
    setInvalid([])
    setConfirmOpen(true)
  }

  return (
    <div>
      <Button variant="primary" onClick={requestConfirm}>Save & Export</Button>
      {invalid.length > 0 && (
        <ValidationBanner invalid={invalid} onJump={() => {}} singleCard />
      )}
      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Save & Export to Anki"
      >
        <Button variant="primary">Confirm</Button>
      </Modal>
    </div>
  )
}

async function requestExport(root: HTMLElement, wait: (ms: number) => Promise<void>): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const button = findExportButton(root)
    if (!button.disabled) {
      button.click()
      await wait(20)
      return
    }
    await wait(20)
  }
  throw new Error('Anki 接続後も Save & Export button が有効になりません')
}

registerUnit<Record<string, never>>({
  id: 'PreviewCardValidation',
  title: 'Preview Card Type validation',
  description: '選択 Card Type の template で Preview の保存可否を検証する。',
  kind: 'feature',
  render: () => <PreviewPage />,
  propsSchema: z.object({}),
  fixtures: [
    {
      id: 'ordinary-user-custom-field',
      description: '一般 user は generic zh Card Type を zh-TW entry でも確認できる。',
      props: {},
      mocks: {
        auth: { user: ORDINARY_USER },
        firestore: FIRESTORE_SEED,
        localStorage: { [PENDING_ENTRY_KEY]: pendingEntry(true, 'zh-TW') },
        pathname: '/preview',
        fetch: [
          { match: 'localhost:8765', response: { json: { result: 6, error: null } } },
          { match: '/api/image', response: { json: { images: [] } } },
          { match: '/api/audio/generate', response: { json: { base64: '' } } },
        ],
      },
      act: async ctx => {
        await ctx.wait(100)
        await requestExport(ctx.root, ctx.wait)
      },
    },
    {
      id: 'probe-empty-custom-field-side',
      probe: true,
      description: 'Card Type の Back が空の場合は確認 modal を開かず validation error を表示する。',
      props: {},
      mocks: {
        auth: { user: ORDINARY_USER },
        firestore: {
          ...FIRESTORE_SEED,
          card_types: [{
            ...FIRESTORE_SEED.card_types[0],
            template: {
              front: ['meaning'],
              back: ['custom:phon_the'],
            },
          }],
        },
        localStorage: { [PENDING_ENTRY_KEY]: pendingEntry(false) },
        pathname: '/preview',
        fetch: [
          { match: 'localhost:8765', response: { json: { result: 6, error: null } } },
          { match: '/api/image', response: { json: { images: [] } } },
          { match: '/api/audio/generate', response: { json: { base64: '' } } },
        ],
      },
      act: async ctx => {
        await ctx.wait(100)
        await requestExport(ctx.root, ctx.wait)
      },
    },
    {
      id: 'stale-card-type-is-reported',
      description: '保存済み selected ID が利用不能なら drop せず明示的な validation error を表示する。',
      props: {},
      mocks: {
        auth: { user: ORDINARY_USER },
        firestore: FIRESTORE_SEED,
        localStorage: {
          [PENDING_ENTRY_KEY]: pendingEntry(true, 'zh-TW', ['deleted-card-type']),
        },
        pathname: '/preview',
        fetch: [
          { match: 'localhost:8765', response: { json: { result: 6, error: null } } },
          { match: '/api/image', response: { json: { images: [] } } },
          { match: '/api/audio/generate', response: { json: { base64: '' } } },
        ],
      },
      act: async ctx => {
        await ctx.wait(100)
        await requestExport(ctx.root, ctx.wait)
      },
    },
  ],
  invariants: [
    {
      id: 'custom-field-allows-confirmation',
      description: 'phon_the があれば旧 Language 必須 field がなくても確認 modal を開く。',
      onlyFixtures: ['ordinary-user-custom-field'],
      check: ({ root }) => {
        if (root.querySelector('[role="alert"]')) return 'validation banner が表示されました'
        return hasConfirmationModal(root) || '確認 modal が表示されていません'
      },
    },
    {
      id: 'empty-template-side-is-blocked',
      description: 'custom field が空の Back は Card Type 名付きで error になる。',
      onlyFixtures: ['probe-empty-custom-field-side'],
      check: ({ root }) => {
        const text = root.textContent ?? ''
        if (hasConfirmationModal(root)) return '確認 modal が開きました'
        return (
          text.includes('Vietnamese → Chinese: Back has no content')
          || `validation error=${text.slice(0, 300)}`
        )
      },
    },
    {
      id: 'stale-selection-is-not-silent',
      description: '利用不能な Card Type ID と recovery action を表示する。',
      onlyFixtures: ['stale-card-type-is-reported'],
      check: ({ root }) => {
        const text = root.textContent ?? ''
        if (!text.includes('Selected card type is unavailable')) {
          return 'unavailable validation error が表示されていません'
        }
        return text.includes('Remove unavailable') || 'recovery action が表示されていません'
      },
    },
  ],
})

registerUnit<BrowserHarnessProps>({
  id: 'PreviewCardValidationBrowser',
  title: 'Preview Card Type validation browser control',
  description: 'Firestore に依存せず Preview の確認 guard を browser で検証する。',
  kind: 'feature',
  render: props => <PreviewValidationBrowserHarness {...props} />,
  propsSchema: z.object({ phonThe: z.string(), customOnlyBack: z.boolean() }),
  fixtures: [
    {
      id: 'custom-field-allows-confirmation',
      description: 'custom:phon_the に値がある場合は確認 modal を開く。',
      props: { phonThe: '吃飯', customOnlyBack: false },
      act: async ctx => {
        findExportButton(ctx.root).click()
        await ctx.wait(20)
      },
    },
    {
      id: 'probe-empty-custom-field-side',
      probe: true,
      description: 'custom:phon_the が空の Back は確認 modal の前に停止する。',
      props: { phonThe: '', customOnlyBack: true },
      act: async ctx => {
        findExportButton(ctx.root).click()
        await ctx.wait(20)
      },
    },
  ],
  invariants: [
    {
      id: 'valid-template-opens-modal',
      description: 'Card Type の両 side に content があれば確認 modal を開く。',
      onlyFixtures: ['custom-field-allows-confirmation'],
      check: ({ root }) => hasConfirmationModal(root) || '確認 modal が表示されていません',
    },
    {
      id: 'empty-side-shows-validation',
      description: 'Card Type 名と空の side を validation banner に表示する。',
      onlyFixtures: ['probe-empty-custom-field-side'],
      check: ({ root }) => (
        (root.textContent ?? '').includes('Vietnamese → Chinese: Back has no content')
        || 'validation error が表示されていません'
      ),
    },
  ],
})
