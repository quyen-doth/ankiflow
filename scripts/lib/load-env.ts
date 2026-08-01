import * as dotenv from 'dotenv'

/** Firebase Admin configuration required by every project-config CLI. */
export const FIREBASE_ADMIN_ENV_NAMES = [
  'FIREBASE_ADMIN_PROJECT_ID',
  'FIREBASE_ADMIN_CLIENT_EMAIL',
  'FIREBASE_ADMIN_PRIVATE_KEY',
] as const

export interface LoadEnvOptions {
  /** Environment variable names that must be non-empty after loading. */
  required?: readonly string[]
}

/**
 * Loads local CLI configuration with the same precedence used by the app:
 * shell-provided values win, then `.env.local`, then `.env`.
 *
 * When `required` is provided, all missing or blank names are reported in one
 * deterministic error after both files have been loaded.
 */
export function loadEnv(options: LoadEnvOptions = {}): void {
  dotenv.config({ path: '.env.local', quiet: true })
  dotenv.config({ path: '.env', quiet: true })

  const missingNames = [...new Set(options.required ?? [])].filter(
    (name) => !process.env[name]?.trim(),
  )
  if (missingNames.length > 0) {
    throw new Error(`Missing required environment variables: ${missingNames.join(', ')}`)
  }
}
