interface LocalHour {
  hour: number
  key: string
  tz: string
}

function createFormatter(timeZone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  })
}

/**
 * user の timezone における現在時刻と、重複送信防止用のキーを返す。
 * 不正または未設定の timezone は UTC にフォールバックする。
 */
const ONE_HOUR_MS = 60 * 60 * 1000

/**
 * この実行で push すべき idempotency key を返す (push 不要なら null)。
 *
 * GitHub Actions の cron は遅延・欠落があるため、現在時刻の完全一致だけでは
 * 配信時刻の run が丸ごと落ちた場合に通知が失われる。そこで:
 * 1. 現在の時が配信時刻 → 現在時の key で push
 * 2. 現在の時が対象外でも、直前の時が配信時刻で未 push → 直前時の key で catch-up
 *
 * lastPushKey が現在時の key と一致する場合は catch-up も行わない
 * (同一 clock hour 内の重複配信を防ぐ)。
 */
export function resolvePushKey(
  now: Date,
  timeZone: string | undefined,
  scheduledHours: number[],
  lastPushKey: string | undefined,
): string | null {
  const current = currentHourInTimeZone(now, timeZone)
  if (lastPushKey === current.key) return null

  if (scheduledHours.includes(current.hour)) return current.key

  const previous = currentHourInTimeZone(new Date(now.getTime() - ONE_HOUR_MS), timeZone)
  if (scheduledHours.includes(previous.hour) && lastPushKey !== previous.key) {
    return previous.key
  }

  return null
}

export function currentHourInTimeZone(now: Date, timeZone: string | undefined): LocalHour {
  let tz = timeZone?.trim() || 'UTC'
  let formatter: Intl.DateTimeFormat

  try {
    formatter = createFormatter(tz)
    formatter.format(now)
  } catch {
    tz = 'UTC'
    formatter = createFormatter(tz)
  }

  const parts = new Map(
    formatter
      .formatToParts(now)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  )
  const year = parts.get('year') ?? '0000'
  const month = parts.get('month') ?? '00'
  const day = parts.get('day') ?? '00'
  const hourText = parts.get('hour') ?? '00'

  return {
    hour: Number.parseInt(hourText, 10),
    key: `${year}-${month}-${day}T${hourText}@${tz}`,
    tz,
  }
}
