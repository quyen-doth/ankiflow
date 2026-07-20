import { useState } from 'react'
import { z } from 'zod'
import { AiOutputProfilesEditor } from '@/components/admin/AiOutputProfilesEditor'
import { Button } from '@/components/ui/Button'
import { resolveBuiltinAiOutputProfiles } from '@/lib/ai-agent/builtinOutputProfiles'
import { cloneAiOutputProfiles, normalizeAiOutputProfiles } from '@/lib/ai-agent/outputProfiles'
import { registerUnit } from '@/verify/core/registry'
import { verifyAttrs } from '@/verify/core/contract'
import { FormType } from '@/types'
import type { AiOutputProfile } from '@/types'

const TEST_CONTENT_TYPE = {
  code: 'language',
  name: 'Language draft',
  description: 'Vocabulary learning',
  fields: [
    {
      field_key: 'language',
      label: 'Study language',
      type: 'dropdown' as const,
      is_required: true,
      is_session_persistent: true,
      sort_order: 0,
    },
    {
      field_key: 'word',
      label: 'Word',
      type: 'text' as const,
      is_required: true,
      is_session_persistent: false,
      sort_order: 1,
    },
  ],
}

function initialProfiles(): AiOutputProfile[] {
  const profiles = resolveBuiltinAiOutputProfiles(FormType.LANGUAGE)
  if (!profiles) throw new Error('Language profiles are required')
  // 実アプリは materialize 経由で normalize 済み profile を渡すため、harness も揃える。
  return normalizeAiOutputProfiles(profiles)
}

function clickButtonByText(root: HTMLElement, text: string): void {
  const button = Array.from(root.querySelectorAll('button')).find(candidate => (
    candidate.textContent?.trim() === text
  ))
  if (!button) throw new Error(`button "${text}" was not found`)
  button.click()
}

function EditorHarness() {
  const [draft, setDraft] = useState<AiOutputProfile[]>(initialProfiles)
  const [saved, setSaved] = useState<AiOutputProfile[]>(initialProfiles)
  const [editing, setEditing] = useState(true)

  const save = () => {
    setSaved(cloneAiOutputProfiles(draft))
    setEditing(false)
  }
  const reopen = () => {
    setDraft(cloneAiOutputProfiles(saved))
    setEditing(true)
  }

  return (
    <div {...verifyAttrs({ unit: 'AiOutputProfilesEditor', editing, profiles: draft.length })}>
      {editing ? (
        <div className="flex flex-col gap-4">
          <AiOutputProfilesEditor
            profiles={draft}
            primaryFieldKey="word"
            contentType={TEST_CONTENT_TYPE}
            onInitialize={() => setDraft(initialProfiles())}
            onChange={setDraft}
          />
          <Button onClick={save} className="self-end">Save Profile Draft</Button>
        </div>
      ) : (
        <div className="flex flex-col items-start gap-3">
          <p>Profile draft saved.</p>
          <Button onClick={reopen}>Reopen editor</Button>
        </div>
      )}
    </div>
  )
}

