import { registerVerifier } from '@/verify/core/registry'
import type { Check } from '@/verify/core/types'

export const domContractVerifier = registerVerifier({
  id: 'dom-contract',
  description: '検証ケース。',
  run({ unit, root, contract }): Check[] {
    if (Object.keys(contract).length === 0) {
      // 検証用コメント。
      // 検証用コメント。
      // 検証用コメント。
      if (unit.allowsEmptyRender && root.children.length === 0) {
        return [{
          verifier: 'dom-contract',
          status: 'ok',
          label: '空 DOM は有効 — unit が allowsEmptyRender を宣言しています',
        }]
      }
      return [{
        verifier: 'dom-contract',
        status: 'fail',
        label: 'contract data-verify-* が見つかりません',
      }]
    }

    const checks: Check[] = []
    if (contract.unit === unit.id) {
      checks.push({
        verifier: 'dom-contract',
        status: 'ok',
        label: `contract は自身を "${contract.unit}" と識別しています`,
      })
    } else if (contract.unit) {
      checks.push({
        verifier: 'dom-contract',
        status: 'warn',
        label: `contract id "${contract.unit}" が unit id "${unit.id}" と異なります`,
      })
    } else {
      checks.push({
        verifier: 'dom-contract',
        status: 'warn',
        label: '不足しています',
      })
    }
    return checks
  },
})
