import type { ComponentProps } from 'react'
import { z } from 'zod'
import { TopicSelector } from '@/components/create/TopicSelector'
import { ToastProvider } from '@/components/ui/Toast'
import { registerUnit } from '@/verify/core/registry'
import { fn } from '@/verify/core/schema-helpers'
import { clickButtonByText, collectionDocs } from '@/verify/specs/manager-helpers'
import { FormType } from '@/types'
import type { TopicSelection } from '@/components/create/TopicSelector'
import type { ActContext } from '@/verify/core/types'

type TopicSelectorProps = ComponentProps<typeof TopicSelector>

// 検証用コメント。
const TOPIC_SEED = {
  topics: [
    { id: 't-fe', name: 'Frontend', form_type: FormType.IT, is_active: true, sort_order: 2 },
    { id: 't-be', name: 'Backend', form_type: FormType.IT, is_active: true, sort_order: 1 },
    { id: 't-old', name: 'Legacy', form_type: FormType.IT, is_active: false, sort_order: 3 },
    { id: 't-lang', name: 'Grammar', form_type: FormType.LANGUAGE, is_active: true, sort_order: 1 },
  ],
}

// Spy cho onChange — reset trong act
const changeSpy = { count: 0, lastValue: null as TopicSelection | null }
const recordChange = (selection: TopicSelection) => {
  changeSpy.count++
  changeSpy.lastValue = selection
}
const legacyResolutionSpy = { count: 0, lastValue: null as TopicSelection | null }
const recordLegacyResolution = (selection: TopicSelection) => {
  legacyResolutionSpy.count++
  legacyResolutionSpy.lastValue = selection
}
const noop = () => undefined

function clickTopic(root: HTMLElement, name: string): void {
  const btn = Array.from(root.querySelectorAll('button')).find(b =>
    b.textContent?.trim() === name
  )
  if (!btn) throw new Error(`topic が見つかりません "${name}"`)
  btn.click()
}

async function submitNewTopic(ctx: ActContext, name: string): Promise<void> {
  clickButtonByText(ctx.root, 'New topic')
  await ctx.wait(0)
  await ctx.type('input[aria-label="Topic name"]', name)
  clickButtonByText(ctx.root, 'Create topic')
  await ctx.wait(20)
}

