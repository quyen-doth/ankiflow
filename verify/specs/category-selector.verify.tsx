import type { ComponentProps } from 'react'
import { z } from 'zod'
import { CategorySelector } from '@/components/create/CategorySelector'
import { registerUnit } from '@/verify/core/registry'
import { fn } from '@/verify/core/schema-helpers'
import { FormType } from '@/types'

type CategorySelectorProps = ComponentProps<typeof CategorySelector>

// 検証用コメント。
const CATEGORY_SEED = {
  categories: [
    { id: 'c-life', name: '生活', form_type: FormType.LANGUAGE, is_active: true, sort_order: 2 },
    { id: 'c-biz', name: 'Kinh doanh', form_type: FormType.LANGUAGE, is_active: true, sort_order: 1 },
    { id: 'c-dev', name: 'Dev Tools', form_type: FormType.IT, is_active: true, sort_order: 1 },
    { id: 'c-old', name: '古い', form_type: FormType.LANGUAGE, is_active: false, sort_order: 3 },
  ],
}

// onChange 用 spy — act 内で reset
const changeSpy = { count: 0, lastValue: null as string | null }
const recordChange = (value: string) => {
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

registerUnit<CategorySelectorProps>({
  id: 'CategorySelector',
  title: 'CategorySelector',
  description: '検証ケース。',
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
      description: '検証ケース。',
      props: { formType: 'Language', value: '', onChange: noop },
      mocks: { firestore: CATEGORY_SEED },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'no-formtype',
      description: '検証ケース。',
      props: { formType: '', value: '', onChange: noop },
      mocks: { firestore: { categories: [] } },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'act-select',
      description: '検証ケース。',
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
      description: '検証ケース。',
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
      description: '検証ケース。',
      onlyFixtures: ['loaded-language', 'act-select'],
      check: ({ root }) => {
        const labels = Array.from(root.querySelectorAll('option'))
          .filter(o => o.getAttribute('value') !== '')
          .map(o => o.textContent)
        return (
          JSON.stringify(labels) === JSON.stringify(['Kinh doanh', '生活']) ||
          `options: ${labels.join(' | ')}`
        )
      },
    },
    {
      id: 'disabled-without-formtype',
      description: '検証ケース。',
      onlyFixtures: ['no-formtype'],
      check: ({ root }) => {
        const select = root.querySelector<HTMLSelectElement>('select')
        if (!select) return '対象がありません'
        if (!select.disabled) return 'formType が空でも select が disabled ではありません'
        const options = root.querySelectorAll('option').length
        return options === 1 || `options=${options}, expected=1`
      },
    },
    {
      id: 'change-fires-category-id',
      description: '検証ケース。',
      onlyFixtures: ['act-select'],
      check: () =>
        (changeSpy.count === 1 && changeSpy.lastValue === 'c-biz') ||
        `count=${changeSpy.count}, lastValue=${changeSpy.lastValue}`,
    },
    {
      id: 'mismatched-formtype-empty',
      description: '検証ケース。',
      onlyFixtures: ['probe-mismatched-formtype'],
      check: ({ root, contract }) => {
        if (contract.count !== '0') return `contract.count="${contract.count}"`
        const options = root.querySelectorAll('option').length
        return options === 1 || `options=${options}, expected=1`
      },
    },
  ],
})
