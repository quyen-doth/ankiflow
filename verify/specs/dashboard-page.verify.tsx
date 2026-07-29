import { z } from 'zod'
import { DashboardContent } from '@/app/dashboard/page'
import { registerUnit } from '@/verify/core/registry'
import { verifyAttrs } from '@/verify/core/contract'
import { FormType } from '@/types'

const MANY_LANGUAGE_CODES = [
  'en', 'ja', 'zh', 'fr', 'de',
  'es', 'it', 'pt', 'ru', 'ko',
  'ar', 'hi', 'nl', 'sv', 'no',
  'da', 'fi', 'pl', 'tr', 'cs',
  'el', 'he', 'id', 'vi', 'th',
]

const MANY_STUDY_LANGUAGES = MANY_LANGUAGE_CODES.map((code, index) => ({
  code,
  display_name: `Study ${code}`,
  enabled: true,
  sort_order: index,
}))

const POPULATED_RESPONSE = {
  stats: {
    total_vocabulary: 120,
    total_cards: 245,
    created_today: 7,
    synced: 90,
  },
  language_counts: [
    { language: 'en', count: 30 },
    { language: 'ja', count: 10 },
  ],
  recent_entries: [
    {
      id: 'entry-dashboard',
      form_type: FormType.LANGUAGE,
      language: 'ja',
      word: '流れ',
      meaning_vi: 'flow',
      status: 'synced',
    },
  ],
}

const EMPTY_RESPONSE = {
  stats: {
    total_vocabulary: 0,
    total_cards: 0,
    created_today: 0,
    synced: 0,
  },
  language_counts: [],
  recent_entries: [],
}

registerUnit<Record<string, never>>({
  id: 'DashboardPage',
  title: 'DashboardPage',
  description: '集約 API を使う Dashboard snapshot flow。',
  kind: 'feature',
  render: () => (
    <div {...verifyAttrs({ unit: 'DashboardPage' })}>
      <DashboardContent navigate={() => {}} />
    </div>
  ),
  propsSchema: z.object({}),
  fixtures: [
    {
      id: 'populated',
      description: 'Aggregate stats、language breakdown、recent summary を表示する。',
      props: {},
      mocks: {
        fetch: [{
          match: '/api/dashboard?',
          response: { json: POPULATED_RESPONSE },
        }],
      },
      act: async ctx => ctx.wait(20),
    },
    {
      id: 'empty',
      description: 'Entry がない場合は empty state を表示する。',
      props: {},
      mocks: {
        fetch: [{
          match: '/api/dashboard?',
          response: { json: EMPTY_RESPONSE },
        }],
      },
      act: async ctx => ctx.wait(20),
    },
    {
      id: 'many-languages',
      description: '20 件を超える有効言語を batch request し、全 count を統合する。',
      props: {},
      mocks: {
        studyLanguages: MANY_STUDY_LANGUAGES,
        fetch: [
          {
            match: /day_end=[^&]+&language=el&language=he/,
            response: {
              json: {
                ...EMPTY_RESPONSE,
                language_counts: MANY_LANGUAGE_CODES.slice(20).map(language => ({
                  language,
                  count: 1,
                })),
              },
            },
          },
          {
            match: '/api/dashboard?',
            response: {
              json: {
                ...EMPTY_RESPONSE,
                language_counts: MANY_LANGUAGE_CODES.slice(0, 20).map(language => ({
                  language,
                  count: 1,
                })),
              },
            },
          },
        ],
      },
      act: async ctx => ctx.wait(50),
    },
    {
      id: 'probe-api-error',
      probe: true,
      description: 'Probe: API error でも spinner に固着せず安全な empty state を表示する。',
      props: {},
      mocks: {
        fetch: [{
          match: '/api/dashboard?',
          response: {
            status: 500,
            json: { error: 'Dashboard unavailable' },
          },
        }],
      },
      act: async ctx => ctx.wait(20),
    },
  ],
  invariants: [
    {
      id: 'aggregate-values-render',
      description: 'API が返した全件ベースの統計を表示する。',
      onlyFixtures: ['populated'],
      check: ({ root }) => {
        const text = root.textContent ?? ''
        for (const value of ['120', '245', '7', '75%']) {
          if (!text.includes(value)) return `stat ${value} が表示されていません`
        }
        return true
      },
    },
    {
      id: 'recent-and-languages-render',
      description: 'recent summary と設定言語の breakdown を表示する。',
      onlyFixtures: ['populated'],
      check: ({ root }) => {
        const text = root.textContent ?? ''
        if (!text.includes('流れ')) return 'recent entry が表示されていません'
        if (!text.includes('English')) return 'English breakdown が表示されていません'
        return text.includes('Japanese') || 'Japanese breakdown が表示されていません'
      },
    },
    {
      id: 'empty-state-renders',
      description: '空または失敗時は empty state を表示し spinner を解除する。',
      onlyFixtures: ['empty', 'probe-api-error'],
      check: ({ root }) => {
        const text = root.textContent ?? ''
        if (!text.includes('No cards yet')) return 'recent empty state が表示されていません'
        if (!text.includes('No language vocabulary yet')) {
          return 'language empty state が表示されていません'
        }
        return !root.querySelector('.animate-spin') || 'spinner が残っています'
      },
    },
    {
      id: 'all-language-batches-render',
      description: '20 件を超える設定でも最初と最後の batch の count をすべて表示する。',
      onlyFixtures: ['many-languages'],
      check: ({ root }) => {
        const text = root.textContent ?? ''
        for (const language of MANY_STUDY_LANGUAGES) {
          if (!text.includes(language.display_name)) {
            return `${language.display_name} が表示されていません`
          }
        }
        return true
      },
    },
  ],
})
