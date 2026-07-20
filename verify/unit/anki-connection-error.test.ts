import { describe, expect, it } from 'vitest'
import {
  ankiConnectionErrorMessage,
  isLocalNetworkBlockedContext,
} from '@/lib/flashcard-service/client'

const LOOPBACK = 'http://localhost:8765'

describe('isLocalNetworkBlockedContext', () => {
  it('loopback origin → 制限なし (loopback → loopback は同一 address space)', () => {
    expect(isLocalNetworkBlockedContext(LOOPBACK, 'localhost')).toBe(false)
    expect(isLocalNetworkBlockedContext(LOOPBACK, '127.0.0.1')).toBe(false)
  })

  it('デプロイ origin から loopback の AnkiConnect → ブロック対象', () => {
    expect(isLocalNetworkBlockedContext(LOOPBACK, 'ankiflow-three.vercel.app')).toBe(true)
    expect(isLocalNetworkBlockedContext('http://127.0.0.1:8765', 'app.example.com')).toBe(true)
  })

  it('AnkiConnect 自体が loopback 以外 (tunnel 等) なら LNA 対象外', () => {
    expect(isLocalNetworkBlockedContext('https://anki.example.com', 'app.example.com')).toBe(false)
  })

  it('page hostname 不明 (SSR) → false でフォールバック', () => {
    expect(isLocalNetworkBlockedContext(LOOPBACK, undefined)).toBe(false)
  })
})

describe('ankiConnectionErrorMessage', () => {
  it('loopback コンテキストでは従来どおり「Anki を起動」案内', () => {
    const message = ankiConnectionErrorMessage(LOOPBACK, 'localhost')
    expect(message).toContain('Make sure Anki Desktop is open')
    expect(message).not.toContain('Local Network Access')
  })

  it('デプロイ origin では browser ブロックを正しく案内する', () => {
    const message = ankiConnectionErrorMessage(LOOPBACK, 'ankiflow-three.vercel.app')
    expect(message).toContain('Local Network Access')
    expect(message).toContain('localhost:3000')
  })
})
