import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { lookupMock, dbSentinel } = vi.hoisted(() => ({
  lookupMock: vi.fn(),
  dbSentinel: { kind: 'db' },
}))

vi.mock('@/lib/auth-guard', () => ({
  withAuth: (
    handler: (request: Request, context: unknown, uid: string) => Promise<Response>,
  ) => (request: Request, context: unknown) => handler(request, context, 'uid-1'),
}))

vi.mock('@/lib/firebase-admin', () => ({
  getAdminDb: () => dbSentinel,
}))

vi.mock('@/lib/entries/duplicateLookup', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/entries/duplicateLookup')>()
  return {
    ...actual,
    lookupEntryDuplicates: lookupMock,
  }
})

import { POST } from '@/app/api/entries/check-duplicate/route'

function request(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/entries/check-duplicate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const routeContext = { params: Promise.resolve({}) }

beforeEach(() => {
  lookupMock.mockReset()
})

describe('POST /api/entries/check-duplicate', () => {
  it('single contract を保ち、trim 済み target を shared service に渡す', async () => {
    lookupMock.mockResolvedValue([{
      word: 'Docker',
      duplicates: [{
        id: 'entry-1',
        word: 'Docker',
        anki_deck: 'Default',
        status: 'reviewed',
        created_at: null,
      }],
    }])

    const response = await POST(request({ word: '  Docker  ' }), routeContext)

    expect(lookupMock).toHaveBeenCalledWith(dbSentinel, 'uid-1', ['Docker'])
    expect(await response.json()).toEqual({
      isDuplicate: true,
      duplicates: [expect.objectContaining({ id: 'entry-1' })],
    })
  })

  it('batch contract と入力順を保つ', async () => {
    lookupMock.mockResolvedValue([
      { word: 'Docker', duplicates: [] },
      { word: 'docker', duplicates: [] },
    ])

    const response = await POST(request({ words: [' Docker ', 'docker'] }), routeContext)

    expect(response.status).toBe(200)
    expect(lookupMock).toHaveBeenCalledWith(
      dbSentinel,
      'uid-1',
      ['Docker', 'docker'],
    )
    expect(await response.json()).toEqual({
      results: [
        { word: 'Docker', duplicates: [] },
        { word: 'docker', duplicates: [] },
      ],
    })
  })

  it('missing/invalid/oversized body を Firestore 前に 400 で拒否する', async () => {
    const missing = await POST(request({}), routeContext)
    const invalid = await POST(request({ words: ['valid', ' '] }), routeContext)
    const oversized = await POST(request({
      words: Array.from({ length: 101 }, (_, index) => `word-${index}`),
    }), routeContext)

    expect(missing.status).toBe(400)
    expect(await missing.json()).toEqual({ error: 'Missing word' })
    expect(invalid.status).toBe(400)
    expect(oversized.status).toBe(400)
    expect(lookupMock).not.toHaveBeenCalled()
  })
})
