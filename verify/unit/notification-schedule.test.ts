import { describe, expect, it } from 'vitest'
import { currentHourInTimeZone } from '@/lib/notifications/schedule'

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
