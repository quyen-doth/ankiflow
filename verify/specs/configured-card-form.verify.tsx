import { z } from 'zod'
import { CardFormContent } from '@/components/create/CardForm'
import { registerUnit } from '@/verify/core/registry'
import type { CardFormBlueprint } from '@/lib/create/formBlueprint'
import type { PendingEntry } from '@/lib/pendingEntry'

const BLUEPRINT: CardFormBlueprint = {
  formType: 'custom_configured',
  primaryFieldKey: 'prompt',
  coreFields: [
    {
      key: 'prompt',
      label: 'Prompt',
      type: 'text',
      required: true,
      persistent: false,
      placeholder: 'Question to learn',
    },
    {
      key: 'audience',
      label: 'Audience',
      type: 'text',
      required: true,
      persistent: true,
      placeholder: 'Who is this for?',
    },
    {
      key: 'note',
      label: 'Optional note',
      type: 'textarea',
      required: false,
      persistent: false,
    },
  ],
  configBlocks: [],
  generate: {
    mode: 'local',
    content: values => ({ ...values, word: values.prompt, meaning_vi: values.note || values.audience }),
  },
}

function submitForm(root: HTMLElement): void {
  const form = root.querySelector<HTMLFormElement>('form')
  if (!form) throw new Error('form が見つからない')
  form.requestSubmit()
}

function pendingEntry(): PendingEntry | null {
  const raw = localStorage.getItem('ankiflow_pending_result')
  return raw ? JSON.parse(raw) as PendingEntry : null
}

registerUnit<Record<string, never>>({
  id: 'ConfiguredCardForm',
  title: 'Configured CardForm fields',
  description: 'fields[] の required/persistent metadata を CardForm runtime で検証する。',
  kind: 'feature',
  render: () => <CardFormContent blueprint={BLUEPRINT} navigate={() => undefined} />,
  propsSchema: z.object({}),
  fixtures: [
    {
      id: 'persistent-field-hydrates',
      description: 'Persistent core field は session.fieldValues から復元する。',
      props: {},
      mocks: {
        localStorage: {
          ankiflow_session_custom_configured: JSON.stringify({
            fieldValues: { audience: 'Software engineers' },
          }),
        },
        pathname: '/create',
      },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'submit-resets-only-nonpersistent',
      description: 'Generate 成功後、nonpersistent field を reset し persistent field を保持する。',
      props: {},
      mocks: { pathname: '/create' },
      act: async ctx => {
        await ctx.wait(50)
        await ctx.type('input[aria-label="Prompt"]', 'Explain event loops')
        await ctx.type('input[aria-label="Audience"]', 'Beginners')
        submitForm(ctx.root)
        await ctx.wait(100)
      },
    },
    {
      id: 'probe-all-required-fields',
      probe: true,
      description: 'Probe: primary だけ入力しても他の required field が空なら submit を拒否する。',
      props: {},
      mocks: { pathname: '/create' },
      act: async ctx => {
        await ctx.wait(50)
        await ctx.type('input[aria-label="Prompt"]', 'Explain event loops')
        submitForm(ctx.root)
        await ctx.wait(50)
      },
    },
  ],
  invariants: [
    {
      id: 'persistent-value-hydrated',
      description: 'Session の persistent field value を input に復元する。',
      onlyFixtures: ['persistent-field-hydrates'],
      check: ({ root }) => root.querySelector<HTMLInputElement>('input[aria-label="Audience"]')?.value === 'Software engineers'
        || 'Audience が session から復元されていない',
    },
    {
      id: 'success-resets-by-persistence',
      description: '成功後は Prompt を空にし、Audience と session.fieldValues を保持する。',
      onlyFixtures: ['submit-resets-only-nonpersistent'],
      check: ({ root }) => {
        const prompt = root.querySelector<HTMLInputElement>('input[aria-label="Prompt"]')?.value
        const audience = root.querySelector<HTMLInputElement>('input[aria-label="Audience"]')?.value
        const session = JSON.parse(localStorage.getItem('ankiflow_session_custom_configured') || '{}') as {
          fieldValues?: Record<string, string>
        }
        if (!pendingEntry()) return 'pending entry が保存されていない'
        if (prompt !== '') return `Prompt=${prompt}`
        if (audience !== 'Beginners') return `Audience=${audience}`
        return session.fieldValues?.audience === 'Beginners'
          || `session=${JSON.stringify(session)}`
      },
    },
    {
      id: 'all-required-fields-block-submit',
      description: '空の required field に英語エラーを表示し、generation side effect を起こさない。',
      onlyFixtures: ['probe-all-required-fields'],
      check: ({ root }) => {
        if (!root.textContent?.includes('Audience is required.')) return 'field error が表示されていない'
        if (root.querySelector('input[aria-label="Audience"]')?.getAttribute('aria-invalid') !== 'true') {
          return 'Audience に aria-invalid がない'
        }
        return pendingEntry() === null || 'validation failure でも pending entry が保存された'
      },
    },
  ],
})
