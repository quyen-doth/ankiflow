import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { createUserMock, setClaimsMock, seedDefaultsMock, dbStub } = vi.hoisted(() => ({
  createUserMock: vi.fn(),
  setClaimsMock: vi.fn(),
  seedDefaultsMock: vi.fn(),
  dbStub: { kind: 'firestore-stub' },
}))

vi.mock('@/lib/firebase-admin', () => ({
  getAdminAuthInstance: () => ({
    createUser: createUserMock,
    setCustomUserClaims: setClaimsMock,
  }),
  getAdminDb: () => dbStub,
}))

vi.mock('@/lib/seed-defaults', () => ({
  seedUserDefaults: seedDefaultsMock,
}))

import { provisionUserAccount } from '@/lib/account-provisioning'

beforeEach(() => {
  createUserMock.mockReset().mockResolvedValue({ uid: 'user-1' })
  setClaimsMock.mockReset().mockResolvedValue(undefined)
  seedDefaultsMock.mockReset().mockResolvedValue(undefined)
  vi.stubEnv('ADMIN_EMAIL', '')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('provisionUserAccount', () => {
  it('通常ユーザーを作成して defaults を seed する', async () => {
    const result = await provisionUserAccount({
      email: 'user@example.com',
      password: 'Password1',
    })

    expect(createUserMock).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'Password1',
    })
    expect(setClaimsMock).not.toHaveBeenCalled()
    expect(seedDefaultsMock).toHaveBeenCalledWith(dbStub, 'user-1')
    expect(result).toEqual({ uid: 'user-1', warnings: [] })
  })

  it('ADMIN_EMAIL と一致する場合は admin claim を設定する', async () => {
    vi.stubEnv('ADMIN_EMAIL', 'admin@example.com')

    await provisionUserAccount({ email: 'admin@example.com', password: 'Password1' })

    expect(setClaimsMock).toHaveBeenCalledWith('user-1', { admin: true })
  })

  it('claim と seed の失敗を warning として返し、作成済み uid を保持する', async () => {
    vi.stubEnv('ADMIN_EMAIL', 'admin@example.com')
    const claimError = new Error('claim failed')
    const seedError = new Error('seed failed')
    setClaimsMock.mockRejectedValueOnce(claimError)
    seedDefaultsMock.mockRejectedValueOnce(seedError)

    const result = await provisionUserAccount({
      email: 'admin@example.com',
      password: 'Password1',
    })

    expect(result).toEqual({
      uid: 'user-1',
      warnings: [
        { step: 'admin-claim', error: claimError },
        { step: 'seed-defaults', error: seedError },
      ],
    })
  })

  it('Auth user 作成が失敗した場合は seed しない', async () => {
    const error = Object.assign(new Error('already exists'), { code: 'auth/email-already-exists' })
    createUserMock.mockRejectedValueOnce(error)

    await expect(
      provisionUserAccount({ email: 'user@example.com', password: 'Password1' }),
    ).rejects.toBe(error)
    expect(seedDefaultsMock).not.toHaveBeenCalled()
  })
})
