import type { ComponentProps } from 'react'
import { z } from 'zod'
import { DeckCreatableField } from '@/components/create/DeckCreatableField'
import { registerUnit } from '@/verify/core/registry'
import { fn } from '@/verify/core/schema-helpers'
import { FormType } from '@/types'

type DeckCreatableFieldProps = ComponentProps<typeof DeckCreatableField>

const DECKS = [
  {
    id: 'd-ja',
    display_name: 'Japanese',
    anki_deck_name: 'Vocabulary::Japanese',
    form_type: FormType.LANGUAGE,
    language: 'ja',
    is_active: true,
    sort_order: 1,
  },
  {
    id: 'd-en',
    display_name: 'English',
    anki_deck_name: 'Vocabulary::English',
    form_type: FormType.LANGUAGE,
    language: 'en',
    is_active: true,
    sort_order: 2,
  },
  {
    id: 'd-shared',
    display_name: 'Shared Vocabulary',
    anki_deck_name: 'Vocabulary::Shared',
    form_type: FormType.LANGUAGE,
    language: null,
    is_active: true,
    sort_order: 3,
  },
  {
    id: 'd-it',
    display_name: 'IT Terms',
    anki_deck_name: 'Vocabulary::IT',
    form_type: FormType.IT,
    language: null,
    is_active: true,
    sort_order: 4,
  },
]

const CUSTOM_DECK = {
  id: 'd-custom',
  display_name: 'Custom Knowledge',
  anki_deck_name: 'Knowledge::Custom',
  form_type: 'my_custom',
  language: null,
  is_active: true,
  sort_order: 5,
}

const ignoreDeckChange = () => undefined

const EXPECTED_COUNTS: Record<string, number> = {
  'no-filter': 4,
  'filter-ja': 2,
  'filter-custom-formtype': 1,
}

registerUnit<DeckCreatableFieldProps>({
  id: 'DeckCreatableField',
  title: 'DeckCreatableField',
  description: '検証ケース。',
  kind: 'component',
  render: props => <DeckCreatableField {...props} />,
  propsSchema: z.object({
    value: z.string(),
    onChangeId: fn<(deckId: string) => void>(),
    onClear: fn<() => void>().optional(),
    label: z.string().optional(),
    filterFormType: z.string().optional(),
    filterLanguage: z.string().optional(),
    createFormType: z.string(),
    createLanguage: z.string().nullable().optional(),
    fallbackDeckName: z.string().optional(),
  }),
  fixtures: [
    {
      id: 'no-filter',
      description: '検証ケース。',
      props: {
        value: '',
        onChangeId: ignoreDeckChange,
        createFormType: FormType.LANGUAGE,
      },
      mocks: { firestore: { decks: DECKS } },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'filter-ja',
      description: '検証ケース。',
      props: {
        value: '',
        onChangeId: ignoreDeckChange,
        filterFormType: FormType.LANGUAGE,
        filterLanguage: 'ja',
        createFormType: FormType.LANGUAGE,
        createLanguage: 'ja',
      },
      mocks: { firestore: { decks: DECKS } },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'filter-custom-formtype',
      probe: true,
      description: '検証ケース。',
      props: {
        value: '',
        onChangeId: ignoreDeckChange,
        filterFormType: 'my_custom',
        createFormType: 'my_custom',
      },
      mocks: { firestore: { decks: [...DECKS, CUSTOM_DECK] } },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
  ],
  invariants: [
    {
      id: 'filtered-count-matches',
      description: '検証ケース。',
      check: ({ fixture, contract }) => {
        const expected = EXPECTED_COUNTS[fixture.id]
        return contract.count === String(expected)
          || `fixture=${fixture.id}, count=${contract.count}, expected=${expected}`
      },
    },
    {
      id: 'load-completes',
      description: '検証ケース。',
      check: ({ contract }) => contract.loading === 'false' || `loading=${contract.loading}`,
    },
  ],
})
