import { z } from 'zod'
import { validateContentTypeConfig } from '@/lib/contentTypes'
import { validateContentTypeBlueprint } from '@/lib/create/formBlueprint'
import { registerUnit } from '@/verify/core/registry'
import { verifyAttrs } from '@/verify/core/contract'

const RESERVED_FIELD = {
  field_key: '_query_custom',
  label: 'Reserved',
  type: 'text' as const,
  is_required: true,
  is_session_persistent: false,
  sort_order: 0,
}

function EntryQueryPrefixGuard() {
  const configResult = validateContentTypeConfig({
    code: 'custom_type',
    name: 'Custom',
    description: '',
    icon: '',
    fields: [RESERVED_FIELD],
    is_active: true,
    sort_order: 0,
  })
  const runtimeResult = validateContentTypeBlueprint({
    code: 'custom_type',
    name: 'Custom',
    fields: [RESERVED_FIELD],
  })

  return (
    <div {...verifyAttrs({
      unit: 'EntryQueryPrefixGuard',
      configRejected: !configResult.success,
      runtimeRejected: !runtimeResult.success,
    })}>
      <output aria-label="Content Type schema result">
        {configResult.success ? 'Accepted' : 'Rejected'}
      </output>
      <output aria-label="Runtime blueprint result">
        {runtimeResult.success ? 'Accepted' : 'Rejected'}
      </output>
    </div>
  )
}

registerUnit<Record<string, never>>({
  id: 'EntryQueryPrefixGuard',
  title: 'Entry Query Prefix Guard',
  description: 'System query namespace を Content Type schema と runtime の両方で拒否する。',
  kind: 'feature',
  render: () => <EntryQueryPrefixGuard />,
  propsSchema: z.object({}),
  fixtures: [{
    id: 'reserved-prefix',
    probe: true,
    description: 'Persisted/edited Content Type が `_query_` field を導入できない。',
    props: {},
  }],
  invariants: [{
    id: 'reserved-prefix-rejected',
    description: 'Schema validation と runtime blueprint validation が両方 reject する。',
    check: ({ root }) => (
      Array.from(root.querySelectorAll('output'))
        .every(output => output.textContent === 'Rejected')
      || 'reserved prefix was accepted'
    ),
  }],
})
