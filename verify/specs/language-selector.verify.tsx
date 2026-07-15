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
  if (!select) throw new Error('không tìm thấy select')
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set
  setter?.call(select, value)
  select.dispatchEvent(new Event('change', { bubbles: true }))
}

registerUnit<LanguageSelectorProps>({
  id: 'LanguageSelector',
  title: 'LanguageSelector',
  description: 'Select ngôn ngữ — option sinh từ cấu hình BCP 47 theo user.',
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
      description: 'Chưa chọn ngôn ngữ — placeholder option đang chọn.',
      props: { value: '', onChange: noop },
    },
    {
      id: 'english-selected',
      description: 'Đang chọn English (LanguageType.ENGLISH).',
      props: { value: 'en', onChange: noop },
    },
    {
      id: 'act-change',
      description: 'Act: chọn Japanese → onChange nhận LanguageType.JAPANESE.',
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
      description: 'Probe: value không thuộc enum — không option nào khớp, không crash.',
      props: { value: 'fr', onChange: noop },
    },
  ],
  invariants: [
    {
      id: 'options-match-enum',
      description: 'Option values khớp đúng LANGUAGE_OPTIONS (không hardcode)',
      check: ({ root }) => {
        const values = Array.from(root.querySelectorAll('option'))
          .map(o => o.getAttribute('value'))
          .filter(v => v !== '')
        const expected = DEFAULT_STUDY_LANGUAGES.map(language => language.code)
        const missing = expected.filter(v => !values.includes(v))
        const extra = values.filter(v => !expected.includes(v as string))
        return (
          (missing.length === 0 && extra.length === 0) ||
          `thiếu: [${missing.join(',')}], thừa: [${extra.join(',')}]`
        )
      },
    },
    {
      id: 'selected-value-matches',
      description: 'select.value khớp props.value khi value thuộc enum',
      onlyFixtures: ['empty-value', 'english-selected'],
      check: ({ root, props }) => {
        const select = root.querySelector<HTMLSelectElement>('select')
        if (!select) return 'không có select'
        return select.value === props.value || `select.value="${select.value}"`
      },
    },
    {
      id: 'change-fires-enum-value',
      description: 'onChange nhận đúng LanguageType đã chọn, gọi 1 lần',
      onlyFixtures: ['act-change'],
      check: () =>
        (changeSpy.count === 1 && changeSpy.lastValue === 'ja') ||
        `count=${changeSpy.count}, lastValue=${changeSpy.lastValue}`,
    },
    {
      id: 'unknown-value-falls-back',
      description: 'Value lạ → select không nhận value đó (browser fallback option enabled đầu tiên)',
      onlyFixtures: ['probe-unknown-value'],
      check: ({ root, props }) => {
        const select = root.querySelector<HTMLSelectElement>('select')
        if (!select) return 'không có select'
        return select.value !== props.value || `select.value="${select.value}" nhận value lạ`
      },
    },
  ],
})
