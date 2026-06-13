import { describe, expect, it } from 'vitest'

// Side-effect imports — đăng ký toàn bộ verifiers và specs
import '@/verify/verifiers'
import '@/verify/specs'

import { allUnits } from '@/verify/core/registry'
import { runFixture } from '@/verify/core/runner'

/**
 * Các cặp unit::fixture cố tình FAIL — probe vi phạm invariant để chứng minh
 * framework bắt được lỗi thật, không chỉ xác nhận điều đúng.
 */
const EXPECTED_FAIL = new Set([
  // Phase A
  'Badge::probe-empty-label',
  'Tabs::probe-active-not-in-list',
  // Phase B
  'EmptyState::probe-empty-title',
  'FilterBar::probe-empty-filter-label',
  'DataTable::probe-empty-columns',
  'Input::probe-unlabeled',
  'Textarea::probe-unlabeled',
  // Phase C
  'SectionDivider::probe-empty-label',
])

describe('verification matrix', () => {
  const units = allUnits()

  it('có ít nhất một unit được đăng ký', () => {
    expect(units.length).toBeGreaterThan(0)
  })

  for (const unit of units) {
    describe(unit.id, () => {
      it('có ít nhất một probe fixture', () => {
        expect(
          unit.fixtures.some(f => f.probe),
          `unit "${unit.id}" phải có ≥1 fixture probe:true`
        ).toBe(true)
      })

      for (const fixture of unit.fixtures) {
        const key = `${unit.id}::${fixture.id}`
        const expected = EXPECTED_FAIL.has(key) ? 'FAIL' : 'PASS'

        it(`${fixture.id} → ${expected}${fixture.probe ? ' (probe)' : ''}`, async () => {
          const result = await runFixture(unit, fixture)
          const detail = [
            result.blockedReason && `blocked: ${result.blockedReason}`,
            ...result.checks
              .filter(c => c.status === 'fail')
              .map(c => `✗ [${c.verifier}] ${c.label}${c.detail ? ` — ${c.detail}` : ''}`),
          ]
            .filter(Boolean)
            .join('\n')
          expect(result.verdict, detail).toBe(expected)
        })
      }
    })
  }
})
