import type { ComponentProps } from 'react'
import { z } from 'zod'
import { LanguageSelector } from '@/components/create/LanguageSelector'
import { DEFAULT_STUDY_LANGUAGES } from '@/lib/studyLanguages'
import { registerUnit } from '@/verify/core/registry'
import { fn } from '@/verify/core/schema-helpers'
import type { LanguageCode } from '@/types'

type LanguageSelectorProps = ComponentProps<typeof LanguageSelector>

// Spy cho act-change — reset trong act
const changeSpy = { count: 0, lastValue: null as LanguageCode | null }
const recordChange = (value: LanguageCode) => {
  changeSpy.count++
  changeSpy.lastValue = value
}
const noop = () => undefined

function selectValue(root: HTMLElement, value: string): void {
  const select = root.querySelector<HTMLSelectElement>('select')
  if (!select) throw new Error('要素が見つかりません')
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set
  setter?.call(select, value)
  select.dispatchEvent(new Event('change', { bubbles: true }))
}

registerUnit<LanguageSelectorProps>({
  id: 'LanguageSelector',
  title: 'LanguageSelector',
  description: '検証ケース。',
  kind: 'component',
  render: props => <LanguageSelector {...props} />,
  propsSchema: z.object({
    value: z.string(),
    languages: z.array(z.object({
      code: z.string(),
      display_name: z.string(),
      enabled: z.boolean(),
      sort_order: z.number(),
    })).optional(),
    onChange: fn<(value: LanguageCode) => void>(),
  }),
  fixtures: [
    {
      id: 'empty-value',
      description: '検証ケース。',
      props: { value: '', onChange: noop },
    },
    {
      id: 'english-selected',
      description: '検証ケース。',
      props: { value: 'en', onChange: noop },
    },
    {
      id: 'act-change',
      description: '検証ケース。',
      props: { value: '', onChange: recordChange },
      act: async ctx => {
        changeSpy.count = 0
        changeSpy.lastValue = null
        selectValue(ctx.root, 'ja')
        await ctx.wait(16)
      },
    },
    {
      id: 'probe-unknown-value',
      probe: true,
      description: '検証ケース。',
      props: { value: 'fr', onChange: noop },
    },
  ],
  invariants: [
    {
      id: 'options-match-enum',
      description: '検証ケース。',
      check: ({ root }) => {
        const values = Array.from(root.querySelectorAll('option'))
          .map(o => o.getAttribute('value'))
          .filter(v => v !== '')
        const expected = DEFAULT_STUDY_LANGUAGES.map(language => language.code)
        const missing = expected.filter(v => !values.includes(v))
        const extra = values.filter(v => !expected.includes(v as string))
        return (
          (missing.length === 0 && extra.length === 0) ||
          `不足: [${missing.join(',')}], 余分: [${extra.join(',')}]`
        )
      },
    },
    {
      id: 'selected-value-matches',
      description: 'value が enum に含まれる場合、select.value は props.value と一致',
      onlyFixtures: ['empty-value', 'english-selected'],
      check: ({ root, props }) => {
        const select = root.querySelector<HTMLSelectElement>('select')
        if (!select) return '対象がありません'
        return select.value === props.value || `select.value="${select.value}"`
      },
    },
    {
      id: 'change-fires-enum-value',
      description: '検証ケース。',
      onlyFixtures: ['act-change'],
      check: () =>
        (changeSpy.count === 1 && changeSpy.lastValue === 'ja') ||
        `count=${changeSpy.count}, lastValue=${changeSpy.lastValue}`,
    },
    {
      id: 'unknown-value-falls-back',
      description: '検証ケース。',
      onlyFixtures: ['probe-unknown-value'],
      check: ({ root, props }) => {
        const select = root.querySelector<HTMLSelectElement>('select')
        if (!select) return '対象がありません'
        return select.value !== props.value || `select.value="${select.value}" が unknown value を受け取りました`
      },
    },
  ],
})
