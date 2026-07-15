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
  if (!button) throw new Error(`không tìm thấy button "${label}"`)
  button.click()
}

registerUnit<StudyLanguageSettingsProps>({
  id: 'StudyLanguageSettings',
  title: 'StudyLanguageSettings',
  description: 'Quản lý danh sách ngôn ngữ BCP 47 theo user trong Settings.',
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
      description: 'Hiển thị tên tùy chỉnh, mã BCP 47 và trạng thái enabled.',
      props: { languages: LANGUAGES, onChange: noop },
    },
    {
      id: 'act-reorder',
      description: 'Act: chuyển French lên trên và đánh lại sort_order.',
      props: { languages: LANGUAGES, onChange: recordChange },
      act: async ctx => {
        resetSpy()
        await ctx.click('button[aria-label="Move French up"]')
      },
    },
    {
      id: 'act-enable',
      description: 'Act: bật French → callback nhận enabled=true.',
      props: { languages: LANGUAGES, onChange: recordChange },
      act: async ctx => {
        resetSpy()
        await ctx.click('[role="switch"][aria-label="French enabled"]')
      },
    },
    {
      id: 'act-add-open-catalog',
      description: 'Act: thêm mã ko → tự gợi ý tên Korean và callback nhận row mới.',
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
      description: 'Act: xóa French phải qua dialog xác nhận mới chạy callback.',
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
      description: 'Probe: ngôn ngữ enabled cuối cùng không thể tắt hoặc xóa.',
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
      description: 'Tên và mã của mọi language đều hiển thị.',
      check: ({ root, props }) => props.languages.every(language => {
        const nameInput = root.querySelector<HTMLInputElement>(
          `input[aria-label="Display name for ${language.code}"]`,
        )
        return nameInput?.value === language.display_name
          && (root.textContent ?? '').includes(language.code)
      }) || 'thiếu tên hoặc mã language',
    },
    {
      id: 'reorder-callback',
      description: 'Reorder trả French trước English với sort_order liên tục.',
      onlyFixtures: ['act-reorder'],
      check: () => (
        changeSpy.count === 1
        && changeSpy.lastValue?.map(language => `${language.code}:${language.sort_order}`).join(',') === 'fr:0,en:1'
      ) || `value=${JSON.stringify(changeSpy.lastValue)}`,
    },
    {
      id: 'enable-callback',
      description: 'Toggle bật language bị tắt.',
      onlyFixtures: ['act-enable'],
      check: () => changeSpy.lastValue?.[1]?.enabled === true || `value=${JSON.stringify(changeSpy.lastValue)}`,
    },
    {
      id: 'add-open-language',
      description: 'Add modal thêm mã BCP 47 ngoài ba defaults.',
      onlyFixtures: ['act-add-open-catalog'],
      check: () => {
        const added = changeSpy.lastValue?.at(-1)
        return (added?.code === 'ko' && added.display_name === 'Korean') || `added=${JSON.stringify(added)}`
      },
    },
    {
      id: 'remove-requires-confirm',
      description: 'Remove chỉ callback một lần sau khi xác nhận, French bị loại.',
      onlyFixtures: ['act-remove-confirm'],
      check: () => (
        changeSpy.count === 1
        && changeSpy.lastValue?.map(language => language.code).join(',') === 'en'
      ) || `count=${changeSpy.count}, value=${JSON.stringify(changeSpy.lastValue)}`,
    },
    {
      id: 'last-enabled-protected',
      description: 'Switch và Remove disabled, callback không chạy.',
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
