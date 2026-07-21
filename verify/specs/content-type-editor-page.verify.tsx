import { z } from 'zod'
import { ContentTypeEditorPage } from '@/components/admin/ContentTypeEditorPage'
import { registerUnit } from '@/verify/core/registry'
import { verifyGlobals } from '@/verify/core/globals'
import { FormType } from '@/types'
import type { FormFieldConfig } from '@/types'
import {
  clickButtonByText,
  collectionDocs,
  setFieldValue,
} from './manager-helpers'

function field(overrides: Partial<FormFieldConfig> & { field_key: string }): FormFieldConfig {
  return {
    label: overrides.field_key,
    type: 'text',
    is_required: false,
    is_session_persistent: false,
    sort_order: 0,
    ...overrides,
  }
}

const SEED = {
  user_content_types: [
    {
      id: 'ct-lang',
      code: FormType.LANGUAGE,
      name: 'Language',
      description: 'Vocab card form',
      icon: 'Languages',
      is_active: true,
      sort_order: 1,
      fields: [
        field({ field_key: 'word', label: 'Word', sort_order: 1 }),
        field({ field_key: 'note', label: 'Note', type: 'textarea', sort_order: 2 }),
        field({ field_key: 'language', label: 'Language', type: 'dropdown', sort_order: 3 }),
      ],
    },
    {
      id: 'ct-it',
      code: FormType.IT,
      name: 'IT',
      description: 'IT term form',
      icon: 'Code',
      is_active: true,
      sort_order: 2,
      fields: [field({ field_key: 'term', label: 'Term', sort_order: 1 })],
    },
    {
      id: 'other-user-type',
      user_id: 'other-user',
      code: 'private_other',
      name: 'Other user private type',
      description: 'Must not be visible',
      icon: 'Lock',
      is_active: true,
      sort_order: 3,
      fields: [field({ field_key: 'secret', label: 'Secret', sort_order: 1 })],
    },
  ],
}


/** 編集フォームが表示されているか (page には modal がない)。 */
function editorVisible(root: HTMLElement): boolean {
  return !!root.querySelector('input[aria-label="Content type name"]')
}

/** 保存/キャンセル後に一覧へ戻ったか — router.push の記録で判定する。 */
function navPushes(): string[] {
  return (verifyGlobals().__verifyNav?.calls ?? [])
    .filter(call => call.method === 'push')
    .map(call => String(call.args[0]))
}

interface VerifyProps {
  contentTypeId?: string | null
  requestedGlobalScope?: boolean
  fromSettings?: boolean
}

