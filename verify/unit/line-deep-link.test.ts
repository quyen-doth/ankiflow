import { describe, expect, it } from 'vitest'
import { buildLineAddFriendUrl, buildLineSendCodeUrl } from '@/lib/line/deep-link'

describe('buildLineAddFriendUrl', () => {
  it('設定済み add-friend URL を優先して空白を除去する', () => {
    expect(buildLineAddFriendUrl('  https://lin.ee/example  ', '@fallback')).toBe(
      'https://lin.ee/example',
    )
  })

  it('URL 未設定時は bot ID から公式プロフィール URL を生成する', () => {
    expect(buildLineAddFriendUrl(undefined, '@abc1234')).toBe(
      'https://line.me/R/ti/p/%40abc1234',
    )
  })

  it('bot ID の @ が省略されても正規化する', () => {
    expect(buildLineAddFriendUrl('', 'abc1234')).toBe(
      'https://line.me/R/ti/p/%40abc1234',
    )
  })

  it('add-friend URL と bot ID が両方なければ null', () => {
    expect(buildLineAddFriendUrl('  ', '  ')).toBeNull()
  })
})

describe('buildLineSendCodeUrl', () => {
  it('bot ID と code を UTF-8 percent encode して chat URL を生成する', () => {
    expect(buildLineSendCodeUrl('@abc1234', 'ANKI-ABC 123')).toBe(
      'https://line.me/R/oaMessage/%40abc1234/?ANKI-ABC%20123',
    )
  })

  it('bot ID の @ が省略されても正規化する', () => {
    expect(buildLineSendCodeUrl('abc1234', 'ANKI-ABCDEF')).toBe(
      'https://line.me/R/oaMessage/%40abc1234/?ANKI-ABCDEF',
    )
  })

  it('bot ID または code が空なら null', () => {
    expect(buildLineSendCodeUrl(undefined, 'ANKI-ABCDEF')).toBeNull()
    expect(buildLineSendCodeUrl('  ', 'ANKI-ABCDEF')).toBeNull()
    expect(buildLineSendCodeUrl('@abc1234', '  ')).toBeNull()
  })
})
