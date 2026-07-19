import { describe, expect, it } from 'vitest'
import { currentHourInTimeZone, resolvePushKey } from '@/lib/notifications/schedule'

describe('currentHourInTimeZone', () => {
  const now = new Date('2026-07-16T03:15:00.000Z')

  it('Asia/Tokyo の現地時刻と idempotency key を返す', () => {
    expect(currentHourInTimeZone(now, 'Asia/Tokyo')).toEqual({
      hour: 12,
      key: '2026-07-16T12@Asia/Tokyo',
      tz: 'Asia/Tokyo',
    })
  })

  it('America/New_York の日付をまたぐ現地時刻を返す', () => {
    expect(currentHourInTimeZone(now, 'America/New_York')).toEqual({
      hour: 23,
      key: '2026-07-15T23@America/New_York',
      tz: 'America/New_York',
    })
  })

  it.each([undefined, 'Not/A_Timezone'])('timezone %s は UTC にフォールバックする', (timeZone) => {
    expect(currentHourInTimeZone(now, timeZone)).toEqual({
      hour: 3,
      key: '2026-07-16T03@UTC',
      tz: 'UTC',
    })
  })
})

describe('resolvePushKey', () => {
  const tz = 'Asia/Tokyo'
  // 2026-07-16T03:15Z = Asia/Tokyo 12:15 (現在の時 = 12、直前の時 = 11)
  const now = new Date('2026-07-16T03:15:00.000Z')

  it('現在の時が配信時刻 → 現在時の key を返す', () => {
    expect(resolvePushKey(now, tz, [12], undefined)).toBe('2026-07-16T12@Asia/Tokyo')
  })

  it('現在時の key で push 済みなら null (重複防止)', () => {
    expect(resolvePushKey(now, tz, [12], '2026-07-16T12@Asia/Tokyo')).toBeNull()
  })

  it('現在の時は対象外だが直前の時が配信時刻で未 push → 直前時の key で catch-up', () => {
    expect(resolvePushKey(now, tz, [11], undefined)).toBe('2026-07-16T11@Asia/Tokyo')
  })

  it('直前時の key で push 済みなら catch-up しない', () => {
    expect(resolvePushKey(now, tz, [11], '2026-07-16T11@Asia/Tokyo')).toBeNull()
  })

  it('現在時に push 済みの場合、直前の時が配信時刻でも catch-up しない (同一 clock hour 内 1 通)', () => {
    expect(resolvePushKey(now, tz, [11, 12], '2026-07-16T12@Asia/Tokyo')).toBeNull()
  })

  it('現在・直前どちらも配信時刻でなければ null', () => {
    expect(resolvePushKey(now, tz, [22], undefined)).toBeNull()
  })

  it('日付境界をまたぐ catch-up: 現地 0 時台の run が前日 23 時を補完する', () => {
    // 2026-07-15T15:20Z = Asia/Tokyo 2026-07-16 00:20 → 直前の時 = 前日 23 時
    const midnight = new Date('2026-07-15T15:20:00.000Z')
    expect(resolvePushKey(midnight, tz, [23], undefined)).toBe('2026-07-15T23@Asia/Tokyo')
  })
})
