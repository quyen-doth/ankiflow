import { describe, expect, it } from 'vitest'
import { isPublicSignupEnabled } from '@/lib/signup-policy'

describe('isPublicSignupEnabled', () => {
  it.each([undefined, '', 'false', '1', 'yes', 'invalid'])(
    '%s → public signup を無効化',
    (value) => {
      expect(isPublicSignupEnabled(value)).toBe(false)
    },
  )

  it.each(['true', 'TRUE', '  true  '])('%s → public signup を有効化', (value) => {
    expect(isPublicSignupEnabled(value)).toBe(true)
  })
})
