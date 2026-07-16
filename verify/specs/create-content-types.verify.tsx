import { z } from 'zod'
import { CreateContent } from '@/app/create/page'
import { registerUnit } from '@/verify/core/registry'
import type { UserContentType } from '@/types'

const USER_CONTENT_TYPE = {
  id: 'form_language__test-user',
  user_id: 'test-user',
  code: 'language',
  name: 'Language',
  description: 'Vocabulary cards',
  icon: 'Languages',
  fields: [],
  is_active: true,
  sort_order: 1,
  created_at: { seconds: 0, nanoseconds: 0, toDate: () => new Date(0) },
  updated_at: { seconds: 0, nanoseconds: 0, toDate: () => new Date(0) },
}

type E2EState = 'empty' | 'conflict'

interface VerifyProps {
  e2eState?: E2EState
}

function e2eContentTypes(state: E2EState): UserContentType[] {
  if (state === 'empty') return []
  // language ↔ form_language は同じ route で競合 (両方非表示)、quiz は競合せず利用可能。
  return [
    USER_CONTENT_TYPE,
    { ...USER_CONTENT_TYPE, id: 'legacy-language', code: 'form_language' },
    {
      ...USER_CONTENT_TYPE,
      id: 'quiz-type',
      code: 'quiz',
      name: 'Quiz',
      fields: [
        { field_key: 'prompt', label: 'Prompt', type: 'text', is_required: true, is_session_persistent: false, sort_order: 1, data_source: null, placeholder: null },
      ],
    },
  ]
}

registerUnit<VerifyProps>({
  id: 'CreateContentTypes',
  title: 'Create page Content Types',
  description: 'Create は認証済み user workspace の Content Types だけを使用する。',
  kind: 'feature',
  render: props => (
    <CreateContent
      loadContentTypes={props.e2eState
        ? async () => e2eContentTypes(props.e2eState!)
        : undefined}
    />
  ),
  propsSchema: z.object({ e2eState: z.enum(['empty', 'conflict']).optional() }),
  fixtures: [
    {
      id: 'auth-loading',
      description: 'Auth 復元中は workspace query を開始せず loading state を維持する。',
      props: {},
      mocks: {
        auth: { user: { uid: 'test-user', email: 'user@example.com' }, loading: true },
        firestore: { user_content_types: [USER_CONTENT_TYPE] },
      },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'empty-workspace',
      description: 'User snapshot が空なら Settings への empty state を表示する。',
      props: {},
      mocks: { firestore: { user_content_types: [] } },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'global-default-is-not-fallback',
      description: 'Global default が存在しても user snapshot が空なら fallback しない。',
      props: {},
      mocks: {
        firestore: {
          content_types: [{ ...USER_CONTENT_TYPE, id: 'form_language' }],
          user_content_types: [{ ...USER_CONTENT_TYPE, id: 'other-user-type', user_id: 'other-user' }],
        },
      },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'probe-conflicting-routing-codes',
      probe: true,
      description: 'Probe: 競合した code は自動選択せず非表示にし、非ブロッキング警告を出す。競合しない type は使える。',
      props: {},
      mocks: {
        firestore: {
          user_content_types: [
            USER_CONTENT_TYPE,
            { ...USER_CONTENT_TYPE, id: 'legacy-language', code: 'form_language' },
            {
      ...USER_CONTENT_TYPE,
      id: 'quiz-type',
      code: 'quiz',
      name: 'Quiz',
      fields: [
        { field_key: 'prompt', label: 'Prompt', type: 'text', is_required: true, is_session_persistent: false, sort_order: 1, data_source: null, placeholder: null },
      ],
    },
          ],
        },
      },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'e2e-empty-workspace',
      description: 'E2E: Firestore を使わず実 component の empty state と Settings action を確認する。',
      props: { e2eState: 'empty' },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'e2e-conflicting-routing-codes',
      description: 'E2E: Firestore を使わず実 component の非ブロッキング警告 + 残存 type を確認する。',
      props: { e2eState: 'conflict' },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
  ],
  invariants: [
    {
      id: 'waits-for-auth',
      description: 'Auth loading 中は Content Type を選択せず skeleton を維持する。',
      onlyFixtures: ['auth-loading'],
      check: ({ root, contract }) => (
        (contract.loading === 'true'
          && !root.textContent?.includes('No Content Types configured'))
        || `loading=${contract.loading}, text=${root.textContent}`
      ),
    },
    {
      id: 'empty-links-to-settings',
      description: 'Empty state から Settings に遷移できる。',
      onlyFixtures: ['empty-workspace'],
      check: ({ root, contract }) => {
        if (contract.state !== 'empty') return `state=${contract.state}`
        if (!root.textContent?.includes('No Content Types configured')) return 'empty message がない'
        const link = root.querySelector<HTMLAnchorElement>('a[href="/settings"]')
        return link?.textContent?.includes('Open Content Type settings') || 'Settings link がない'
      },
    },
    {
      id: 'no-global-fallback-or-cross-user-read',
      description: 'Global/他 user の document を表示せず empty state のままにする。',
      onlyFixtures: ['global-default-is-not-fallback'],
      check: ({ root, contract }) => (
        (contract.state === 'empty' && root.textContent?.includes('No Content Types configured'))
        || `state=${contract.state}, text=${root.textContent}`
      ),
    },
    {
      id: 'duplicate-hides-conflicts-not-blocking',
      description: '競合した type は非表示 + 警告を出すが、競合しない type は作成に使える。',
      onlyFixtures: ['probe-conflicting-routing-codes', 'e2e-conflicting-routing-codes'],
      check: ({ root, contract }) => (
        (contract.warning === 'true'
          && contract.state === 'ready'
          && root.textContent?.includes('share a routing code and were hidden')
          && root.textContent?.includes('Quiz')
          && !!root.querySelector('form'))
        || `state=${contract.state}, warning=${contract.warning}, text=${root.textContent}`
      ),
    },
    {
      id: 'e2e-empty-state',
      description: 'Injected empty snapshot でも production と同じ empty state を表示する。',
      onlyFixtures: ['e2e-empty-workspace'],
      check: ({ root, contract }) => (
        (contract.state === 'empty'
          && root.textContent?.includes('No Content Types configured')
          && root.querySelector('a[href="/settings"]')?.textContent?.includes('Open Content Type settings'))
        || `state=${contract.state}, text=${root.textContent}`
      ),
    },
  ],
})
