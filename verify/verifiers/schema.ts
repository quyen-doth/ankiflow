import { registerVerifier } from '@/verify/core/registry'
import type { Check } from '@/verify/core/types'

export const schemaVerifier = registerVerifier({
  id: 'schema',
  description: 'Validate props của fixture theo propsSchema (zod) của unit.',
  run({ unit, fixture }): Check[] {
    if (!unit.propsSchema) {
      return [{
        verifier: 'schema',
        status: 'warn',
        label: 'Unit không khai báo propsSchema',
      }]
    }
    const result = unit.propsSchema.safeParse(fixture.props)
    if (result.success) {
      return [{ verifier: 'schema', status: 'ok', label: 'Props khớp schema' }]
    }
    // zod 4: đọc lỗi qua error.issues
    return result.error.issues.map(issue => ({
      verifier: 'schema',
      status: 'fail' as const,
      label: `Props sai schema tại "${issue.path.join('.') || '(root)'}"`,
      detail: issue.message,
    }))
  },
})