registerUnit({
  id: 'AiOutputProfilesEditor',
  title: 'AI Output Profiles Editor',
  description: 'Profile switching, locked primary output, add/remove/reorder and draft persistence.',
  kind: 'component',
  render: () => <EditorHarness />,
  propsSchema: z.object({}),
  fixtures: [
    {
      id: 'act-exclude-inherited-field',
      description: '言語 profile で継承 field を exclude し、Restore で戻す。',
      props: {},
      act: async ctx => {
        // Chinese profile へ切り替える (Default=0, English=1, Chinese=2)。
        const select = ctx.root.querySelector<HTMLSelectElement>('select[aria-label="AI output profile"]')
        if (!select) throw new Error('profile select が見つからない')
        select.value = '2'
        select.dispatchEvent(new Event('change', { bubbles: true }))
        await ctx.wait(0)
        // legacy zh は normalize 済みで ipa を exclude している → Restore で戻す。
        const restore = ctx.root.querySelector<HTMLButtonElement>('button[aria-label="Restore inherited output ipa"]')
        if (!restore) throw new Error('ipa の Restore ボタンが見つからない')
        restore.click()
        await ctx.wait(0)
      },
    },
    {
      id: 'act-add-profile-inherits',
      description: '新規 profile は Default field をコピーせず継承だけする。',
      props: {},
      act: async ctx => {
        clickButtonByText(ctx.root, 'Add Profile')
        await ctx.wait(0)
      },
    },
    {
      id: 'default-language-profiles',
      description: 'Language editor starts with Default/English/Chinese/Japanese profiles.',
      props: {},
    },
    {
      id: 'e2e-editor-flow',
      description: 'E2E: edit, add, reorder, remove, save and reopen profile fields.',
      props: {},
    },
    {
      id: 'probe-primary-lock',
      probe: true,
      description: 'Probe: primary word key remains disabled and has no remove action.',
      props: {},
    },
    {
      id: 'probe-output-key-focus',
      probe: true,
      description: 'Output Key を連続入力しても input の focus を保持する。',
      props: {},
      act: async ctx => {
        const selector = 'input[aria-label="AI output key 1"]'
        const input = ctx.root.querySelector<HTMLInputElement>(selector)
        if (!input) throw new Error('editable Output Key input was not found')
        input.focus()

        let value = ''
        for (const character of 'phon_the') {
          value += character
          await ctx.type(selector, value)
        }
      },
    },
    {
      id: 'test-generate-success',
      description: '未保存 profile で sample generation を実行し custom result を表示する。',
      props: {},
      mocks: {
        fetch: [{
          match: '/api/generate',
          response: {
            json: { content: { word: 'book', meaning_vi: 'sách', level: 'B2' } },
          },
        }],
      },
      act: async ctx => {
        await ctx.type('input[aria-label="AI test sample"]', 'book')
        clickButtonByText(ctx.root, 'Run test')
        await ctx.wait(20)
      },
    },
    {
      id: 'test-generate-error',
      description: 'API error を editor 内に表示する。',
      props: {},
      mocks: {
        fetch: [{
          match: '/api/generate',
          response: { status: 400, json: { error: 'Inline profile is invalid' } },
        }],
      },
      act: async ctx => {
        await ctx.type('input[aria-label="AI test sample"]', 'book')
        clickButtonByText(ctx.root, 'Run test')
        await ctx.wait(20)
      },
    },
    {
      id: 'suggest-instruction-success',
      description: '自然言語の要件から instruction 候補を生成し draft に反映する。',
      props: {},
      mocks: {
        fetch: [{
          match: '/api/content-types/suggest-instruction',
          response: {
            json: {
              instruction: 'Return a concise definition in {output_language}. Return an empty string if the meaning is unknown.',
            },
          },
        }],
      },
      act: async ctx => {
        await ctx.click('button[aria-label="Suggest instruction for word"]')
        await ctx.type(
          'textarea[aria-label="Instruction suggestion description 0"]',
          'A concise definition in the selected output language',
        )
        clickButtonByText(ctx.root, 'Generate suggestion')
        await ctx.wait(20)
      },
    },
    {
      id: 'suggest-instruction-error',
      description: 'Instruction suggestion API の error を field 内に表示する。',
      props: {},
      mocks: {
        fetch: [{
          match: '/api/content-types/suggest-instruction',
          response: { status: 500, json: { error: 'Instruction service unavailable' } },
        }],
      },
      act: async ctx => {
        await ctx.click('button[aria-label="Suggest instruction for word"]')
        await ctx.type(
          'textarea[aria-label="Instruction suggestion description 0"]',
          'A concise definition',
        )
        clickButtonByText(ctx.root, 'Generate suggestion')
        await ctx.wait(20)
      },
    },
    {
      id: 'suggest-instruction-manual-edit-wins',
      probe: true,
      description: 'Suggestion 待機中の手動 instruction 編集を古い response で上書きしない。',
      props: {},
      mocks: {
        fetch: [{
          match: '/api/content-types/suggest-instruction',
          response: {
            delayMs: 50,
            json: {
              instruction: 'Stale generated instruction that must be ignored.',
            },
          },
        }],
      },
      act: async ctx => {
        await ctx.click('button[aria-label="Suggest instruction for word"]')
        await ctx.type(
          'textarea[aria-label="Instruction suggestion description 0"]',
          'A concise definition',
        )
        clickButtonByText(ctx.root, 'Generate suggestion')
        await ctx.wait(5)
        await ctx.type('textarea[aria-label="AI output instruction 0"]', 'Keep my manual edit.')
        await ctx.wait(70)
      },
    },
  ],
  invariants: [
    {
      id: 'inherited-field-can-be-excluded',
      description: '継承 field は Exclude/Restore でき、primary は操作できない',
      onlyFixtures: ['act-exclude-inherited-field'],
      check: ({ root }) => {
        // Restore 後は同じ field が Exclude に切り替わる = 継承が復活している。
        if (!root.querySelector('button[aria-label="Exclude inherited output ipa"]')) {
          return 'Restore しても Exclude に切り替わらない'
        }
        // builtin zh の Default-only field は ipa だけ。復活後は除外ゼロになる。
        return !root.querySelector('button[aria-label^="Restore inherited output"]')
          || 'ipa 以外にも除外された継承 field が残っている'
      },
    },
    {
      id: 'new-profile-starts-empty',
      description: '新規 profile は own field 0 件で作成される',
      onlyFixtures: ['act-add-profile-inherits'],
      check: ({ root }) => {
        const keyInputs = root.querySelectorAll('input[aria-label^="AI output key"]')
        if (keyInputs.length !== 0) return `own fields=${keyInputs.length}`
        // 新規 profile では primary(word) が継承側に現れる → exclude 不可であること。
        if (root.querySelector('button[aria-label="Exclude inherited output word"]')) {
          return 'primary field を exclude できてしまう'
        }
        return !!root.querySelector('button[aria-label="Exclude inherited output ipa"]')
          || '継承 field が表示されない'
      },
    },
    {
      id: 'self-identifies',
      description: 'Editor exposes its verification contract.',
      check: ({ contract }) => contract.unit === 'AiOutputProfilesEditor'
        || `contract.unit="${contract.unit}"`,
    },
    {
      id: 'language-profiles-visible',
      description: 'All built-in Language profile options are available.',
      // Add Profile fixture は意図的に 5 個目を足すため対象外。
      onlyFixtures: [
        'default-language-profiles',
        'e2e-editor-flow',
        'probe-primary-lock',
        'probe-output-key-focus',
        'act-exclude-inherited-field',
      ],
      check: ({ root }) => {
        const options = Array.from(root.querySelectorAll('select[aria-label="AI output profile"] option'))
          .map(option => option.textContent)
        return options.join(',') === 'Default,English,Chinese,Japanese'
          || `options=${options.join(',')}`
      },
    },
    {
      id: 'primary-is-locked',
      description: 'Primary output cannot be renamed or removed.',
      onlyFixtures: ['probe-primary-lock'],
      check: ({ root }) => {
        const input = root.querySelector<HTMLInputElement>('input[aria-label="AI output key 0"]')
        if (!input?.disabled) return 'primary key input is editable'
        return !root.querySelector('button[aria-label="Remove AI output word"]')
          || 'primary output has remove action'
      },
    },
    {
      id: 'output-key-keeps-focus',
      description: 'Output Key の各文字入力後も同じ input が active のままになる。',
      onlyFixtures: ['probe-output-key-focus'],
      check: ({ root }) => {
        const input = root.querySelector<HTMLInputElement>('input[aria-label="AI output key 1"]')
        if (input?.value !== 'phon_the') return `output key="${input?.value}"`
        return document.activeElement === input || 'Output Key input lost focus'
      },
    },
    {
      id: 'test-result-highlights-custom-field',
      description: 'Test result は custom field を識別して表示する',
      onlyFixtures: ['test-generate-success'],
      check: ({ root }) => {
        const result = root.querySelector('[aria-label="AI test result"]')
        if (!result) return 'test result が表示されていない'
        const text = result.textContent ?? ''
        return text.includes('Level') && text.includes('B2') && text.includes('Custom')
          || `result="${text}"`
      },
    },
    {
      id: 'test-error-visible',
      description: 'Generate error を alert として表示する',
      onlyFixtures: ['test-generate-error'],
      check: ({ root }) => root.querySelector('[role="alert"]')?.textContent === 'Inline profile is invalid'
        || 'API error が表示されていない',
    },
    {
      id: 'suggestion-fills-draft-instruction',
      description: '生成した instruction は保存せず現在の draft field に反映する',
      onlyFixtures: ['suggest-instruction-success'],
      check: ({ root }) => {
        const instruction = root.querySelector<HTMLTextAreaElement>('textarea[aria-label="AI output instruction 0"]')
        return instruction?.value
          === 'Return a concise definition in {output_language}. Return an empty string if the meaning is unknown.'
          || `instruction="${instruction?.value}"`
      },
    },
    {
      id: 'suggestion-error-visible',
      description: 'Suggestion error を alert として表示する',
      onlyFixtures: ['suggest-instruction-error'],
      check: ({ root }) => root.querySelector('[role="alert"]')?.textContent === 'Instruction service unavailable'
        || 'Suggestion API error が表示されていない',
    },
    {
      id: 'manual-instruction-beats-stale-suggestion',
      description: '待機中に手動編集した instruction を stale response 後も保持する',
      onlyFixtures: ['suggest-instruction-manual-edit-wins'],
      check: ({ root }) => {
        const instruction = root.querySelector<HTMLTextAreaElement>('textarea[aria-label="AI output instruction 0"]')
        return instruction?.value === 'Keep my manual edit.'
          || `instruction="${instruction?.value}"`
      },
    },
  ],
})
