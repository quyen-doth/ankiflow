import { z } from 'zod'
import { ContentTypeManager } from '@/components/admin/ContentTypeManager'
import { registerUnit } from '@/verify/core/registry'
import { FormType } from '@/types'
import type { FormFieldConfig } from '@/types'
import type { ContentTypeManagerScope } from '@/components/admin/ContentTypeManager'
import {
  clickButtonByText,
  collectionDocs,
  modalOpen,
  setFieldValue,
  tableRows,
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

function clickEditFirst(root: HTMLElement): void {
  const btn = root.querySelector<HTMLButtonElement>('button[aria-label^="Edit fields"]')
  if (!btn) throw new Error('要素が見つかりません')
  btn.click()
}

interface VerifyProps {
  scope?: ContentTypeManagerScope
}

registerUnit<VerifyProps>({
  id: 'ContentTypeManager',
  title: 'ContentTypeManager',
  description: 'Admin content types: edit fields[], toggle is_active, delete (vitest-only).',
  kind: 'component',
  render: (props) => <ContentTypeManager scope={props.scope} />,
  propsSchema: z.object({ scope: z.enum(['workspace', 'global-defaults']).optional() }),
  fixtures: [
    {
      id: 'loaded',
      description: '検証ケース。',
      props: {},
      mocks: { firestore: SEED },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'empty',
      description: 'Collection rỗng — empty message.',
      props: {},
      mocks: { firestore: { user_content_types: [] } },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'non-admin-access',
      description: '一般 user も自分の workspace Content Types manager を利用できる。',
      props: {},
      mocks: {
        auth: { user: { uid: 'regular-user', email: 'regular@example.com' } },
        firestore: {
          user_content_types: [
            { ...SEED.user_content_types[0], user_id: 'regular-user' },
            { ...SEED.user_content_types[1], user_id: 'other-user' },
          ],
        },
      },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'act-open-edit-modal',
      description: 'Act: Edit fields を click → 各 field の editor 付きで modal が開く。',
      props: {},
      mocks: { firestore: SEED },
      act: async ctx => {
        await ctx.wait(50)
        clickEditFirst(ctx.root)
        await ctx.wait(0)
      },
    },
    {
      id: 'act-edit-save',
      description: '検証ケース。',
      props: {},
      mocks: { firestore: SEED },
      act: async ctx => {
        await ctx.wait(50)
        clickEditFirst(ctx.root)
        await ctx.wait(0)
        setFieldValue(ctx.root, 'Label', 'Vocabulary Item')
        clickButtonByText(ctx.root, 'Save')
        await ctx.wait(80)
      },
    },
    {
      id: 'act-edit-ai-profile-save',
      description: 'Legacy built-in fallback を表示し、編集した AI instruction を workspace doc に保存する。',
      props: {},
      mocks: { firestore: SEED },
      act: async ctx => {
        await ctx.wait(50)
        clickEditFirst(ctx.root)
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
      props: {},
      mocks: { firestore: SEED },
      act: async ctx => {
        await ctx.wait(50)
        clickEditFirst(ctx.root)
        await ctx.wait(0)
      },
    },
    {
      id: 'act-invalid-ai-reserved-key',
      description: 'Reserved AI output key は validation で拒否し、Firestore を更新しない。',
      props: {},
      mocks: { firestore: SEED },
      act: async ctx => {
        await ctx.wait(50)
        clickEditFirst(ctx.root)
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
      id: 'act-toggle-active',
      description: '検証ケース。',
      props: {},
      mocks: { firestore: SEED },
      act: async ctx => {
        await ctx.wait(50)
        clickButtonByText(ctx.root, 'Active')
        await ctx.wait(80)
      },
    },
    {
      id: 'act-delete',
      description: '検証ケース。',
      props: {},
      mocks: { firestore: SEED },
      act: async ctx => {
        await ctx.wait(50)
        const del = ctx.root.querySelector<HTMLButtonElement>('button[aria-label^="Delete content type"]')
        if (!del) throw new Error('要素が見つかりません')
        del.click()
        await ctx.wait(0)
        clickButtonByText(ctx.root, 'Delete')
        await ctx.wait(80)
      },
    },
    {
      id: 'probe-empty-fields',
      probe: true,
      description: '検証ケース。',
      props: {},
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
        clickEditFirst(ctx.root)
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
        clickButtonByText(ctx.root, 'Add Content Type')
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
        clickButtonByText(ctx.root, 'Add Content Type')
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
        clickButtonByText(ctx.root, 'Add Content Type')
        await ctx.wait(0)
        setFieldValue(ctx.root, 'Name', 'Duplicate Language')
        setFieldValue(ctx.root, 'Code', FormType.LANGUAGE)
        clickButtonByText(ctx.root, 'Save')
        await ctx.wait(30)
      },
    },
    {
      id: 'protected-builtins',
      description: 'Built-in global document は delete action を表示せず、custom document だけ表示する。',
      props: { scope: 'global-defaults' },
      mocks: {
        firestore: {
          content_types: [
            { ...SEED.user_content_types[0], id: FormType.LANGUAGE },
            { ...SEED.user_content_types[1], id: 'custom_it' },
          ],
        },
      },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'act-delete-global-custom',
      description: 'Global custom default は delete できる。',
      props: { scope: 'global-defaults' },
      mocks: {
        firestore: {
          content_types: [
            { ...SEED.user_content_types[0], id: FormType.LANGUAGE },
            { ...SEED.user_content_types[1], id: 'custom_it' },
          ],
        },
      },
      act: async ctx => {
        await ctx.wait(50)
        const button = ctx.root.querySelector<HTMLButtonElement>('button[aria-label="Delete content type IT"]')
        if (!button) throw new Error('custom global delete button が見つからない')
        button.click()
        await ctx.wait(0)
        clickButtonByText(ctx.root, 'Delete')
        await ctx.wait(80)
      },
    },
    {
      id: 'act-create-global-custom',
      description: 'Global custom create は user_id を追加しない。',
      props: { scope: 'global-defaults' },
      mocks: {
        firestore: {
          content_types: [{ ...SEED.user_content_types[0], id: FormType.LANGUAGE }],
        },
      },
      act: async ctx => {
        await ctx.wait(50)
        clickButtonByText(ctx.root, 'Add Content Type')
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
      props: { scope: 'global-defaults' },
      mocks: {
        firestore: {
          content_types: [{ ...SEED.user_content_types[0], id: FormType.LANGUAGE }],
        },
      },
      act: async ctx => {
        await ctx.wait(50)
        clickEditFirst(ctx.root)
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
      description: '検証ケース。',
      check: ({ contract }) =>
        contract.unit === 'ContentTypeManager' || `contract.unit="${contract.unit}"`,
    },
    {
      id: 'rows-match-store',
      description: 'Workspace table は authenticated user の doc 数だけ表示する',
      onlyFixtures: ['loaded', 'empty'],
      check: ({ root }) => {
        const rows = tableRows(root)
        const store = collectionDocs('user_content_types').filter(doc => doc.user_id === 'test-user').length
        return rows === store || `tableRows=${rows}, store=${store}`
      },
    },
    {
      id: 'workspace-query-isolated',
      description: '他 user の Content Type を workspace table に表示しない',
      onlyFixtures: ['loaded'],
      check: ({ root, contract }) => {
        if (contract.collection !== 'user_content_types') return `collection="${contract.collection}"`
        if (contract.scope !== 'workspace') return `scope="${contract.scope}"`
        return !(root.textContent ?? '').includes('Other user private type') || '他 user の data が表示された'
      },
    },
    {
      id: 'non-admin-manages-own-workspace',
      description: '一般 user に admin gate を表示せず、自分の document だけ表示する',
      onlyFixtures: ['non-admin-access'],
      check: ({ root, contract }) => {
        if (contract.scope !== 'workspace') return `scope="${contract.scope}"`
        if (tableRows(root) !== 1) return `rows=${tableRows(root)}, expected=1`
        const text = root.textContent ?? ''
        if (!text.includes('Language')) return '自分の Content Type が表示されない'
        return !text.includes('IT') || '他 user の Content Type が表示された'
      },
    },
    {
      id: 'fields-count-shown',
      description: '検証ケース。',
      onlyFixtures: ['loaded'],
      check: ({ root }) => {
        const text = root.textContent ?? ''
        // ct-lang は language invariant を含む 3 fields、ct-it は 1 field。
        return (text.includes('3') && text.includes('1')) || '表示が見つかりません'
      },
    },
    {
      id: 'empty-message',
      description: '検証ケース。',
      onlyFixtures: ['empty'],
      check: ({ root }) =>
        (root.textContent ?? '').includes('No content types yet.') || '表示が見つかりません',
    },
    {
      id: 'edit-modal-opens-with-fields',
      description: '検証ケース。',
      onlyFixtures: ['act-open-edit-modal'],
      check: ({ root, contract }) => {
        if (contract.modalopen !== 'true') return `contract.modalopen="${contract.modalopen}"`
        if (!modalOpen(root)) return 'modal が開いていません'
        const text = root.textContent ?? ''
        return (text.includes('word') && text.includes('note')) || '表示が見つかりません'
      },
    },
    {
      id: 'edit-save-updates-fields',
      description: '検証ケース。',
      onlyFixtures: ['act-edit-save'],
      check: ({ root }) => {
        const doc = collectionDocs('user_content_types').find(d => d.id === 'ct-lang')
        if (!doc) return 'doc が消えています ct-lang'
        const fields = doc.fields as FormFieldConfig[]
        const updated = fields.find(f => f.field_key === 'word')
        if (!updated) return 'field が消えています word'
        if (updated.label !== 'Vocabulary Item') return `label="${updated.label}"`
        return !modalOpen(root) || 'modal vẫn mở sau Save'
      },
    },
    {
      id: 'ai-profile-save-materializes-fallback',
      description: 'Legacy workspace doc は Save 時に完全な AI profiles と編集済み instruction を保存する',
      onlyFixtures: ['act-edit-ai-profile-save'],
      check: ({ root }) => {
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
        return !modalOpen(root) || 'modal vẫn mở sau Save'
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
        return modalOpen(root) || 'modal closed after invalid profile save'
      },
    },
    {
      id: 'toggle-flips-active',
      description: '検証ケース。',
      onlyFixtures: ['act-toggle-active'],
      check: () => {
        const doc = collectionDocs('user_content_types').find(d => d.id === 'ct-lang')
        if (!doc) return 'doc が消えています ct-lang'
        return doc.is_active === false || `is_active=${doc.is_active}`
      },
    },
    {
      id: 'delete-removes-doc',
      description: 'Delete: workspace の ct-lang だけ削除し、他 user doc は保持する',
      onlyFixtures: ['act-delete'],
      check: ({ root }) => {
        const docs = collectionDocs('user_content_types')
        const ownDocs = docs.filter(doc => doc.user_id === 'test-user')
        if (ownDocs.length !== 1) return `ownDocs=${ownDocs.length}, expected=1`
        if (docs.find(d => d.id === 'ct-lang')) return 'ct-lang まだ残っています trong store'
        if (!docs.find(d => d.id === 'other-user-type')) return '他 user doc まで削除された'
        return !modalOpen(root) || 'modal vẫn mở sau Delete'
      },
    },
    {
      id: 'empty-fields-graceful',
      description: 'fields=[]: Fields column = 0、edit modal が crash せず開き、"undefined" を出さない',
      onlyFixtures: ['probe-empty-fields'],
      check: ({ root }) => {
        if (!modalOpen(root)) return 'modal が開いていません'
        return !(root.textContent ?? '').includes('undefined') || 'leak "undefined" ra UI'
      },
    },
    {
      id: 'protected-builtins-hide-delete',
      description: 'Built-in global Content Type は削除不可、custom global だけ削除ボタンを持つ',
      onlyFixtures: ['protected-builtins'],
      check: ({ root }) => {
        const buttons = root.querySelectorAll<HTMLButtonElement>('button[aria-label^="Delete content type"]')
        if (buttons.length !== 1) return `deleteButtons=${buttons.length}, expected=1`
        return buttons[0].getAttribute('aria-label') === 'Delete content type IT'
          || `aria-label="${buttons[0].getAttribute('aria-label')}"`
      },
    },
    {
      id: 'workspace-create-owns-document',
      description: 'Workspace create は code を正規化し authenticated UID を保存する',
      onlyFixtures: ['act-create-workspace'],
      check: ({ root }) => {
        const created = collectionDocs('user_content_types').find(doc => doc.code === 'medical_terms')
        if (!created) return '作成された Content Type が見つからない'
        if (created.user_id !== 'test-user') return `user_id="${created.user_id}"`
        return !modalOpen(root) || 'modal が閉じていない'
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
      id: 'global-custom-delete-works',
      description: 'Global scope は custom default だけ削除できる',
      onlyFixtures: ['act-delete-global-custom'],
      check: ({ contract }) => {
        if (contract.collection !== 'content_types') return `collection="${contract.collection}"`
        const docs = collectionDocs('content_types')
        if (docs.some(doc => doc.id === 'custom_it')) return 'custom global が残っている'
        return docs.some(doc => doc.id === FormType.LANGUAGE) || 'built-in global が消えた'
      },
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
