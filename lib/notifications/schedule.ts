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
