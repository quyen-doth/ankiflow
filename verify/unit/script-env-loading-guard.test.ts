import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
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
  'scripts/seed-demo.ts',
  'scripts/seed-firestore.ts',
  'scripts/set-admin-claim.ts',
  'scripts/sync-admin-defaults.ts',
] as const

const INJECTED_ONLY_CLI_REASONS = {
  'scripts/prepare-release.mjs': 'GitHub Actions injects GITHUB_OUTPUT for release preparation.',
  'scripts/release-tag-state.mjs': 'GitHub Actions injects release-state inputs and output paths.',
} as const satisfies Record<string, string>

const ENV_INDEPENDENT_ENTRY_POINT_REASONS = {
  'scripts/agent-hooks/block-env.mjs': 'The hook validates tool input and does not use project env.',
  'scripts/agent-hooks/block-env.test.mjs': 'The hook test does not use project env.',
  'scripts/optimize-screenshots.ts': 'Image optimization only reads/writes files and uses no project env.',
  'scripts/setup-anki.js': 'The local AnkiConnect setup uses constants instead of project env.',
} as const satisfies Record<string, string>

const RAW_ENV_ACCESS_PATTERN = /\bprocess\.env\b/
const DOTENV_IMPORT_PATTERN =
  /(?:\bfrom\s*|\bimport\s*(?:\(\s*)?|\brequire\s*\(\s*)['"]dotenv(?:\/config)?['"]/
const DIRECT_DOTENV_CONFIG_PATTERN = /\bdotenv\.config\s*\(/
const MODULE_IMPORT_SPECIFIER_PATTERN =
  /(?:\bfrom\s*|\bimport\s*(?:\(\s*)?|\brequire\s*\(\s*)['"]([^'"]+)['"]/g
const NAMED_IMPORT_PATTERN = /\bimport\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g
const ANY_LOAD_ENV_CALL_PATTERN = /\bloadEnv\s*\(/
const REQUIRED_LOAD_ENV_CALL_PATTERN =
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

function resolvesToLoader(importerPath: string, specifier: string): boolean {
  if (!specifier.startsWith('.')) return false

  const resolvedPath = repoPath(resolve(REPO_ROOT, dirname(importerPath), specifier))
  const withoutModuleExtension = (path: string): string => path.replace(/\.(?:[cm]?[jt]s)$/, '')
  return withoutModuleExtension(resolvedPath) === withoutModuleExtension(LOADER_PATH)
}

function loaderImportNames(importerPath: string, source: string): Set<string> {
  const importedNames = new Set<string>()

  for (const match of source.matchAll(NAMED_IMPORT_PATTERN)) {
    if (!resolvesToLoader(importerPath, match[2])) continue

    for (const importedName of match[1].split(',')) {
      const name = importedName.trim().split(/\s+as\s+/)[0]
      if (name) importedNames.add(name)
    }
  }

  return importedNames
}

function importsLoaderModule(importerPath: string, source: string): boolean {
  return [...source.matchAll(MODULE_IMPORT_SPECIFIER_PATTERN)].some((match) =>
    resolvesToLoader(importerPath, match[1]),
  )
}

function validateScriptEnvLoading(sources: ReadonlyMap<string, string>): string[] {
  const violations: string[] = []
  const projectCliSet = new Set<string>(PROJECT_CONFIG_CLI_PATHS)
  const injectedOnlySet = new Set<string>(Object.keys(INJECTED_ONLY_CLI_REASONS))
  const envIndependentSet = new Set<string>(Object.keys(ENV_INDEPENDENT_ENTRY_POINT_REASONS))
  const classifiedEntryPointPaths = [
    ...PROJECT_CONFIG_CLI_PATHS,
    ...injectedOnlySet,
    ...envIndependentSet,
  ]
  const roleCounts = new Map<string, number>()

  for (const path of classifiedEntryPointPaths) {
    roleCounts.set(path, (roleCounts.get(path) ?? 0) + 1)
  }
  for (const [path, count] of roleCounts) {
    if (count !== 1) violations.push(`${path}: path must belong to exactly one role`)
  }

  if (!sources.has(LOADER_PATH)) violations.push(`${LOADER_PATH}: loader path does not exist`)
  for (const path of roleCounts.keys()) {
    if (!sources.has(path)) violations.push(`${path}: classified path does not exist`)
  }
  for (const [path, reason] of Object.entries(INJECTED_ONLY_CLI_REASONS)) {
    if (!reason.trim()) violations.push(`${path}: injected-only reason must not be empty`)
  }
  for (const [path, reason] of Object.entries(ENV_INDEPENDENT_ENTRY_POINT_REASONS)) {
    if (!reason.trim()) violations.push(`${path}: environment-independent reason must not be empty`)
  }

  for (const [path, source] of sources) {
    const isInfrastructure = path.startsWith('scripts/lib/')
    const accessesRawEnv = RAW_ENV_ACCESS_PATTERN.test(source)
    const importsDotenv = DOTENV_IMPORT_PATTERN.test(source)
    const callsDotenvDirectly = DIRECT_DOTENV_CONFIG_PATTERN.test(source)
    const importedLoaderNames = loaderImportNames(path, source)
    const importsLoader = importsLoaderModule(path, source)
    const callsLoader = ANY_LOAD_ENV_CALL_PATTERN.test(source)
    const callsLoaderWithRequirements = REQUIRED_LOAD_ENV_CALL_PATTERN.test(source)

    if (!isInfrastructure && (roleCounts.get(path) ?? 0) !== 1) {
      violations.push(`${path}: entry point must belong to exactly one role`)
    }

    if (path === LOADER_PATH) {
      if (!importsDotenv) violations.push(`${path}: loader must import dotenv`)
      if (!accessesRawEnv) violations.push(`${path}: loader must validate required environment names`)
      continue
    }

    if (importsDotenv || callsDotenvDirectly) {
      violations.push(`${path}: dotenv may only be used by ${LOADER_PATH}`)
    }

    if (isInfrastructure) {
      if (accessesRawEnv) {
        violations.push(`${path}: raw environment access is only allowed in ${LOADER_PATH}`)
      }
      if (importsLoader || callsLoader) {
        violations.push(`${path}: loader infrastructure must not consume loadEnv`)
      }
      continue
    }

    if (projectCliSet.has(path)) {
      if (
        !importedLoaderNames.has('FIREBASE_ADMIN_ENV_NAMES') ||
        !importedLoaderNames.has('loadEnv')
      ) {
        violations.push(`${path}: project CLI must import FIREBASE_ADMIN_ENV_NAMES and loadEnv`)
      }
      if (!callsLoader) {
        violations.push(`${path}: project CLI must call loadEnv`)
      } else if (!callsLoaderWithRequirements) {
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

    if (envIndependentSet.has(path)) {
      if (accessesRawEnv) {
        violations.push(`${path}: environment-independent entry point must not access process.env`)
      }
      if (importsLoader || callsLoader) {
        violations.push(`${path}: environment-independent entry point must not consume loadEnv`)
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

  it('partitions every script entry point into exactly one environment-loading role', () => {
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
      `${path}: entry point must belong to exactly one role`,
    )
  })

  it('rejects a synthetic nested CLI even when it only consumes the shared loader', () => {
    const sources = new Map(actualSources)
    const path = 'scripts/tools/new-cli.ts'
    sources.set(path, "import { loadEnv } from '../lib/load-env'\nloadEnv()\n")

    const violations = validateScriptEnvLoading(sources)
    expect(violations).toContain(`${path}: entry point must belong to exactly one role`)
    expect(violations).toContain(`${path}: loadEnv consumer is not classified as a project CLI`)
  })

  it('rejects a project CLI that stops calling the shared loader', () => {
    const sources = new Map(actualSources)
    const path = 'scripts/seed-firestore.ts'
    const source = sources.get(path)
    expect(source).toBeDefined()
    sources.set(path, source!.replace(REQUIRED_LOAD_ENV_CALL_PATTERN, '// shared loader call removed'))

    expect(validateScriptEnvLoading(sources)).toContain(`${path}: project CLI must call loadEnv`)
  })

  it('rejects a project CLI that calls the loader without Firebase Admin requirements', () => {
    const sources = new Map(actualSources)
    const path = 'scripts/seed-firestore.ts'
    const source = sources.get(path)
    expect(source).toBeDefined()
    sources.set(path, source!.replace(REQUIRED_LOAD_ENV_CALL_PATTERN, 'loadEnv()'))

    expect(validateScriptEnvLoading(sources)).toContain(
      `${path}: project CLI must call loadEnv with Firebase Admin requirements`,
    )
  })
})
