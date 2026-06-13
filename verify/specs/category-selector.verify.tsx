import type { ComponentProps } from 'react'
import { z } from 'zod'
import { CategorySelector } from '@/components/create/CategorySelector'
import { registerUnit } from '@/verify/core/registry'
import { fn } from '@/verify/core/schema-helpers'
import { FormType } from '@/types'

type CategorySelectorProps = ComponentProps<typeof CategorySelector>

// Seed: 2 category Language active (sort đảo), 1 IT, 1 Language inactive
const CATEGORY_SEED = {
  categories: [
    { id: 'c-life', name: 'Đời sống', form_type: FormType.LANGUAGE, is_active: true, sort_order: 2 },
    { id: 'c-biz', name: 'Kinh doanh', form_type: FormType.LANGUAGE, is_active: true, sort_order: 1 },
    { id: 'c-dev', name: 'Dev Tools', form_type: FormType.IT, is_active: true, sort_order: 1 },
    { id: 'c-old', name: 'Cũ', form_type: FormType.LANGUAGE, is_active: false, sort_order: 3 },
  ],
}

// Spy cho onChange — reset trong act
const changeSpy = { count: 0, lastValue: null as string | null }
const recordChange = (value: string) => {
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

registerUnit<CategorySelectorProps>({
  id: 'CategorySelector',
  title: 'CategorySelector',
  description: 'Select category lọc theo FormType (UI_FORM_TYPE_MAP) + is_active (vitest-only).',
  kind: 'component',
  render: props => <CategorySelector {...props} />,
  propsSchema: z.object({
    formType: z.string(),
    value: z.string(),
    onChange: fn<(value: string) => void>(),
  }),
  fixtures: [
    {
      id: 'loaded-language',
      description: 'formType=Language → chỉ category form_language active, sort đúng.',
      props: { formType: 'Language', value: '', onChange: noop },
      mocks: { firestore: CATEGORY_SEED },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'no-formtype',
      description: 'formType rỗng → select disabled, không fetch.',
      props: { formType: '', value: '', onChange: noop },
      mocks: { firestore: { categories: [] } },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'act-select',
      description: 'Act: chọn category → onChange(categoryId).',
      props: { formType: 'Language', value: '', onChange: recordChange },
      mocks: { firestore: CATEGORY_SEED },
      act: async ctx => {
        await ctx.wait(50)
        changeSpy.count = 0
        changeSpy.lastValue = null
        selectValue(ctx.root, 'c-biz')
        await ctx.wait(16)
      },
    },
    {
      id: 'probe-mismatched-formtype',
      probe: true,
      description: 'Probe: formType=General nhưng seed chỉ có Language/IT — options rỗng, không crash.',
      props: { formType: 'General', value: '', onChange: noop },
      mocks: { firestore: CATEGORY_SEED },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
  ],
  invariants: [
    {
      id: 'filtered-by-formtype-and-active',
      description: 'Chỉ category đúng form_type và is_active, sort theo sort_order',
      onlyFixtures: ['loaded-language', 'act-select'],
      check: ({ root }) => {
        const labels = Array.from(root.querySelectorAll('option'))
          .filter(o => o.getAttribute('value') !== '')
          .map(o => o.textContent)
        return (
          JSON.stringify(labels) === JSON.stringify(['Kinh doanh', 'Đời sống']) ||
          `options: ${labels.join(' | ')}`
        )
      },
    },
    {
      id: 'disabled-without-formtype',
      description: 'formType rỗng: select disabled, không có option dữ liệu',
      onlyFixtures: ['no-formtype'],
      check: ({ root }) => {
        const select = root.querySelector<HTMLSelectElement>('select')
        if (!select) return 'không có select'
        if (!select.disabled) return 'select không disabled khi formType rỗng'
        const options = root.querySelectorAll('option').length
        return options === 1 || `options=${options}, expected=1`
      },
    },
    {
      id: 'change-fires-category-id',
      description: 'onChange nhận đúng category id, gọi 1 lần',
      onlyFixtures: ['act-select'],
      check: () =>
        (changeSpy.count === 1 && changeSpy.lastValue === 'c-biz') ||
        `count=${changeSpy.count}, lastValue=${changeSpy.lastValue}`,
    },
    {
      id: 'mismatched-formtype-empty',
      description: 'formType không khớp seed: contract count=0, chỉ placeholder',
      onlyFixtures: ['probe-mismatched-formtype'],
      check: ({ root, contract }) => {
        if (contract.count !== '0') return `contract.count="${contract.count}"`
        const options = root.querySelectorAll('option').length
        return options === 1 || `options=${options}, expected=1`
      },
    },
  ],
})