registerUnit<TopicSelectorProps>({
  id: 'TopicSelector',
  title: 'TopicSelector',
  description: '検証ケース。',
  kind: 'component',
  render: props => (
    <ToastProvider>
      <TopicSelector {...props} />
    </ToastProvider>
  ),
  propsSchema: z.object({
    selectedIds: z.array(z.string()),
    selectedNames: z.array(z.string()),
    onChange: fn<(selection: TopicSelection) => void>(),
    onLoadingChange: fn<(loading: boolean) => void>().optional(),
  }),
  fixtures: [
    {
      id: 'loaded',
      description: '検証ケース。',
      props: { selectedIds: ['t-be'], selectedNames: ['Backend'], onChange: noop },
      mocks: { firestore: TOPIC_SEED },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'empty',
      description: '検証ケース。',
      props: { selectedIds: [], selectedNames: [], onChange: noop },
      mocks: { firestore: { topics: [] } },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'act-toggle-on',
      description: '検証ケース。',
      props: { selectedIds: ['t-be'], selectedNames: ['Backend'], onChange: recordChange },
      mocks: { firestore: TOPIC_SEED },
      act: async ctx => {
        await ctx.wait(50)
        changeSpy.count = 0
        changeSpy.lastValue = null
        clickTopic(ctx.root, 'Frontend')
        await ctx.wait(0)
      },
    },
    {
      id: 'act-toggle-off',
      description: '検証ケース。',
      props: { selectedIds: ['t-be'], selectedNames: ['Backend'], onChange: recordChange },
      mocks: { firestore: TOPIC_SEED },
      act: async ctx => {
        await ctx.wait(50)
        changeSpy.count = 0
        changeSpy.lastValue = null
        clickTopic(ctx.root, 'Backend')
        await ctx.wait(0)
      },
    },
    {
      id: 'probe-only-foreign-formtype',
      probe: true,
      description: '検証ケース。',
      props: { selectedIds: [], selectedNames: [], onChange: noop },
      mocks: {
        firestore: {
          topics: [
            { id: 't1', name: 'Grammar', form_type: FormType.LANGUAGE, is_active: true, sort_order: 1 },
          ],
        },
      },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'create-topic',
      description: 'Create modal から新しい Topic を作成して自動選択する。',
      props: { selectedIds: [], selectedNames: [], onChange: recordChange },
      mocks: { firestore: TOPIC_SEED },
      act: async ctx => {
        await ctx.wait(50)
        changeSpy.count = 0
        changeSpy.lastValue = null
        await submitNewTopic(ctx, 'Cloud Security')
      },
    },
    {
      id: 'active-duplicate-selects-existing',
      description: 'active Topic と大文字小文字・空白だけが違う名前は重複作成せず既存を選択する。',
      props: { selectedIds: [], selectedNames: [], onChange: recordChange },
      mocks: { firestore: TOPIC_SEED },
      act: async ctx => {
        await ctx.wait(50)
        changeSpy.count = 0
        changeSpy.lastValue = null
        await submitNewTopic(ctx, '  bAcKeNd  ')
      },
    },
    {
      id: 'inactive-duplicate-cancel',
      description: 'inactive Topic の再有効化をキャンセルすると状態と選択を変更しない。',
      props: { selectedIds: [], selectedNames: [], onChange: recordChange },
      mocks: { firestore: TOPIC_SEED },
      act: async ctx => {
        await ctx.wait(50)
        changeSpy.count = 0
        changeSpy.lastValue = null
        await submitNewTopic(ctx, ' legacy ')
        clickButtonByText(ctx.root, 'Cancel')
        await ctx.wait(20)
      },
    },
    {
      id: 'inactive-duplicate-reactivate',
      description: '確認後に inactive Topic を再有効化して自動選択する。',
      props: { selectedIds: [], selectedNames: [], onChange: recordChange },
      mocks: { firestore: TOPIC_SEED },
      act: async ctx => {
        await ctx.wait(50)
        changeSpy.count = 0
        changeSpy.lastValue = null
        await submitNewTopic(ctx, 'LEGACY')
        clickButtonByText(ctx.root, 'Reactivate topic')
        await ctx.wait(20)
      },
    },
    {
      id: 'create-firestore-error',
      description: 'Topic 作成の Firestore 失敗時は modal と入力を維持する。',
      props: { selectedIds: [], selectedNames: [], onChange: recordChange },
      mocks: {
        firestore: {
          ...TOPIC_SEED,
          __verify_failures__: [
            { id: 'fail-add', operation: 'addDoc', collection: 'topics', message: 'Write denied' },
          ],
        },
      },
      act: async ctx => {
        await ctx.wait(50)
        changeSpy.count = 0
        changeSpy.lastValue = null
        await submitNewTopic(ctx, 'Observability')
      },
    },
    {
      id: 'reactivate-firestore-error',
      description: '再有効化の Firestore 失敗時は確認 modal を維持する。',
      props: { selectedIds: [], selectedNames: [], onChange: recordChange },
      mocks: {
        firestore: {
          ...TOPIC_SEED,
          __verify_failures__: [
            { id: 'fail-update', operation: 'updateDoc', collection: 'topics', message: 'Write denied' },
          ],
        },
      },
      act: async ctx => {
        await ctx.wait(50)
        changeSpy.count = 0
        changeSpy.lastValue = null
        await submitNewTopic(ctx, 'Legacy')
        clickButtonByText(ctx.root, 'Reactivate topic')
        await ctx.wait(20)
      },
    },
    {
      id: 'legacy-selection-resolution',
      description: '旧 session の ID を active Topic 名へ再解決し、inactive/missing ID を除外する。',
      props: {
        selectedIds: ['t-be', 't-old', 'missing'],
        selectedNames: ['Old Backend Name', 'Legacy', 'Missing'],
        onChange: recordLegacyResolution,
      },
      mocks: { firestore: TOPIC_SEED },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
  ],
  invariants: [
    {
      id: 'only-active-it-topics',
      description: '検証ケース。',
      onlyFixtures: ['loaded', 'act-toggle-on', 'act-toggle-off'],
      check: ({ root }) => {
        const names = Array.from(root.querySelectorAll('button[data-topic-id]')).map(b => b.textContent?.trim())
        return (
          JSON.stringify(names) === JSON.stringify(['Backend', 'Frontend']) ||
          `topics: ${names.join(' | ')}`
        )
      },
    },
    {
      id: 'selected-chip-active-variant',
      description: '検証ケース。',
      onlyFixtures: ['loaded'],
      check: ({ root }) => {
        const active = root.querySelectorAll('[data-verify-unit="Badge"][data-verify-variant="active"]').length
        const neutral = root.querySelectorAll('[data-verify-unit="Badge"][data-verify-variant="neutral"]').length
        return (active === 1 && neutral === 1) || `active=${active}, neutral=${neutral}`
      },
    },
    {
      id: 'empty-no-chips',
      description: '検証ケース。',
      onlyFixtures: ['empty', 'probe-only-foreign-formtype'],
      check: ({ root, contract }) => {
        if (contract.count !== '0') return `contract.count="${contract.count}"`
        const buttons = root.querySelectorAll('button[data-topic-id]').length
        return buttons === 0 || `buttons=${buttons}, expected=0`
      },
    },
    {
      id: 'create-action-visible',
      description: '検証ケース。',
      check: ({ root }) =>
        Array.from(root.querySelectorAll('button')).some(button => button.textContent?.trim() === 'New topic') ||
        '不足しています',
    },
    {
      id: 'toggle-on-adds',
      description: '検証ケース。',
      onlyFixtures: ['act-toggle-on'],
      check: () =>
        (changeSpy.count === 1 &&
          JSON.stringify(changeSpy.lastValue) === JSON.stringify({
            ids: ['t-be', 't-fe'],
            names: ['Backend', 'Frontend'],
          })) ||
        `count=${changeSpy.count}, lastValue=${JSON.stringify(changeSpy.lastValue)}`,
    },
    {
      id: 'toggle-off-removes',
      description: '検証ケース。',
      onlyFixtures: ['act-toggle-off'],
      check: () =>
        (changeSpy.count === 1 && JSON.stringify(changeSpy.lastValue) === JSON.stringify({ ids: [], names: [] })) ||
        `count=${changeSpy.count}, lastValue=${JSON.stringify(changeSpy.lastValue)}`,
    },
    {
      id: 'new-topic-created-and-selected',
      description: '新規 Topic は max sort_order + 1 で保存され自動選択される',
      onlyFixtures: ['create-topic'],
      check: () => {
        const created = collectionDocs('topics').find(doc => doc.name === 'Cloud Security')
        if (!created) return '新しい Topic doc がない'
        if (created.user_id !== 'test-user') return `user_id=${String(created.user_id)}`
        if (created.form_type !== FormType.IT) return `form_type=${String(created.form_type)}`
        if (created.is_active !== true) return `is_active=${String(created.is_active)}`
        if (created.sort_order !== 4) return `sort_order=${String(created.sort_order)}`
        return JSON.stringify(changeSpy.lastValue) === JSON.stringify({
          ids: [created.id],
          names: ['Cloud Security'],
        }) || `selection=${JSON.stringify(changeSpy.lastValue)}`
      },
    },
    {
      id: 'active-duplicate-not-created',
      description: 'active duplicate は既存 Topic を選択し doc を追加しない',
      onlyFixtures: ['active-duplicate-selects-existing'],
      check: () => {
        if (collectionDocs('topics').length !== TOPIC_SEED.topics.length) {
          return `docs=${collectionDocs('topics').length}`
        }
        return JSON.stringify(changeSpy.lastValue) === JSON.stringify({ ids: ['t-be'], names: ['Backend'] }) ||
          `selection=${JSON.stringify(changeSpy.lastValue)}`
      },
    },
    {
      id: 'inactive-cancel-no-change',
      description: '再有効化 cancel は Firestore と選択を変更しない',
      onlyFixtures: ['inactive-duplicate-cancel'],
      check: () => {
        const topic = collectionDocs('topics').find(doc => doc.id === 't-old')
        if (topic?.is_active !== false) return `is_active=${String(topic?.is_active)}`
        return changeSpy.count === 0 || `change count=${changeSpy.count}`
      },
    },
    {
      id: 'inactive-confirm-reactivates',
      description: '再有効化 confirm は doc を active にして選択する',
      onlyFixtures: ['inactive-duplicate-reactivate'],
      check: () => {
        const topic = collectionDocs('topics').find(doc => doc.id === 't-old')
        if (topic?.is_active !== true) return `is_active=${String(topic?.is_active)}`
        return JSON.stringify(changeSpy.lastValue) === JSON.stringify({ ids: ['t-old'], names: ['Legacy'] }) ||
          `selection=${JSON.stringify(changeSpy.lastValue)}`
      },
    },
    {
      id: 'create-error-keeps-modal',
      description: '作成失敗時は doc/selection を変更せず modal と error を維持する',
      onlyFixtures: ['create-firestore-error'],
      check: ({ root }) => {
        if (collectionDocs('topics').some(doc => doc.name === 'Observability')) return '失敗後に doc が作られた'
        if (changeSpy.count !== 0) return `change count=${changeSpy.count}`
        if (!root.querySelector('input[aria-label="Topic name"]')) return 'create modal が閉じた'
        return (root.textContent ?? '').includes('Failed to create the topic. Please try again.') ||
          'error toast がない'
      },
    },
    {
      id: 'reactivate-error-keeps-confirmation',
      description: '再有効化失敗時は inactive のまま確認 modal と error を維持する',
      onlyFixtures: ['reactivate-firestore-error'],
      check: ({ root }) => {
        const topic = collectionDocs('topics').find(doc => doc.id === 't-old')
        if (topic?.is_active !== false) return `is_active=${String(topic?.is_active)}`
        if (changeSpy.count !== 0) return `change count=${changeSpy.count}`
        if (!(root.textContent ?? '').includes('Reactivate topic?')) return '確認 modal が閉じた'
        return (root.textContent ?? '').includes('Failed to reactivate the topic. Please try again.') ||
          'error toast がない'
      },
    },
    {
      id: 'legacy-selection-is-refreshed',
      description: '旧 session は active ID と現在名だけに正規化される',
      onlyFixtures: ['legacy-selection-resolution'],
      check: () =>
        (legacyResolutionSpy.count === 1 &&
          JSON.stringify(legacyResolutionSpy.lastValue) === JSON.stringify({
            ids: ['t-be'],
            names: ['Backend'],
          })) ||
        `count=${legacyResolutionSpy.count}, selection=${JSON.stringify(legacyResolutionSpy.lastValue)}`,
    },
  ],
})
