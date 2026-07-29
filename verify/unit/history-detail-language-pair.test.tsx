import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FormType } from '@/types'

interface CapturedCardType {
  id: string;
  name: string;
}

const {
  paramsState,
  capturedState,
  authUser,
  languages,
} = vi.hoisted(() => ({
  paramsState: { id: 'entry-1' },
  capturedState: {
    cardTypes: [] as CapturedCardType[],
    selectedCardTypeIds: [] as string[],
  },
  authUser: { uid: 'uid-1', email: 'user@example.test' },
  languages: [
    { code: 'zh', display_name: 'Chinese', enabled: true, sort_order: 0 },
    { code: 'ja', display_name: 'Japanese', enabled: true, sort_order: 1 },
    { code: 'vi', display_name: 'Vietnamese', enabled: true, sort_order: 2 },
  ],
}))

vi.mock('next/navigation', () => ({
  useParams: () => paramsState,
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/components/providers/AuthProvider', () => ({
  useAuth: () => ({
    user: authUser,
    loading: false,
  }),
}))

vi.mock('@/components/providers/StudyLanguageProvider', () => ({
  useStudyLanguages: () => ({
    languages,
    loading: false,
  }),
}))

vi.mock('@/components/review/FlashcardReviewLayout', () => ({
  FlashcardReviewLayout: ({
    cardTypes,
    selectedCardTypeIds,
  }: {
    cardTypes: CapturedCardType[];
    selectedCardTypeIds: string[];
  }) => {
    capturedState.cardTypes = cardTypes
    capturedState.selectedCardTypeIds = selectedCardTypeIds
    return <div>{cardTypes.map(cardType => cardType.name).join(' | ')}</div>
  },
}))

vi.mock('@/hooks/useEntryEdit', () => ({
  useEntryEdit: () => ({ saveEntry: vi.fn() }),
}))

vi.mock('@/hooks/useCardMedia', () => ({
  useCardMedia: () => ({
    images: [],
    imageLoading: false,
    handleImageSelect: vi.fn(),
    handleImageUpload: vi.fn(),
    fetchImages: vi.fn(),
    audioUrl: '',
    audioLoading: false,
    generateAudio: vi.fn(),
    audioExampleUrl: '',
    audioExampleLoading: false,
    generateExampleAudio: vi.fn(),
  }),
}))

vi.mock('@/components/ui/Toast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
}))

vi.mock('@/lib/userContentTypes', () => ({
  loadUserContentTypes: vi.fn(async () => []),
}))

import HistoryDetailPage from '@/app/history/[id]/page'

interface FirestoreSeed {
  [collection: string]: Array<Record<string, unknown> & { id: string }>;
}

function seedFirestore(seed: FirestoreSeed): void {
  const globals = globalThis as unknown as {
    __verifyFirestoreSeed?: (data: FirestoreSeed) => void;
  }
  globals.__verifyFirestoreSeed?.(seed)
}

function entry(outputLanguage?: string): Record<string, unknown> & { id: string } {
  return {
    id: 'entry-1',
    user_id: 'uid-1',
    form_type: FormType.LANGUAGE,
    language: 'zh',
    ...(outputLanguage ? { output_language: outputLanguage } : {}),
    word: '学习',
    meaning_vi: 'học tập',
    anki_deck: 'Language',
    card_type_ids: [outputLanguage === 'ja' ? 'ct-ja' : 'ct-vi'],
  }
}

const cardTypes = [
  {
    id: 'ct-ja',
    user_id: 'uid-1',
    form_type: FormType.LANGUAGE,
    language: 'zh',
    output_language: 'ja',
    name: '{study_language} → {output_language}',
    is_active: true,
    is_default: false,
    sort_order: 1,
  },
  {
    id: 'ct-vi',
    user_id: 'uid-1',
    form_type: FormType.LANGUAGE,
    language: 'zh',
    output_language: 'vi',
    name: '{study_language} → {output_language}',
    is_active: true,
    is_default: false,
    sort_order: 2,
  },
]

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
    await new Promise(resolve => setTimeout(resolve, 0))
  })
}

describe('History detail Card Type language pair', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    ;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    capturedState.cardTypes = []
    capturedState.selectedCardTypeIds = []
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  it('保存済み output language で Card Type を絞り、動的 name を解決する', async () => {
    seedFirestore({
      entries: [entry('ja')],
      card_types: cardTypes,
      user_content_types: [],
    })

    await act(async () => root.render(<HistoryDetailPage />))
    await flush()

    expect(capturedState.cardTypes).toEqual([
      { id: 'ct-ja', name: 'Chinese → Japanese' },
    ])
    expect(capturedState.selectedCardTypeIds).toEqual(['ct-ja'])
    expect(container.textContent).not.toContain('Chinese → Vietnamese')
  })

  it('legacy Entry の output language は Vietnamese として扱う', async () => {
    seedFirestore({
      entries: [entry()],
      card_types: cardTypes,
      user_content_types: [],
    })

    await act(async () => root.render(<HistoryDetailPage />))
    await flush()

    expect(capturedState.cardTypes).toEqual([
      { id: 'ct-vi', name: 'Chinese → Vietnamese' },
    ])
    expect(capturedState.selectedCardTypeIds).toEqual(['ct-vi'])
    expect(container.textContent).not.toContain('Chinese → Japanese')
  })
})
