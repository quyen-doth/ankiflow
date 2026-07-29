import { z } from 'zod'
import { FlashcardReviewLayout } from '@/components/review/FlashcardReviewLayout'
import { verifyAttrs } from '@/verify/core/contract'
import { registerUnit } from '@/verify/core/registry'

interface ReviewLanguageFieldsHarnessProps {
  studyLanguage: 'en' | 'zh' | 'ja'
  outputLanguage?: 'vi' | 'ja'
}

const noop = () => undefined

function ReviewLanguageFieldsHarness({
  studyLanguage,
  outputLanguage,
}: ReviewLanguageFieldsHarnessProps) {
  return (
    <div {...verifyAttrs({
      unit: 'ReviewLanguageFields',
      studyLanguage,
      outputLanguage: outputLanguage ?? 'legacy',
    })}>
      <FlashcardReviewLayout
        headerLabel="Review"
        headerActions={null}
        entry={{
          language: studyLanguage,
          output_language: outputLanguage,
          word: '昂贵',
          pinyin: 'ángguì',
        }}
        updateField={noop}
        images={[]}
        imageLoading={false}
        onImageSelect={noop}
        onImageUpload={noop}
        onImageRefetch={noop}
        audioUrl={null}
        audioLoading={false}
        onAudioRegenerate={noop}
        audioExampleUrl={null}
        audioExampleLoading={false}
        onAudioExampleRegenerate={noop}
        usesExampleAudio={false}
        selectedDeckId=""
        onDeckChange={noop}
        cardTypes={[]}
        selectedCardTypeIds={[]}
        onCardTypesChange={noop}
      />
    </div>
  )
}

registerUnit<ReviewLanguageFieldsHarnessProps>({
  id: 'ReviewLanguageFields',
  title: 'Review language fields',
  description: 'AI output language に応じて言語固有 field の表示を切り替える。',
  kind: 'feature',
  render: props => <ReviewLanguageFieldsHarness {...props} />,
  propsSchema: z.object({
    studyLanguage: z.enum(['en', 'zh', 'ja']),
    outputLanguage: z.enum(['vi', 'ja']).optional(),
  }),
  fixtures: [
    {
      id: 'non-vietnamese-output',
      probe: true,
      description: 'Chinese study + Japanese output では Hán-Việt field を表示しない。',
      props: { studyLanguage: 'zh', outputLanguage: 'ja' },
      mocks: { auth: { user: null } },
    },
    {
      id: 'vietnamese-output',
      description: 'Chinese study + Vietnamese output では Hán-Việt field を表示する。',
      props: { studyLanguage: 'zh', outputLanguage: 'vi' },
      mocks: { auth: { user: null } },
    },
    {
      id: 'legacy-output',
      description: 'output language がない legacy entry は Vietnamese として扱う。',
      props: { studyLanguage: 'zh' },
      mocks: { auth: { user: null } },
    },
    {
      id: 'non-sino-study-language',
      description: 'Vietnamese output でも English study には Hán-Việt field を表示しない。',
      props: { studyLanguage: 'en', outputLanguage: 'vi' },
      mocks: { auth: { user: null } },
    },
  ],
  invariants: [
    {
      id: 'non-vietnamese-output-hides-han-viet',
      description: 'Japanese output では Hán-Việt placeholder を描画しない',
      onlyFixtures: ['non-vietnamese-output'],
      check: ({ root }) => (
        !root.querySelector('[data-testid="han-viet-field"]')
        && !(root.textContent ?? '').includes('Sino-Vietnamese reading')
      ) || 'Japanese output に Hán-Việt field が表示されています',
    },
    {
      id: 'vietnamese-and-legacy-output-show-han-viet',
      description: 'Vietnamese output と legacy entry は Hán-Việt field を表示する',
      onlyFixtures: ['vietnamese-output', 'legacy-output'],
      check: ({ root }) => (
        Boolean(root.querySelector('[data-testid="han-viet-field"]'))
        && (root.textContent ?? '').includes('Sino-Vietnamese reading')
      ) || 'Vietnamese output の Hán-Việt field がありません',
    },
    {
      id: 'study-language-gate-remains',
      description: 'Chinese/Japanese 以外の study language には Hán-Việt field を表示しない',
      onlyFixtures: ['non-sino-study-language'],
      check: ({ root }) => (
        !root.querySelector('[data-testid="han-viet-field"]')
      ) || 'English study に Hán-Việt field が表示されています',
    },
  ],
})
