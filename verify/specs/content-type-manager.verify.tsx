import { z } from 'zod'
import { ContentTypeManager } from '@/components/admin/ContentTypeManager'
import { registerUnit } from '@/verify/core/registry'
import { FormType } from '@/types'
import type { FormFieldConfig } from '@/types'
import type { ContentTypeManagerScope } from '@/components/admin/ContentTypeManager'
import { verifyGlobals } from '@/verify/core/globals'
import {
  clickButtonByText,
  collectionDocs,
  tableRows,
} from './manager-helpers'

/** 一覧から編集ページへ遷移したか — router.push の記録で判定する。 */
function navPushes(): string[] {
  return (verifyGlobals().__verifyNav?.calls ?? [])
    .filter(call => call.method === 'push')
    .map(call => String(call.args[0]))
}

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
  if (!btn) throw new Error('không tìm thấy nút Edit fields')
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
      description: '2 content type, cột Fields hiển thị số field.',
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
      id: 'act-toggle-active',
      description: 'Act: click badge Active row đầu → updateDoc lật is_active sang false.',
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
      description: 'Act: click Delete row đầu → confirm modal → Delete → deleteDoc xóa ct-lang.',
      props: {},
      mocks: { firestore: SEED },
      act: async ctx => {
        await ctx.wait(50)
        const del = ctx.root.querySelector<HTMLButtonElement>('button[aria-label^="Delete content type"]')
        if (!del) throw new Error('không tìm thấy nút Delete content type')
        del.click()
        await ctx.wait(0)
        clickButtonByText(ctx.root, 'Delete')
        await ctx.wait(80)
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
      id: 'probe-empty-fields-row',
      probe: true,
      description: 'Probe: fields=[] の content type も一覧で 0 を表示して crash しない。',
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
      },
    },
    {
      id: 'act-navigate-edit',
      description: 'Act: Edit fields クリックで専用編集ページへ遷移する。',
      props: {},
      mocks: { firestore: SEED },
      act: async ctx => {
        await ctx.wait(50)
        clickEditFirst(ctx.root)
        await ctx.wait(0)
      },
    },
    {
      id: 'act-navigate-create-global',
      description: 'Act: defaults モードの新規作成は scope を URL に引き継ぐ。',
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
      },
    },
  ],
  invariants: [
    {
      id: 'empty-fields-row-graceful',
      description: 'fields=[] でも Fields 列が 0 で undefined を出さない',
      onlyFixtures: ['probe-empty-fields-row'],
      check: ({ root }) => {
        if ((root.textContent ?? '').includes('undefined')) return '"undefined" が表示されている'
        return tableRows(root) === 1 || `rows=${tableRows(root)}`
      },
    },
    {
      id: 'edit-navigates-to-editor-route',
      description: 'Edit は /admin/content-types/<id> へ push する',
      onlyFixtures: ['act-navigate-edit'],
      check: () => {
        const pushes = navPushes()
        return pushes.some(href => href.startsWith('/admin/content-types/ct-lang'))
          || `pushes=${pushes.join(',')}`
      },
    },
    {
      id: 'create-keeps-defaults-scope',
      description: 'defaults モードの新規作成 URL は scope=global-defaults を保持する',
      onlyFixtures: ['act-navigate-create-global'],
      check: () => {
        const pushes = navPushes()
        return pushes.some(href => href === '/admin/content-types/new?scope=global-defaults')
          || `pushes=${pushes.join(',')}`
      },
    },
    {
      id: 'self-identifies',
      description: 'Contract tự định danh ContentTypeManager',
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
      description: 'Cột Fields hiển thị đúng số field của mỗi content type',
      onlyFixtures: ['loaded'],
      check: ({ root }) => {
        const text = root.textContent ?? ''
        // ct-lang は language invariant を含む 3 fields、ct-it は 1 field。
        return (text.includes('3') && text.includes('1')) || 'không thấy số field'
      },
    },
    {
      id: 'empty-message',
      description: 'Không có doc: empty message',
      onlyFixtures: ['empty'],
      check: ({ root }) =>
        (root.textContent ?? '').includes('No content types yet.') || 'không thấy empty message',
    },
    {
      id: 'toggle-flips-active',
      description: 'Toggle: doc ct-lang đảo is_active sang false',
      onlyFixtures: ['act-toggle-active'],
      check: () => {
        const doc = collectionDocs('user_content_types').find(d => d.id === 'ct-lang')
        if (!doc) return 'mất doc ct-lang'
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
        if (docs.find(d => d.id === 'ct-lang')) return 'ct-lang vẫn còn trong store'
        if (!docs.find(d => d.id === 'other-user-type')) return '他 user doc まで削除された'
        return !root.querySelector('[data-verify-unit="Modal"][data-verify-open="true"]')
          || 'delete modal vẫn mở sau Delete'
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
  ],
})
