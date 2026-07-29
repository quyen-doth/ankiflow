import type { ComponentProps } from 'react'
import { z } from 'zod'
import { AiOutputLanguageSettings } from '@/components/settings/AiOutputLanguageSettings'
import { registerUnit } from '@/verify/core/registry'
import { fn } from '@/verify/core/schema-helpers'
import type { AiOutputLanguage, LanguageCode } from '@/types'

type AiOutputLanguageSettingsProps = ComponentProps<typeof AiOutputLanguageSettings>

const LANGUAGES: AiOutputLanguage[] = [
  { code: 'vi', display_name: 'Vietnamese', enabled: true, sort_order: 0 },
  { code: 'ja', display_name: 'Japanese', enabled: true, sort_order: 1 },
]

const changeSpy = {
  languagesCount: 0,
  languages: null as AiOutputLanguage[] | null,
  defaultCount: 0,
  defaultLanguage: null as LanguageCode | null,
}

function resetSpy(): void {
  changeSpy.languagesCount = 0
  changeSpy.languages = null
  changeSpy.defaultCount = 0
  changeSpy.defaultLanguage = null
}

function recordLanguages(languages: AiOutputLanguage[]): void {
  changeSpy.languagesCount++
  changeSpy.languages = languages
}

function recordDefault(language: LanguageCode): void {
  changeSpy.defaultCount++
  changeSpy.defaultLanguage = language
}

function noop(): void {
  // 表示だけを検証する fixture 用。
}

function clickButton(root: HTMLElement, label: string, last = false): void {
  const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('button'))
    .filter(button => button.textContent?.trim() === label)
  const button = last ? buttons.at(-1) : buttons[0]
  if (!button) throw new Error(`button が見つかりません "${label}"`)
  button.click()
}

registerUnit<AiOutputLanguageSettingsProps>({
  id: 'AiOutputLanguageSettings',
  title: 'AiOutputLanguageSettings',
  description: 'AI 出力言語一覧と明示 default の編集を検証する。',
  kind: 'component',
  render: props => <AiOutputLanguageSettings {...props} />,
  propsSchema: z.object({
    languages: z.array(z.object({
      code: z.string(),
      display_name: z.string(),
      enabled: z.boolean(),
      sort_order: z.number(),
    })),
    defaultLanguage: z.string(),
    onLanguagesChange: fn<(languages: AiOutputLanguage[]) => void>(),
    onDefaultLanguageChange: fn<(language: LanguageCode) => void>(),
  }),
  fixtures: [
    {
      id: 'configured',
      description: '有効な 2 言語と Vietnamese default を表示する。',
      props: {
        languages: LANGUAGES,
        defaultLanguage: 'vi',
        onLanguagesChange: noop,
        onDefaultLanguageChange: noop,
      },
    },
    {
      id: 'act-select-default',
      description: 'Default pulldown を Japanese へ変更する。',
      props: {
        languages: LANGUAGES,
        defaultLanguage: 'vi',
        onLanguagesChange: recordLanguages,
        onDefaultLanguageChange: recordDefault,
      },
      act: async ctx => {
        resetSpy()
        const select = ctx.root.querySelector<HTMLSelectElement>(
          'select[aria-label="Default AI output language"]',
        )
        if (!select) throw new Error('default select が見つかりません')
        select.value = 'ja'
        select.dispatchEvent(new Event('change', { bubbles: true }))
        await ctx.wait(0)
      },
    },
    {
      id: 'act-add-open-catalog',
      description: 'Open catalog から Korean を追加する。',
      props: {
        languages: LANGUAGES,
        defaultLanguage: 'vi',
        onLanguagesChange: recordLanguages,
        onDefaultLanguageChange: recordDefault,
      },
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
      id: 'act-reorder',
      description: 'Japanese を先頭へ移動しても default callback は発火しない。',
      props: {
        languages: LANGUAGES,
        defaultLanguage: 'vi',
        onLanguagesChange: recordLanguages,
        onDefaultLanguageChange: recordDefault,
      },
      act: async ctx => {
        resetSpy()
        await ctx.click('button[aria-label="Move AI output Japanese up"]')
      },
    },
    {
      id: 'probe-disabled-default',
      probe: true,
      description: '保存 default が disabled の場合は field-level error を表示する。',
      props: {
        languages: [
          { code: 'vi', display_name: 'Vietnamese', enabled: false, sort_order: 0 },
          { code: 'ja', display_name: 'Japanese', enabled: true, sort_order: 1 },
        ],
        defaultLanguage: 'vi',
        onLanguagesChange: recordLanguages,
        onDefaultLanguageChange: recordDefault,
      },
    },
  ],
  invariants: [
    {
      id: 'renders-independent-list-and-default',
      description: '一覧と default pulldown は設定値をそのまま表示する。',
      onlyFixtures: ['configured'],
      check: ({ root }) => {
        const select = root.querySelector<HTMLSelectElement>(
          'select[aria-label="Default AI output language"]',
        )
        return (
          root.querySelector<HTMLInputElement>(
            'input[aria-label="Display name for AI output vi"]',
          )?.value === 'Vietnamese'
          && root.querySelector<HTMLInputElement>(
            'input[aria-label="Display name for AI output ja"]',
          )?.value === 'Japanese'
          && select?.value === 'vi'
          && Array.from(select.options).map(option => option.value).join(',') === ',vi,ja'
        ) || 'AI output language list または default options が一致しません'
      },
    },
    {
      id: 'default-callback',
      description: 'Default 変更だけを専用 callback へ通知する。',
      onlyFixtures: ['act-select-default'],
      check: () => (
        changeSpy.defaultCount === 1
        && changeSpy.defaultLanguage === 'ja'
        && changeSpy.languagesCount === 0
      ) || `spy=${JSON.stringify(changeSpy)}`,
    },
    {
      id: 'add-language-callback',
      description: '追加した language は enabled かつ canonical code になる。',
      onlyFixtures: ['act-add-open-catalog'],
      check: () => {
        const added = changeSpy.languages?.at(-1)
        return (
          changeSpy.languagesCount === 1
          && added?.code === 'ko'
          && added.display_name === 'Korean'
          && added.enabled
        ) || `added=${JSON.stringify(added)}`
      },
    },
    {
      id: 'reorder-does-not-change-default',
      description: '順序は default の暗黙的な意味を持たない。',
      onlyFixtures: ['act-reorder'],
      check: () => (
        changeSpy.languages?.map(language => language.code).join(',') === 'ja,vi'
        && changeSpy.defaultCount === 0
      ) || `spy=${JSON.stringify(changeSpy)}`,
    },
    {
      id: 'invalid-default-visible',
      description: 'Disabled default は空の select と field-level error で明示する。',
      onlyFixtures: ['probe-disabled-default'],
      check: ({ root }) => {
        const select = root.querySelector<HTMLSelectElement>(
          'select[aria-label="Default AI output language"]',
        )
        return (
          select?.value === ''
          && select.getAttribute('aria-invalid') === 'true'
          && root.textContent?.includes('Choose an enabled AI output language before saving.')
        ) || `value=${select?.value}, invalid=${select?.getAttribute('aria-invalid')}`
      },
    },
  ],
})
