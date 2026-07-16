import { z } from 'zod'
import { ResyncCards } from '@/components/settings/ResyncCards'
import { registerUnit } from '@/verify/core/registry'
import { FormType } from '@/types'
import type { UserContentType } from '@/types'

const BASE_CONTENT_TYPE = {
  id: 'form_language__test-user',
  user_id: 'test-user',
  code: 'language',
  name: 'Language',
  description: 'Vocabulary cards',
  icon: 'Languages',
  fields: [],
  is_active: true,
  sort_order: 10,
  created_at: { seconds: 0, nanoseconds: 0, toDate: () => new Date(0) },
  updated_at: { seconds: 0, nanoseconds: 0, toDate: () => new Date(0) },
}

function contentTypeOptions(root: HTMLElement): HTMLOptionElement[] {
  const select = root.querySelector<HTMLSelectElement>('select[aria-label="Content type"]')
  return select ? Array.from(select.options) : []
}

type E2EState = 'workspace' | 'conflict'

interface VerifyProps {
  ankiConnected: boolean
  e2eState?: E2EState
}

function injectedContentTypes(state: E2EState): UserContentType[] {
  const contentTypes = state === 'workspace'
    ? [
        { ...BASE_CONTENT_TYPE, id: 'form_it__test-user', code: 'it', name: 'IT', sort_order: 20 },
        BASE_CONTENT_TYPE,
        { ...BASE_CONTENT_TYPE, id: 'inactive', code: 'general', name: 'General', is_active: false, sort_order: 0 },
      ]
    : [
        BASE_CONTENT_TYPE,
        { ...BASE_CONTENT_TYPE, id: 'legacy-language', code: FormType.LANGUAGE },
      ]
  return contentTypes
}

registerUnit<VerifyProps>({
  id: 'ResyncCards',
  title: 'ResyncCards',
  description: 'Resync filter は user workspace の active Content Types を code で解決する。',
  kind: 'component',
  render: props => (
    <ResyncCards
      ankiConnected={props.ankiConnected}
      loadOptions={props.e2eState
        ? async () => ({
            contentTypes: injectedContentTypes(props.e2eState!),
            decks: [],
            cardTypes: [],
          })
        : undefined}
    />
  ),
  propsSchema: z.object({
    ankiConnected: z.boolean(),
    e2eState: z.enum(['workspace', 'conflict']).optional(),
  }),
  fixtures: [
    {
      id: 'workspace-content-types',
      description: 'Active document だけを sort_order 順に表示し、copied ID ではなく code で routing する。',
      props: { ankiConnected: false },
      mocks: {
        firestore: {
          user_content_types: [
            { ...BASE_CONTENT_TYPE, id: 'form_it__test-user', code: 'it', name: 'IT', sort_order: 20 },
            BASE_CONTENT_TYPE,
            { ...BASE_CONTENT_TYPE, id: 'inactive', code: 'general', name: 'General', is_active: false, sort_order: 0 },
            { ...BASE_CONTENT_TYPE, id: 'foreign', user_id: 'other-user', code: 'foreign', name: 'Foreign', sort_order: 0 },
          ],
          decks: [],
          card_types: [],
        },
      },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'auth-loading',
      description: 'Auth 復元中は Content Type query を待機する。',
      props: { ankiConnected: false },
      mocks: {
        auth: { user: { uid: 'test-user', email: 'user@example.com' }, loading: true },
        firestore: { user_content_types: [BASE_CONTENT_TYPE] },
      },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'global-default-is-not-fallback',
      description: 'Global collection だけに document があっても Resync option に使用しない。',
      props: { ankiConnected: false },
      mocks: {
        firestore: {
          content_types: [{ ...BASE_CONTENT_TYPE, id: 'form_language' }],
          user_content_types: [],
          decks: [],
          card_types: [],
        },
      },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'probe-conflicting-routing-codes',
      probe: true,
      description: 'Probe: routing code が競合する場合は option を作らず Settings での修正を要求する。',
      props: { ankiConnected: false },
      mocks: {
        firestore: {
          user_content_types: [
            BASE_CONTENT_TYPE,
            { ...BASE_CONTENT_TYPE, id: 'legacy-language', code: FormType.LANGUAGE },
          ],
          decks: [],
          card_types: [],
        },
      },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'e2e-workspace-content-types',
      description: 'E2E: 実 Resync component で active/sort/code routing を確認する。',
      props: { ankiConnected: false, e2eState: 'workspace' },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'e2e-conflicting-routing-codes',
      description: 'E2E: 実 Resync component で duplicate blocking state を確認する。',
      props: { ankiConnected: false, e2eState: 'conflict' },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
  ],
  invariants: [
    {
      id: 'active-sorted-code-routing',
      description: 'User 所有の active option を sort 順に code resolver の値で表示する。',
      onlyFixtures: ['workspace-content-types', 'e2e-workspace-content-types'],
      check: ({ root, contract }) => {
        const options = contentTypeOptions(root)
        const values = options.map(option => option.value)
        const labels = options.map(option => option.textContent)
        if (contract.contenttypestate !== 'ready') return `state=${contract.contenttypestate}`
        if (JSON.stringify(values) !== JSON.stringify(['', FormType.LANGUAGE, FormType.IT])) {
          return `values=${JSON.stringify(values)}`
        }
        return (
          JSON.stringify(labels) === JSON.stringify(['All', 'Language', 'IT'])
          || `labels=${JSON.stringify(labels)}`
        )
      },
    },
    {
      id: 'waits-for-auth',
      description: 'Auth loading 中は user option を読み込まない。',
      onlyFixtures: ['auth-loading'],
      check: ({ root, contract }) => (
        (contract.contenttypesloading === 'true'
          && contentTypeOptions(root).map(option => option.value).join(',') === '')
        || `loading=${contract.contenttypesloading}`
      ),
    },
    {
      id: 'no-global-fallback',
      description: 'Global collection を fallback に使わず empty state を表示する。',
      onlyFixtures: ['global-default-is-not-fallback'],
      check: ({ root, contract }) => (
        (contract.contenttypestate === 'empty'
          && contentTypeOptions(root).length === 1
          && root.textContent?.includes('No active Content Types are configured.'))
        || `state=${contract.contenttypestate}, options=${contentTypeOptions(root).length}`
      ),
    },
    {
      id: 'duplicate-is-blocking',
      description: 'Routing code 競合時は option を選ばず Resync action を無効化する。',
      onlyFixtures: ['probe-conflicting-routing-codes', 'e2e-conflicting-routing-codes'],
      check: ({ root, contract }) => {
        const button = Array.from(root.querySelectorAll<HTMLButtonElement>('button'))
          .find(element => element.textContent?.includes('Re-sync cards'))
        return (
          (contract.contenttypestate === 'error'
            && contentTypeOptions(root).length === 1
            && root.textContent?.includes('Conflicting Content Type codes found')
            && button?.disabled === true)
          || `state=${contract.contenttypestate}, disabled=${button?.disabled}`
        )
      },
    },
  ],
})
