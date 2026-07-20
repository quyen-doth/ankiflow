import type { ComponentProps } from 'react'
import { z } from 'zod'
import { StudyLanguageSettings } from '@/components/settings/StudyLanguageSettings'
import { registerUnit } from '@/verify/core/registry'
import { fn } from '@/verify/core/schema-helpers'
import type { StudyLanguage } from '@/types'

type StudyLanguageSettingsProps = ComponentProps<typeof StudyLanguageSettings>

const LANGUAGES: StudyLanguage[] = [
  { code: 'en', display_name: 'English', enabled: true, sort_order: 0 },
  { code: 'fr', display_name: 'French', enabled: false, sort_order: 1 },
]

const changeSpy = { count: 0, lastValue: null as StudyLanguage[] | null }
const recordChange = (languages: StudyLanguage[]) => {
  changeSpy.count++
  changeSpy.lastValue = languages
}
const noop = () => undefined

function resetSpy(): void {
  changeSpy.count = 0
  changeSpy.lastValue = null
}

function clickButton(root: HTMLElement, label: string, last = false): void {
  const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('button'))
    .filter(button => button.textContent?.trim() === label)
  const button = last ? buttons.at(-1) : buttons[0]
  if (!button) throw new Error(`button が見つかりません "${label}"`)
  button.click()
}

registerUnit<StudyLanguageSettingsProps>({
  id: 'StudyLanguageSettings',
  title: 'StudyLanguageSettings',
  description: '検証ケース。',
  kind: 'component',
  render: props => <StudyLanguageSettings {...props} />,
  propsSchema: z.object({
    languages: z.array(z.object({
      code: z.string(),
      display_name: z.string(),
      enabled: z.boolean(),
      sort_order: z.number(),
    })),
    onChange: fn<(languages: StudyLanguage[]) => void>(),
  }),
  fixtures: [
    {
      id: 'configured',
      description: '検証ケース。',
      props: { languages: LANGUAGES, onChange: noop },
    },
    {
      id: 'act-reorder',
      description: '検証ケース。',
      props: { languages: LANGUAGES, onChange: recordChange },
      act: async ctx => {
        resetSpy()
        await ctx.click('button[aria-label="Move French up"]')
      },
    },
    {
      id: 'act-enable',
      description: 'Act: French を有効化 → callback が enabled=true を受け取る。',
      props: { languages: LANGUAGES, onChange: recordChange },
      act: async ctx => {
        resetSpy()
        await ctx.click('[role="switch"][aria-label="French enabled"]')
      },
    },
    {
      id: 'act-add-open-catalog',
      description: '検証ケース。',
      props: { languages: LANGUAGES, onChange: recordChange },
      act: async ctx => {
        resetSpy()
        clickButton(ctx.root, 'Add language')
        await ctx.wait(16)
        await ctx.type('input[role="combobox"]', 'kor')
        await ctx.click('[role="option"][data-language-code="ko"]')
        clickButton(ctx.root, 'Add language', true)
        await ctx.wait(16)
      },
    },
    {
      id: 'act-remove-confirm',
      description: '検証ケース。',
      props: { languages: LANGUAGES, onChange: recordChange },
      act: async ctx => {
        resetSpy()
        await ctx.click('button[aria-label="Remove French"]')
        await ctx.wait(16)
        clickButton(ctx.root, 'Remove')
        await ctx.wait(16)
      },
    },
    {
      id: 'probe-last-enabled',
      probe: true,
      description: '検証ケース。',
      props: {
        languages: [{ code: 'en', display_name: 'English', enabled: true, sort_order: 0 }],
        onChange: recordChange,
      },
      act: async ctx => {
        resetSpy()
        await ctx.click('[role="switch"][aria-label="English enabled"]')
        await ctx.click('button[aria-label="Remove English"]')
      },
    },
  ],
  invariants: [
    {
      id: 'renders-configured-languages',
      description: '検証ケース。',
      check: ({ root, props }) => props.languages.every(language => {
        const nameInput = root.querySelector<HTMLInputElement>(
          `input[aria-label="Display name for ${language.code}"]`,
        )
        return nameInput?.value === language.display_name
          && (root.textContent ?? '').includes(language.code)
      }) || '不足しています',
    },
    {
      id: 'reorder-callback',
      description: '検証ケース。',
      onlyFixtures: ['act-reorder'],
      check: () => (
        changeSpy.count === 1
        && changeSpy.lastValue?.map(language => `${language.code}:${language.sort_order}`).join(',') === 'fr:0,en:1'
      ) || `value=${JSON.stringify(changeSpy.lastValue)}`,
    },
    {
      id: 'enable-callback',
      description: '検証ケース。',
      onlyFixtures: ['act-enable'],
      check: () => changeSpy.lastValue?.[1]?.enabled === true || `value=${JSON.stringify(changeSpy.lastValue)}`,
    },
    {
      id: 'add-open-language',
      description: '検証ケース。',
      onlyFixtures: ['act-add-open-catalog'],
      check: () => {
        const added = changeSpy.lastValue?.at(-1)
        return (added?.code === 'ko' && added.display_name === 'Korean') || `added=${JSON.stringify(added)}`
      },
    },
    {
      id: 'remove-requires-confirm',
      description: '検証ケース。',
      onlyFixtures: ['act-remove-confirm'],
      check: () => (
        changeSpy.count === 1
        && changeSpy.lastValue?.map(language => language.code).join(',') === 'en'
      ) || `count=${changeSpy.count}, value=${JSON.stringify(changeSpy.lastValue)}`,
    },
    {
      id: 'last-enabled-protected',
      description: '検証ケース。',
      onlyFixtures: ['probe-last-enabled'],
      check: ({ root }) => {
        const toggle = root.querySelector<HTMLButtonElement>('[role="switch"]')
        const remove = root.querySelector<HTMLButtonElement>('button[aria-label="Remove English"]')
        return (
          toggle?.disabled === true
          && remove?.disabled === true
          && changeSpy.count === 0
        ) || `toggle=${toggle?.disabled}, remove=${remove?.disabled}, count=${changeSpy.count}`
      },
    },
  ],
})
