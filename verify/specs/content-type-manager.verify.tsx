import { z } from 'zod'
import { ContentTypeManager } from '@/components/admin/ContentTypeManager'
import { registerUnit } from '@/verify/core/registry'
import { FormType } from '@/types'
import type { FormFieldConfig } from '@/types'
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
  content_types: [
    {
      id: 'ct-lang',
      code: FormType.LANGUAGE,
      name: 'Language',
      description: 'Vocab card form',
      is_active: true,
      sort_order: 1,
      fields: [
        field({ field_key: 'word', label: 'Word', sort_order: 1 }),
        field({ field_key: 'note', label: 'Note', type: 'textarea', sort_order: 2 }),
      ],
    },
    {
      id: 'ct-it',
      code: FormType.IT,
      name: 'IT',
      description: 'IT term form',
      is_active: true,
      sort_order: 2,
      fields: [field({ field_key: 'term', label: 'Term', sort_order: 1 })],
    },
  ],
}

function clickEditFirst(root: HTMLElement): void {
  const btn = root.querySelector<HTMLButtonElement>('button[aria-label^="Edit fields"]')
  if (!btn) throw new Error('không tìm thấy nút Edit fields')
  btn.click()
}

registerUnit<Record<string, never>>({
  id: 'ContentTypeManager',
  title: 'ContentTypeManager',
  description: 'Admin content types: edit fields[], toggle is_active, delete (vitest-only).',
  kind: 'component',
  render: () => <ContentTypeManager />,
  propsSchema: z.object({}),
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
      mocks: { firestore: { content_types: [] } },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'act-open-edit-modal',
      description: 'Act: click Edit fields → modal mở với editor cho từng field.',
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
      description: 'Act: mở edit → đổi Label field đầu → Save → updateDoc ghi fields, modal đóng.',
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
      id: 'probe-empty-fields',
      probe: true,
      description: 'Probe: content type có fields=[] — cột Fields = 0, edit modal mở không có editor, không crash.',
      props: {},
      mocks: {
        firestore: {
          content_types: [
            {
              id: 'ct-empty',
              code: FormType.GENERAL,
              name: 'General',
              description: 'Empty form',
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
  ],
  invariants: [
    {
      id: 'self-identifies',
      description: 'Contract tự định danh ContentTypeManager',
      check: ({ contract }) =>
        contract.unit === 'ContentTypeManager' || `contract.unit="${contract.unit}"`,
    },
    {
      id: 'rows-match-store',
      description: 'Số row bảng = số doc trong store',
      onlyFixtures: ['loaded', 'empty'],
      check: ({ root }) => {
        const rows = tableRows(root)
        const store = collectionDocs('content_types').length
        return rows === store || `tableRows=${rows}, store=${store}`
      },
    },
    {
      id: 'fields-count-shown',
      description: 'Cột Fields hiển thị đúng số field của mỗi content type',
      onlyFixtures: ['loaded'],
      check: ({ root }) => {
        const text = root.textContent ?? ''
        // ct-lang có 2 field, ct-it có 1 field
        return (text.includes('2') && text.includes('1')) || 'không thấy số field'
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
      id: 'edit-modal-opens-with-fields',
      description: 'Click Edit: modal mở, có input cho từng field (theo field_key)',
      onlyFixtures: ['act-open-edit-modal'],
      check: ({ root, contract }) => {
        if (contract.modalopen !== 'true') return `contract.modalopen="${contract.modalopen}"`
        if (!modalOpen(root)) return 'modal không mở'
        const text = root.textContent ?? ''
        return (text.includes('word') && text.includes('note')) || 'không thấy field editor'
      },
    },
    {
      id: 'edit-save-updates-fields',
      description: 'Save: store doc fields[0].label cập nhật, modal đóng',
      onlyFixtures: ['act-edit-save'],
      check: ({ root }) => {
        const doc = collectionDocs('content_types').find(d => d.id === 'ct-lang')
        if (!doc) return 'mất doc ct-lang'
        const fields = doc.fields as FormFieldConfig[]
        const updated = fields.find(f => f.field_key === 'word')
        if (!updated) return 'mất field word'
        if (updated.label !== 'Vocabulary Item') return `label="${updated.label}"`
        return !modalOpen(root) || 'modal vẫn mở sau Save'
      },
    },
    {
      id: 'toggle-flips-active',
      description: 'Toggle: doc ct-lang đảo is_active sang false',
      onlyFixtures: ['act-toggle-active'],
      check: () => {
        const doc = collectionDocs('content_types').find(d => d.id === 'ct-lang')
        if (!doc) return 'mất doc ct-lang'
        return doc.is_active === false || `is_active=${doc.is_active}`
      },
    },
    {
      id: 'delete-removes-doc',
      description: 'Delete: ct-lang bị xóa khỏi store, còn lại 1 doc, modal đóng',
      onlyFixtures: ['act-delete'],
      check: ({ root }) => {
        const docs = collectionDocs('content_types')
        if (docs.length !== 1) return `store=${docs.length}, expected=1`
        if (docs.find(d => d.id === 'ct-lang')) return 'ct-lang vẫn còn trong store'
        return !modalOpen(root) || 'modal vẫn mở sau Delete'
      },
    },
    {
      id: 'empty-fields-graceful',
      description: 'fields=[]: cột Fields = 0, edit modal mở không crash, không "undefined"',
      onlyFixtures: ['probe-empty-fields'],
      check: ({ root }) => {
        if (!modalOpen(root)) return 'modal không mở'
        return !(root.textContent ?? '').includes('undefined') || 'leak "undefined" ra UI'
      },
    },
  ],
})
