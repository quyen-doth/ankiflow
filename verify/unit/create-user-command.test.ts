import { describe, expect, it } from 'vitest'
import { parseCreateUserEmail } from '@/scripts/create-user'

describe('create-user command arguments', () => {
  it('有効な単一 email を正規化する', () => {
    expect(parseCreateUserEmail(['  user@example.com  '])).toBe('user@example.com')
  })

  it.each([
    { args: [] },
    { args: ['invalid'] },
    { args: ['a@example.com', 'b@example.com'] },
    { args: ['--help'] },
  ])(
    '不正な引数 $args を拒否する',
    ({ args }) => {
      expect(parseCreateUserEmail(args)).toBeNull()
    },
  )
})
