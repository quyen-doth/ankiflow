import { registerVerifier } from '@/verify/core/registry'
import type { Check } from '@/verify/core/types'

export const domContractVerifier = registerVerifier({
  id: 'dom-contract',
  description: 'Kiểm tra unit phát contract data-verify-* và tự định danh đúng.',
  run({ unit, root, contract }): Check[] {
    if (Object.keys(contract).length === 0) {
      // Unit được phép render null (Modal đóng...) và DOM thực sự rỗng → SKIP
      if (unit.allowsEmptyRender && root.children.length === 0) {
        return [{
          verifier: 'dom-contract',
          status: 'skip',
          label: 'DOM rỗng — unit khai báo allowsEmptyRender',
        }]
      }
      return [{
        verifier: 'dom-contract',
        status: 'fail',
        label: 'Không phát contract data-verify-* nào',
      }]
    }

    const checks: Check[] = []
    if (contract.unit === unit.id) {
      checks.push({
        verifier: 'dom-contract',
        status: 'ok',
        label: `Contract tự định danh là "${contract.unit}"`,
      })
    } else if (contract.unit) {
      checks.push({
        verifier: 'dom-contract',
        status: 'warn',
        label: `Contract định danh "${contract.unit}" khác unit id "${unit.id}"`,
      })
    } else {
      checks.push({
        verifier: 'dom-contract',
        status: 'warn',
        label: 'Contract thiếu data-verify-unit',
      })
    }
    return checks
  },
})