registerUnit<VerifyProps>({
  id: 'ContentTypeEditorPage',
  title: 'ContentTypeEditorPage',
  description: 'Content Type 専用編集ページ: 読み込み/所有権検証/保存 (vitest-only).',
  kind: 'component',
  render: (props) => (
    <ContentTypeEditorPage
      contentTypeId={props.contentTypeId ?? null}
      requestedGlobalScope={props.requestedGlobalScope}
      fromSettings={props.fromSettings}
    />
  ),
  propsSchema: z.object({
    contentTypeId: z.string().nullable().optional(),
    requestedGlobalScope: z.boolean().optional(),
    fromSettings: z.boolean().optional(),
  }),
  fixtures: [

    {
      id: 'act-open-edit-modal',
      description: 'Act: click Edit fields → modal mở với editor cho từng field.',
      props: { contentTypeId: 'ct-lang' },
      mocks: { firestore: SEED },
      act: async ctx => {
        await ctx.wait(50)
        await ctx.wait(0)
      },
    },
    {
      id: 'act-edit-save',
      description: 'Act: mở edit → đổi Label field đầu → Save → updateDoc ghi fields, modal đóng.',
      props: { contentTypeId: 'ct-lang' },
      mocks: { firestore: SEED },
      act: async ctx => {
        await ctx.wait(50)
        await ctx.wait(0)
        setFieldValue(ctx.root, 'Label', 'Vocabulary Item')
        clickButtonByText(ctx.root, 'Save')
        await ctx.wait(80)
      },
    },
    {
      id: 'act-edit-ai-profile-save',
      description: 'Legacy built-in fallback を表示し、編集した AI instruction を workspace doc に保存する。',
      props: { contentTypeId: 'ct-lang' },
      mocks: { firestore: SEED },
      act: async ctx => {
        await ctx.wait(50)
        await ctx.wait(0)
        setFieldValue(ctx.root, 'Instruction', 'Workspace primary identity')
        clickButtonByText(ctx.root, 'Save')
        await ctx.wait(80)
      },
    },
    {
      id: 'probe-ai-primary-locked',
      probe: true,
      description: 'Probe: legacy fallback でも primary AI output は locked で削除できない。',
      props: { contentTypeId: 'ct-lang' },
      mocks: { firestore: SEED },
      act: async ctx => {
        await ctx.wait(50)
        await ctx.wait(0)
      },
    },
    {
      id: 'act-invalid-ai-reserved-key',
      description: 'Reserved AI output key は validation で拒否し、Firestore を更新しない。',
      props: { contentTypeId: 'ct-lang' },
      mocks: { firestore: SEED },
      act: async ctx => {
        await ctx.wait(50)
        await ctx.wait(0)
        clickButtonByText(ctx.root, 'Add Output Field')
        await ctx.wait(0)
        const keyInputs = ctx.root.querySelectorAll<HTMLInputElement>('input[aria-label^="AI output key"]')
        const instructionInputs = ctx.root.querySelectorAll<HTMLTextAreaElement>('textarea[aria-label^="AI output instruction"]')
        const keyInput = keyInputs[keyInputs.length - 1]
        const instructionInput = instructionInputs[instructionInputs.length - 1]
        const inputSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
        const textareaSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
        inputSetter?.call(keyInput, 'status')
        keyInput.dispatchEvent(new Event('input', { bubbles: true }))
        textareaSetter?.call(instructionInput, 'Override trusted status')
        instructionInput.dispatchEvent(new Event('input', { bubbles: true }))
        clickButtonByText(ctx.root, 'Save')
        await ctx.wait(30)
      },
    },
    {
      id: 'probe-empty-fields',
      probe: true,
      description: 'Probe: content type có fields=[] — cột Fields = 0, edit modal mở không có editor, không crash.',
      props: { contentTypeId: 'ct-empty' },
      mocks: {
        firestore: {
          user_content_types: [
            {
              id: 'ct-empty',
              code: FormType.GENERAL,
              name: 'General',
              description: 'Empty form',
              icon: 'BookOpen',
              is_active: true,
              sort_order: 1,
              fields: [],
            },
          ],
        },
      },
      act: async ctx => {
        await ctx.wait(50)
        await ctx.wait(0)
      },
    },
    {
      id: 'act-create-workspace',
      description: 'Workspace create は authenticated UID を user_id に設定する。',
      props: {},
      mocks: { firestore: SEED },
      act: async ctx => {
        await ctx.wait(50)
        await ctx.wait(0)
        setFieldValue(ctx.root, 'Name', 'Medical Terms')
        setFieldValue(ctx.root, 'Code', 'medical_terms')
        clickButtonByText(ctx.root, 'Add Field')
        await ctx.wait(0)
        setFieldValue(ctx.root, 'Field Key', 'term')
        setFieldValue(ctx.root, 'Label', 'Term')
        clickButtonByText(ctx.root, 'Save')
        await ctx.wait(80)
      },
    },
    {
      id: 'act-invalid-code',
      description: 'lowercase snake_case でない code は create を拒否する。',
      props: {},
      mocks: { firestore: SEED },
      act: async ctx => {
        await ctx.wait(50)
        await ctx.wait(0)
        setFieldValue(ctx.root, 'Name', 'Invalid')
        setFieldValue(ctx.root, 'Code', 'Invalid-Code')
        clickButtonByText(ctx.root, 'Save')
        await ctx.wait(30)
      },
    },
    {
      id: 'act-duplicate-code',
      description: '同一 workspace の duplicate code は create を拒否する。',
      props: {},
      mocks: { firestore: SEED },
      act: async ctx => {
        await ctx.wait(50)
        await ctx.wait(0)
        setFieldValue(ctx.root, 'Name', 'Duplicate Language')
        setFieldValue(ctx.root, 'Code', FormType.LANGUAGE)
        clickButtonByText(ctx.root, 'Save')
        await ctx.wait(30)
      },
    },
    {
      id: 'act-create-global-custom',
      description: 'Global custom create は user_id を追加しない。',
      props: { requestedGlobalScope: true },
      mocks: {
        firestore: {
          content_types: [{ ...SEED.user_content_types[0], id: FormType.LANGUAGE }],
        },
      },
      act: async ctx => {
        await ctx.wait(50)
        await ctx.wait(0)
        setFieldValue(ctx.root, 'Name', 'Future Custom')
        setFieldValue(ctx.root, 'Code', 'future_custom')
        clickButtonByText(ctx.root, 'Add Field')
        await ctx.wait(0)
        setFieldValue(ctx.root, 'Field Key', 'prompt')
        setFieldValue(ctx.root, 'Label', 'Prompt')
        clickButtonByText(ctx.root, 'Save')
        await ctx.wait(80)
      },
    },
    {
      id: 'act-global-ai-profile-save',
      description: 'Global defaults editor も同じ AI output profile を永続化する。',
      props: { requestedGlobalScope: true, contentTypeId: FormType.LANGUAGE },
      mocks: {
        firestore: {
          content_types: [{ ...SEED.user_content_types[0], id: FormType.LANGUAGE }],
        },
      },
      act: async ctx => {
        await ctx.wait(50)
        await ctx.wait(0)
        setFieldValue(ctx.root, 'Instruction', 'Global primary identity')
        clickButtonByText(ctx.root, 'Save')
        await ctx.wait(80)
      },
    },
  ],
  invariants: [
    {
      id: 'self-identifies',
      description: 'Contract tự định danh ContentTypeEditorPage',
      check: ({ contract }) =>
        contract.unit === 'ContentTypeEditorPage' || `contract.unit="${contract.unit}"`,
    },

    {
      id: 'edit-modal-opens-with-fields',
      description: 'Click Edit: modal mở, có input cho từng field (theo field_key)',
      onlyFixtures: ['act-open-edit-modal'],
      check: ({ root, contract }) => {
        if (contract.modalopen !== 'true') return `contract.modalopen="${contract.modalopen}"`
        if (!editorVisible(root)) return 'editor form が表示されない'
        const text = root.textContent ?? ''
        return (text.includes('word') && text.includes('note')) || 'không thấy field editor'
      },
    },
    {
      id: 'edit-save-updates-fields',
      description: 'Save: store doc fields[0].label cập nhật, modal đóng',
      onlyFixtures: ['act-edit-save'],
      check: () => {
        const doc = collectionDocs('user_content_types').find(d => d.id === 'ct-lang')
        if (!doc) return 'mất doc ct-lang'
        const fields = doc.fields as FormFieldConfig[]
        const updated = fields.find(f => f.field_key === 'word')
        if (!updated) return 'mất field word'
        if (updated.label !== 'Vocabulary Item') return `label="${updated.label}"`
        return navPushes().length > 0 || 'Save 後に一覧へ戻っていない'
      },
    },
    {
      id: 'ai-profile-save-materializes-fallback',
      description: 'Legacy workspace doc は Save 時に完全な AI profiles と編集済み instruction を保存する',
      onlyFixtures: ['act-edit-ai-profile-save'],
      check: () => {
        const doc = collectionDocs('user_content_types').find(item => item.id === 'ct-lang')
        const profiles = doc?.ai_output_profiles as Array<{
          profile: string
          fields: Array<{ key: string; instruction: string }>
        }> | undefined
        if (profiles?.map(profile => profile.profile).join(',') !== 'default,en,zh,ja') {
          return `profiles=${profiles?.map(profile => profile.profile).join(',')}`
        }
        const word = profiles[0].fields.find(field => field.key === 'word')
        if (word?.instruction !== 'Workspace primary identity') return `instruction="${word?.instruction}"`
        return navPushes().length > 0 || 'Save 後に一覧へ戻っていない'
      },
    },
    {
      id: 'ai-primary-output-is-locked',
      description: 'Primary output key input は disabled で remove action を持たない',
      onlyFixtures: ['probe-ai-primary-locked'],
      check: ({ root }) => {
        const primaryInput = root.querySelector<HTMLInputElement>('input[aria-label="AI output key 0"]')
        if (!primaryInput?.disabled) return 'primary output key is editable'
        return !root.querySelector('button[aria-label="Remove AI output word"]')
          || 'primary output has a remove action'
      },
    },
    {
      id: 'reserved-ai-output-key-is-blocked',
      description: 'Reserved key を含む draft は modal を維持し、stored profile を変更しない',
      onlyFixtures: ['act-invalid-ai-reserved-key'],
      check: ({ root }) => {
        const doc = collectionDocs('user_content_types').find(item => item.id === 'ct-lang')
        if (doc?.ai_output_profiles !== undefined) return 'invalid profiles were persisted'
        return (editorVisible(root) && navPushes().length === 0) || 'invalid profile なのに離脱した'
      },
    },
    {
      id: 'empty-fields-graceful',
      description: 'fields=[]: cột Fields = 0, edit modal mở không crash, không "undefined"',
      onlyFixtures: ['probe-empty-fields'],
      check: ({ root }) => {
        if (!editorVisible(root)) return 'editor form が表示されない'
        return !(root.textContent ?? '').includes('undefined') || 'leak "undefined" ra UI'
      },
    },
    {
      id: 'workspace-create-owns-document',
      description: 'Workspace create は code を正規化し authenticated UID を保存する',
      onlyFixtures: ['act-create-workspace'],
      check: () => {
        const created = collectionDocs('user_content_types').find(doc => doc.code === 'medical_terms')
        if (!created) return '作成された Content Type が見つからない'
        if (created.user_id !== 'test-user') return `user_id="${created.user_id}"`
        return navPushes().length > 0 || 'Save 後に一覧へ戻っていない'
      },
    },
    {
      id: 'invalid-code-blocked',
      description: 'Invalid code は Firestore に作成しない',
      onlyFixtures: ['act-invalid-code'],
      check: () => !collectionDocs('user_content_types').some(doc => doc.code === 'Invalid-Code')
        || 'invalid code が保存された',
    },
    {
      id: 'duplicate-code-blocked',
      description: 'Duplicate code は同一 workspace に作成しない',
      onlyFixtures: ['act-duplicate-code'],
      check: () => {
        const matches = collectionDocs('user_content_types').filter(
          doc => doc.user_id === 'test-user' && doc.code === FormType.LANGUAGE,
        )
        return matches.length === 1 || `duplicates=${matches.length}`
      },
    },
    {
      id: 'code-is-immutable-in-editor',
      description: 'Existing Content Type の code input は disabled',
      onlyFixtures: ['act-open-edit-modal'],
      check: ({ root }) => root.querySelector<HTMLInputElement>('input[aria-label="Content type code"]')?.disabled
        || 'code input が編集可能',
    },
    {
      id: 'global-create-has-no-owner',
      description: 'Global custom default create は user_id を保存しない',
      onlyFixtures: ['act-create-global-custom'],
      check: () => {
        const created = collectionDocs('content_types').find(doc => doc.code === 'future_custom')
        if (!created) return 'global custom が作成されていない'
        return created.user_id === undefined || `user_id="${created.user_id}"`
      },
    },
    {
      id: 'global-ai-profile-save-persists',
      description: 'Global defaults scope は output profiles を content_types に保存する',
      onlyFixtures: ['act-global-ai-profile-save'],
      check: () => {
        const doc = collectionDocs('content_types').find(item => item.id === FormType.LANGUAGE)
        const profiles = doc?.ai_output_profiles as Array<{
          profile: string
          fields: Array<{ key: string; instruction: string }>
        }> | undefined
        const word = profiles?.[0].fields.find(field => field.key === 'word')
        return word?.instruction === 'Global primary identity'
          || `instruction="${word?.instruction}"`
      },
    },
  ],
})
