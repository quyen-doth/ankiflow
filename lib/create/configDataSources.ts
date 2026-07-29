import type { FormFieldConfig } from '@/types'

export type SystemDataSourceControlKind =
  | 'language'
  | 'outputLanguage'
  | 'deck'
  | 'category'
  | 'cardTypes'
  | 'topic'

export interface SystemDataSourceDefinition {
  value: string
  label: string
  kind: SystemDataSourceControlKind
  types: FormFieldConfig['type'][]
  suggestedFieldKey: string
  suggestedFieldLabel: string
}

/**
 * Content Type の system data source を editor と Create runtime で共有する。
 * Content Type code/form_type ごとの分岐はここにも置かない。
 */
export const SYSTEM_DATA_SOURCE_DEFINITIONS: readonly SystemDataSourceDefinition[] = [
  {
    value: 'study_languages',
    label: 'Study languages',
    kind: 'language',
    types: ['dropdown'],
    suggestedFieldKey: 'language',
    suggestedFieldLabel: 'Study language',
  },
  {
    value: 'output_languages',
    label: 'AI output languages',
    kind: 'outputLanguage',
    types: ['dropdown'],
    suggestedFieldKey: 'output_language',
    suggestedFieldLabel: 'AI output language',
  },
  {
    value: 'decks',
    label: 'Decks',
    kind: 'deck',
    types: ['dropdown'],
    suggestedFieldKey: 'anki_deck',
    suggestedFieldLabel: 'Anki Deck',
  },
  {
    value: 'categories',
    label: 'Categories',
    kind: 'category',
    types: ['dropdown'],
    suggestedFieldKey: 'category_id',
    suggestedFieldLabel: 'Category',
  },
  {
    value: 'card_types',
    label: 'Card types',
    kind: 'cardTypes',
    types: ['checkbox_group'],
    suggestedFieldKey: 'card_type_ids',
    suggestedFieldLabel: 'Card types',
  },
  {
    value: 'topics',
    label: 'Topics',
    kind: 'topic',
    types: ['checkbox_group'],
    suggestedFieldKey: 'topic_ids',
    suggestedFieldLabel: 'Topics',
  },
]

export function getSystemDataSourceDefinition(
  value: string | null | undefined,
): SystemDataSourceDefinition | undefined {
  const normalized = value?.trim()
  if (!normalized) return undefined
  return SYSTEM_DATA_SOURCE_DEFINITIONS.find(definition => definition.value === normalized)
}
