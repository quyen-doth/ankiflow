import { useState } from 'react'
import { z } from 'zod'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { HISTORY_SEARCH_DEBOUNCE_MS } from '@/lib/history/historyClient'
import { verifyAttrs } from '@/verify/core/contract'
import { registerUnit } from '@/verify/core/registry'

function HistorySearchDebounceProbe() {
  const [draft, setDraft] = useState('')
  const settled = useDebouncedValue(draft, HISTORY_SEARCH_DEBOUNCE_MS)

  return (
    <div {...verifyAttrs({
      unit: 'HistorySearchDebounce',
      settled,
    })}>
      <label htmlFor="history-search-debounce">Search</label>
      <input
        id="history-search-debounce"
        value={draft}
        onChange={event => setDraft(event.target.value)}
      />
      <output aria-label="Settled search">{settled}</output>
    </div>
  )
}

registerUnit<Record<string, never>>({
  id: 'HistorySearchDebounce',
  title: 'HistorySearchDebounce',
  description: 'History substring search の request debounce。',
  kind: 'feature',
  render: () => <HistorySearchDebounceProbe />,
  propsSchema: z.object({}),
  fixtures: [
    {
      id: 'rapid-input',
      probe: true,
      description: 'Probe: rapid input の最後の keyword だけを debounce 後に適用する。',
      props: {},
      act: async context => {
        await context.type('#history-search-debounce', 'a')
        await context.type('#history-search-debounce', 'al')
        await context.type('#history-search-debounce', 'alpha')
        await context.wait(HISTORY_SEARCH_DEBOUNCE_MS + 50)
      },
    },
  ],
  invariants: [
    {
      id: 'one-settled-update',
      description: 'Rapid input の中間値を適用せず、最後の keyword だけを一度適用する。',
      check: ({ root }) => {
        const settled = root.querySelector('output')?.textContent
        return settled === 'alpha' || `settled keyword が不正です: ${settled}`
      },
    },
  ],
})
