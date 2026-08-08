import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ENV_EXAMPLE_PATH = join(process.cwd(), '.env.example')

const EXPECTED_ENV_NAMES = [
  'ADMIN_EMAIL',
  'ANTHROPIC_API_KEY',
  'CRON_SECRET',
  'DEMO_EMAIL',
  'DEMO_PASSWORD',
  'FIREBASE_ADMIN_CLIENT_EMAIL',
  'FIREBASE_ADMIN_PRIVATE_KEY',
  'FIREBASE_ADMIN_PROJECT_ID',
  'GOOGLE_APPLICATION_CREDENTIALS',
  'GOOGLE_TTS_CREDENTIALS_JSON',
  'INTEGRATION_TARGET_UID',
  'INTEGRATION_TOKEN',
  'LINE_CHANNEL_ACCESS_TOKEN',
  'LINE_CHANNEL_SECRET',
  'NEXT_PUBLIC_ADMIN_EMAIL',
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_LINE_ADD_FRIEND_URL',
  'NEXT_PUBLIC_LINE_BOT_ID',
  'SIGNUP_ENABLED',
  'UNSPLASH_ACCESS_KEY',
] as const

const REQUIRED_ADDITIONS = [
  'ADMIN_EMAIL',
  'NEXT_PUBLIC_ADMIN_EMAIL',
  'INTEGRATION_TOKEN',
  'INTEGRATION_TARGET_UID',
] as const

const FORBIDDEN_ENV_NAMES = [
  ['ANKI', 'CONNECT', 'URL'].join('_'),
  ['API', 'SECRET'].join('_'),
  ['LINE', 'USER', 'ID'].join('_'),
  ['FIREBASE', 'SERVICE', 'ACCOUNT', 'JSON'].join('_'),
] as const

function parseEnvNames(source: string): string[] {
  return source.split(/\r?\n/).flatMap((line, index) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return []
    const match = /^([A-Z][A-Z0-9_]*)=/.exec(trimmed)
    if (!match) throw new Error(`Invalid .env.example entry at line ${index + 1}`)
    return [match[1]]
  })
}

function assertEnvExampleContract(source: string): void {
  const names = parseEnvNames(source)
  const nameSet = new Set(names)
  const missingNames = REQUIRED_ADDITIONS.filter((name) => !nameSet.has(name))
  const forbiddenNames = FORBIDDEN_ENV_NAMES.filter((name) => nameSet.has(name))

  if (missingNames.length > 0) {
    throw new Error(`Missing environment example names: ${missingNames.join(', ')}`)
  }
  if (forbiddenNames.length > 0) {
    throw new Error(`Forbidden environment example names: ${forbiddenNames.join(', ')}`)
  }
  expect([...names].sort()).toEqual([...EXPECTED_ENV_NAMES].sort())
}

describe('.env.example contract', () => {
  const source = readFileSync(ENV_EXAMPLE_PATH, 'utf8')

  it('contains the exact supported key set', () => {
    expect(() => assertEnvExampleContract(source)).not.toThrow()
  })

  it('rejects a synthetic sample that drops a required addition', () => {
    const withoutAdminEmail = source.replace(/^ADMIN_EMAIL=.*\n/m, '')

    expect(() => assertEnvExampleContract(withoutAdminEmail)).toThrowError(
      'Missing environment example names: ADMIN_EMAIL',
    )
  })

  it('rejects a synthetic sample that restores a forbidden key', () => {
    const deadKey = ['API', 'SECRET'].join('_')

    expect(() => assertEnvExampleContract(`${source}\n${deadKey}=legacy\n`)).toThrowError(
      `Forbidden environment example names: ${deadKey}`,
    )
  })
})
