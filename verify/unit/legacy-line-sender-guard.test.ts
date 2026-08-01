import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

const REPO_ROOT = process.cwd()

const RETIRED_PATHS = [
  '.github/workflows/notify.yml',
  'scripts/send-notifications.ts',
  'scripts/capture-line-userid.ts',
] as const

const RETIRED_ENV_TOKENS = [
  ['LINE', 'USER', 'ID'].join('_'),
  ['FIREBASE', 'SERVICE', 'ACCOUNT', 'JSON'].join('_'),
] as const

const RETIRED_SCRIPT_BASENAMES = [
  'send-notifications',
  'capture-line-userid',
] as const

const SCANNED_DIRECTORIES = [
  'app',
  'components',
  'hooks',
  'lib',
  'scripts',
  'types',
  'verify',
  'e2e',
  '.github',
] as const

const SCANNED_ROOT_FILES = [
  'middleware.ts',
  'next.config.ts',
  'playwright.config.ts',
  'eslint.config.mjs',
  'postcss.config.mjs',
  'package.json',
  'firebase.json',
  'firestore.rules',
  'firestore.indexes.json',
  '.env.example',
] as const

interface SourceHit {
  file: string
  line: number
  token: string
}

const RETIRED_ENV_ALLOWLIST: readonly SourceHit[] = []

function allFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return allFiles(path)
    return entry.isFile() ? [path] : []
  })
}

function repoPath(path: string): string {
  return relative(REPO_ROOT, path).split(sep).join('/')
}

function scannedLiveFiles(): string[] {
  const directoryFiles = SCANNED_DIRECTORIES.flatMap((directory) =>
    allFiles(join(REPO_ROOT, directory)),
  )
  const rootFiles = SCANNED_ROOT_FILES.map((file) => join(REPO_ROOT, file))

  for (const file of rootFiles) expect(existsSync(file), repoPath(file)).toBe(true)
  return [...directoryFiles, ...rootFiles].sort()
}

function retiredEnvHits(): SourceHit[] {
  return scannedLiveFiles().flatMap((file) => {
    const lines = readFileSync(file, 'utf8').split('\n')
    return lines.flatMap((line, index) =>
      RETIRED_ENV_TOKENS.flatMap((token) => {
        const exactToken = new RegExp(`\\b${token}\\b`)
        return exactToken.test(line)
          ? [{ file: repoPath(file), line: index + 1, token }]
          : []
      }),
    )
  })
}

function retiredWorkflowInvocations(): SourceHit[] {
  const workflowRoot = join(REPO_ROOT, '.github/workflows')
  return allFiles(workflowRoot)
    .filter((file) => /\.ya?ml$/.test(file))
    .flatMap((file) => {
      const lines = readFileSync(file, 'utf8').split('\n')
      return lines.flatMap((line, index) =>
        RETIRED_SCRIPT_BASENAMES.flatMap((basename) =>
          line.includes(basename)
            ? [{ file: repoPath(file), line: index + 1, token: basename }]
            : [],
        ),
      )
    })
}

function retiredNpmInvocations(): SourceHit[] {
  const packagePath = join(REPO_ROOT, 'package.json')
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8')) as {
    scripts?: Record<string, unknown>
  }

  return Object.entries(packageJson.scripts ?? {}).flatMap(([name, command]) => {
    if (typeof command !== 'string') return []
    return RETIRED_SCRIPT_BASENAMES.flatMap((basename) =>
      command.includes(basename)
        ? [{ file: `package.json#scripts.${name}`, line: 1, token: basename }]
        : [],
    )
  })
}

describe('Legacy LINE sender regression guards', () => {
  it('Guard 1: retired executable paths cannot return', () => {
    for (const path of RETIRED_PATHS) {
      expect(existsSync(join(REPO_ROOT, path)), path).toBe(false)
    }
  })

  it('Guard 2: retired raw env tokens have no live code or config consumer', () => {
    expect(RETIRED_ENV_ALLOWLIST).toEqual([])
    expect(retiredEnvHits()).toEqual(RETIRED_ENV_ALLOWLIST)
  })

  it('Guard 3: workflows and npm scripts cannot invoke retired senders', () => {
    expect([...retiredWorkflowInvocations(), ...retiredNpmInvocations()]).toEqual([])
  })
})
