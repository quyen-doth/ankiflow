import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

const REPO_ROOT = process.cwd()
const SCRIPTS_ROOT = join(REPO_ROOT, 'scripts')
const LOADER_PATH = 'scripts/lib/load-env.ts'

const PROJECT_CONFIG_CLI_PATHS = [
  'scripts/add-han-viet-field.ts',
  'scripts/backfill-entry-query-fields.ts',
  'scripts/backfill-output-language-controls.ts',
  'scripts/create-user.ts',
  'scripts/fix-card-types.ts',
  'scripts/migrate-ai-output-profiles.ts',
  'scripts/migrate-content-type-english.ts',
  'scripts/migrate-form-type.ts',
  'scripts/migrate-user-content-types.ts',
  'scripts/migrate-user-data.ts',
  'scripts/seed-firestore.ts',
  'scripts/set-admin-claim.ts',
  'scripts/sync-admin-defaults.ts',
] as const

const INJECTED_ONLY_CLI_REASONS = {
  'scripts/prepare-release.mjs': 'GitHub Actions injects GITHUB_OUTPUT for release preparation.',
  'scripts/release-tag-state.mjs': 'GitHub Actions injects release-state inputs and output paths.',
} as const satisfies Record<string, string>

const RAW_ENV_ACCESS_PATTERN = /\bprocess\.env\b/
const DOTENV_IMPORT_PATTERN =
  /(?:\bfrom\s*|\bimport\s*(?:\(\s*)?|\brequire\s*\(\s*)['"]dotenv(?:\/config)?['"]/
const DIRECT_DOTENV_CONFIG_PATTERN = /\bdotenv\.config\s*\(/
const LOAD_ENV_IMPORT_PATTERN =
  /import\s*\{([^}]*)\}\s*from\s*['"]\.\/lib\/load-env['"]/
const LOAD_ENV_CALL_PATTERN =
  /\bloadEnv\s*\(\s*\{\s*required\s*:\s*FIREBASE_ADMIN_ENV_NAMES\s*,?\s*\}\s*\)/

function repoPath(path: string): string {
  return relative(REPO_ROOT, path).split(sep).join('/')
}

function scriptSourcePaths(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return scriptSourcePaths(path)
    return entry.isFile() && /\.(?:ts|mjs|js)$/.test(entry.name) ? [path] : []
  })
}

function readScriptSources(): Map<string, string> {
  return new Map(
    scriptSourcePaths(SCRIPTS_ROOT)
      .map((path) => [repoPath(path), readFileSync(path, 'utf8')] as const)
      .sort(([left], [right]) => left.localeCompare(right)),
  )
}

function importedLoaderNames(source: string): Set<string> {
  const match = LOAD_ENV_IMPORT_PATTERN.exec(source)
  if (!match) return new Set()
  return new Set(
    match[1]
      .split(',')
      .map((name) => name.trim().split(/\s+as\s+/)[0])
      .filter(Boolean),
  )
}

function validateScriptEnvLoading(sources: ReadonlyMap<string, string>): string[] {
  const violations: string[] = []
  const projectCliSet = new Set<string>(PROJECT_CONFIG_CLI_PATHS)
  const injectedOnlySet = new Set<string>(Object.keys(INJECTED_ONLY_CLI_REASONS))
  const classifiedPaths = new Set([LOADER_PATH, ...projectCliSet, ...injectedOnlySet])
  const roleCounts = new Map<string, number>()

  for (const path of [LOADER_PATH, ...PROJECT_CONFIG_CLI_PATHS, ...injectedOnlySet]) {
    roleCounts.set(path, (roleCounts.get(path) ?? 0) + 1)
  }
  for (const [path, count] of roleCounts) {
    if (count !== 1) violations.push(`${path}: path must belong to exactly one role`)
  }

  for (const path of classifiedPaths) {
    if (!sources.has(path)) violations.push(`${path}: classified path does not exist`)
  }
  for (const [path, reason] of Object.entries(INJECTED_ONLY_CLI_REASONS)) {
    if (!reason.trim()) violations.push(`${path}: injected-only reason must not be empty`)
  }

  for (const [path, source] of sources) {
    const accessesRawEnv = RAW_ENV_ACCESS_PATTERN.test(source)
    const importsDotenv = DOTENV_IMPORT_PATTERN.test(source)
    const callsDotenvDirectly = DIRECT_DOTENV_CONFIG_PATTERN.test(source)
    const loaderImportNames = importedLoaderNames(source)
    const importsLoader = loaderImportNames.size > 0
    const callsLoader = LOAD_ENV_CALL_PATTERN.test(source)

    if (accessesRawEnv && !classifiedPaths.has(path)) {
      violations.push(`${path}: raw environment accessor is not classified`)
    }

    if (path === LOADER_PATH) {
      if (!importsDotenv) violations.push(`${path}: loader must import dotenv`)
      if (!accessesRawEnv) violations.push(`${path}: loader must validate required environment names`)
      continue
    }

    if (importsDotenv || callsDotenvDirectly) {
      violations.push(`${path}: dotenv may only be used by ${LOADER_PATH}`)
    }

    if (projectCliSet.has(path)) {
      if (!loaderImportNames.has('FIREBASE_ADMIN_ENV_NAMES') || !loaderImportNames.has('loadEnv')) {
        violations.push(`${path}: project CLI must import FIREBASE_ADMIN_ENV_NAMES and loadEnv`)
      }
      if (!callsLoader) {
        violations.push(`${path}: project CLI must call loadEnv with Firebase Admin requirements`)
      }
      continue
    }

    if (injectedOnlySet.has(path)) {
      if (!accessesRawEnv) {
        violations.push(`${path}: injected-only CLI must consume injected environment values`)
      }
      if (importsLoader || callsLoader) {
        violations.push(`${path}: injected-only CLI must not load developer dotenv files`)
      }
      continue
    }

    if (importsLoader || callsLoader) {
      violations.push(`${path}: loadEnv consumer is not classified as a project CLI`)
    }
  }

  return violations.sort()
}

describe('Script environment loading regression guard', () => {
  const actualSources = readScriptSources()

  it('partitions every environment accessor and dotenv import into exactly one role', () => {
    expect(validateScriptEnvLoading(actualSources)).toEqual([])
  })

  it('rejects a synthetic direct dotenv call outside the loader', () => {
    const sources = new Map(actualSources)
    const path = 'scripts/seed-firestore.ts'
    sources.set(path, `${sources.get(path)}\nimport * as dotenv from 'dotenv'\ndotenv.config()\n`)

    expect(validateScriptEnvLoading(sources)).toContain(
      `${path}: dotenv may only be used by ${LOADER_PATH}`,
    )
  })

  it('rejects a synthetic unclassified mjs environment accessor', () => {
    const sources = new Map(actualSources)
    const path = 'scripts/new-env-reader.mjs'
    sources.set(path, 'console.log(process.env.NEW_ENV_VALUE)\n')

    expect(validateScriptEnvLoading(sources)).toContain(
      `${path}: raw environment accessor is not classified`,
    )
  })

  it('rejects a project CLI that stops calling the shared loader', () => {
    const sources = new Map(actualSources)
    const path = 'scripts/seed-firestore.ts'
    const source = sources.get(path)
    expect(source).toBeDefined()
    sources.set(path, source!.replace(LOAD_ENV_CALL_PATTERN, '// shared loader call removed'))

    expect(validateScriptEnvLoading(sources)).toContain(
      `${path}: project CLI must call loadEnv with Firebase Admin requirements`,
    )
  })
})
