import { registerVerifier } from '@/verify/core/registry'
import type { Check } from '@/verify/core/types'

export const invariantVerifier = registerVerifier({
  id: 'invariants',
  description: '検証ケース。',
  run({ unit, fixture, root, contract }): Check[] {
    const checks: Check[] = []
    for (const invariant of unit.invariants) {
      if (invariant.onlyFixtures && !invariant.onlyFixtures.includes(fixture.id)) {
        continue
      }
      let outcome: boolean | string
      try {
        outcome = invariant.check({ root, props: fixture.props, fixture, contract })
      } catch (e) {
        outcome = `exception: ${e instanceof Error ? e.message : String(e)}`
      }
      checks.push({
        verifier: 'invariants',
        status: outcome === true ? 'ok' : 'fail',
        label: invariant.description,
        detail: typeof outcome === 'string' ? outcome : undefined,
      })
    }
    return checks
  },
})
