import type { ComponentProps } from 'react'
import { z } from 'zod'
import { LanguagePicker } from '@/components/ui/LanguagePicker'
import { registerUnit } from '@/verify/core/registry'
import { fn } from '@/verify/core/schema-helpers'
import type { CatalogLanguage } from '@/lib/languageCatalog'

type LanguagePickerProps = ComponentProps<typeof LanguagePicker>

const changeSpy = { count: 0, lastValue: null as CatalogLanguage | null }
const recordChange = (language: CatalogLanguage) => {
  changeSpy.count++
  changeSpy.lastValue = language
}
const noop = () => undefined

function resetSpy(): void {
  changeSpy.count = 0
  changeSpy.lastValue = null
}

registerUnit<LanguagePickerProps>({
  id: 'LanguagePicker',
  title: 'LanguagePicker',
  description: '検証ケース。',
  kind: 'component',
  render: props => <LanguagePicker {...props} />,
  propsSchema: z.object({
    value: z.string().nullable(),
    onChange: fn<(language: CatalogLanguage) => void>(),
    placeholder: z.string().optional(),
    excludeCodes: z.array(z.string()).optional(),
  }),
  fixtures: [
    {
      id: 'selected',
      description: '検証ケース。',
      props: { value: 'fr', onChange: noop },
    },
    {
      id: 'act-search-french',
      description: 'Act: "fre" を検索して French を選択する。',
      props: { value: null, onChange: recordChange },
      act: async ctx => {
        resetSpy()
        await ctx.type('input[role="combobox"]', 'fre')
        await ctx.click('[role="option"][data-language-code="fr"]')
        await ctx.wait(16)
      },
    },
    {
      id: 'act-custom-code',
      description: '検証ケース。',
      props: { value: null, onChange: recordChange },
      act: async ctx => {
        resetSpy()
        await ctx.type('input[role="combobox"]', 'pt-br')
        await ctx.click('[data-language-picker-custom="true"]')
        await ctx.wait(16)
      },
    },
    {
      id: 'probe-invalid-code',
      probe: true,
      description: '検証ケース。',
      props: { value: null, onChange: recordChange },
      act: async ctx => {
        resetSpy()
        await ctx.type('input[role="combobox"]', 'xyz123')
        await ctx.wait(16)
      },
    },
  ],
  invariants: [
    {
      id: 'selected-label',
      description: '検証ケース。',
      onlyFixtures: ['selected'],
      check: ({ root }) => root.querySelector<HTMLInputElement>('input')?.value === 'French (fr)'
        || `value=${root.querySelector<HTMLInputElement>('input')?.value}`,
    },
    {
      id: 'search-selects-french',
      description: '検証ケース。',
      onlyFixtures: ['act-search-french'],
      check: () => (changeSpy.count === 1 && changeSpy.lastValue?.code === 'fr')
        || `count=${changeSpy.count}, value=${JSON.stringify(changeSpy.lastValue)}`,
    },
    {
      id: 'custom-code-canonicalized',
      description: '検証ケース。',
      onlyFixtures: ['act-custom-code'],
      check: () => (changeSpy.count === 1 && changeSpy.lastValue?.code === 'pt-BR')
        || `count=${changeSpy.count}, value=${JSON.stringify(changeSpy.lastValue)}`,
    },
    {
      id: 'invalid-code-safe',
      description: '検証ケース。',
      onlyFixtures: ['probe-invalid-code'],
      check: ({ root }) => (
        root.querySelectorAll('[role="option"]').length === 0
        && (root.textContent ?? '').includes('No matching languages.')
        && changeSpy.count === 0
      ) || `options=${root.querySelectorAll('[role="option"]').length}, count=${changeSpy.count}`,
    },
  ],
})
