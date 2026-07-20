import { registerVerifier } from '@/verify/core/registry'
import type { Check } from '@/verify/core/types'

export const schemaVerifier = registerVerifier({
  id: 'schema',
  description: '検証ケース。',
  run({ unit, fixture }): Check[] {
    if (!unit.propsSchema) {
      return [{
        verifier: 'schema',
        status: 'warn',
        label: 'unit が propsSchema を宣言していません',
      }]
    }
    const result = unit.propsSchema.safeParse(fixture.props)
    if (result.success) {
      return [{ verifier: 'schema', status: 'ok', label: 'Props 一致 schema' }]
    }
    // 検証用コメント。
    return result.error.issues.map(issue => ({
      verifier: 'schema',
      status: 'fail' as const,
      label: `props schema が "${issue.path.join('.') || '(root)'}" で不一致です`,
      detail: issue.message,
    }))
  },
})
