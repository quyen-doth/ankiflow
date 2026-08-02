import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const SCRIPT_PATH = resolve('scripts/prepare-release.mjs')
const TEMP_REPOS: string[] = []

function git(repo: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim()
}

function runPrepare(repo: string, baseSha: string): Record<string, string> {
  const outputPath = join(repo, 'github-output.txt')
  writeFileSync(outputPath, '')
  execFileSync(process.execPath, [SCRIPT_PATH, '--base', baseSha], {
    cwd: repo,
    encoding: 'utf8',
    env: { ...process.env, GITHUB_OUTPUT: outputPath },
  })
  return Object.fromEntries(
    readFileSync(outputPath, 'utf8')
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const separator = line.indexOf('=')
        return [line.slice(0, separator), line.slice(separator + 1)]
      }),
  )
}

afterEach(() => {
  for (const repo of TEMP_REPOS.splice(0)) rmSync(repo, { recursive: true, force: true })
})

describe('prepare-release production CLI', () => {
  it('uses the higher reachable tag and remains re-entrant across two runs', () => {
    const repo = mkdtempSync(join(tmpdir(), 'ankiflow-prepare-release-'))
    TEMP_REPOS.push(repo)
    git(repo, 'init')
    git(repo, 'config', 'user.name', 'AnkiFlow Test')
    git(repo, 'config', 'user.email', 'test@example.com')

    writeFileSync(
      join(repo, 'package.json'),
      `${JSON.stringify({ name: 'release-fixture', version: '0.1.0', private: true }, null, 2)}\n`,
    )
    writeFileSync(
      join(repo, 'package-lock.json'),
      `${JSON.stringify(
        {
          name: 'release-fixture',
          version: '0.1.0',
          lockfileVersion: 3,
          requires: true,
          packages: { '': { name: 'release-fixture', version: '0.1.0' } },
        },
        null,
        2,
      )}\n`,
    )
    writeFileSync(
      join(repo, 'CHANGELOG.md'),
      `# 変更履歴\n\n## [Unreleased]\n\n### 追加\n\n- リリース準備のテスト\n\n## [0.13.1] - 2026-07-31\n\n### 修正\n\n- 以前の修正\n\n[Unreleased]: https://example.com/compare/v0.13.1...develop\n[0.13.1]: https://example.com/releases/tag/v0.13.1\n`,
    )
    git(repo, 'add', 'package.json', 'package-lock.json', 'CHANGELOG.md')
    git(repo, 'commit', '-m', 'chore: リリース基点を作成')
    const baseSha = git(repo, 'rev-parse', 'HEAD')
    git(repo, 'tag', '-a', 'v0.13.1', '-m', 'release fixture')

    writeFileSync(join(repo, 'feature.txt'), 'feature\n')
    git(repo, 'add', 'feature.txt')
    git(repo, 'commit', '-m', 'feat: 新機能を追加')

    const firstOutputs = runPrepare(repo, baseSha)
    const firstPackage = readFileSync(join(repo, 'package.json'), 'utf8')
    const firstLockfile = readFileSync(join(repo, 'package-lock.json'), 'utf8')
    const firstChangelog = readFileSync(join(repo, 'CHANGELOG.md'), 'utf8')

    expect(firstOutputs).toEqual({ version: '0.14.0', changed: 'true' })
    expect(JSON.parse(firstPackage)).toMatchObject({ version: '0.14.0' })
    expect(JSON.parse(firstLockfile)).toMatchObject({
      version: '0.14.0',
      packages: { '': { version: '0.14.0' } },
    })
    expect(firstChangelog).toMatch(/## \[0\.14\.0\] - \d{4}-\d{2}-\d{2}/)
    expect(firstChangelog).toContain('- リリース準備のテスト')

    const secondOutputs = runPrepare(repo, baseSha)

    expect(secondOutputs).toEqual({ version: '0.14.0', changed: 'true' })
    expect(readFileSync(join(repo, 'package.json'), 'utf8')).toBe(firstPackage)
    expect(readFileSync(join(repo, 'package-lock.json'), 'utf8')).toBe(firstLockfile)
    expect(readFileSync(join(repo, 'CHANGELOG.md'), 'utf8')).toBe(firstChangelog)
  })
})

/**
 * Builds a fixture repository tagged v0.13.1, whose CHANGELOG carries the given
 * `[Unreleased]` body. Returns the base SHA that stands in for `origin/main`.
 */
function createFixtureRepo(unreleasedBody: string): { repo: string; baseSha: string } {
  const repo = mkdtempSync(join(tmpdir(), 'ankiflow-prepare-release-'))
  TEMP_REPOS.push(repo)
  git(repo, 'init')
  git(repo, 'config', 'user.name', 'AnkiFlow Test')
  git(repo, 'config', 'user.email', 'test@example.com')

  writeFileSync(
    join(repo, 'package.json'),
    `${JSON.stringify({ name: 'release-fixture', version: '0.13.1', private: true }, null, 2)}\n`,
  )
  writeFileSync(
    join(repo, 'package-lock.json'),
    `${JSON.stringify(
      {
        name: 'release-fixture',
        version: '0.13.1',
        lockfileVersion: 3,
        requires: true,
        packages: { '': { name: 'release-fixture', version: '0.13.1' } },
      },
      null,
      2,
    )}\n`,
  )
  writeFileSync(
    join(repo, 'CHANGELOG.md'),
    `# 変更履歴\n\n## [Unreleased]\n${unreleasedBody}\n## [0.13.1] - 2026-07-31\n\n### 修正\n\n- 以前の修正\n\n[Unreleased]: https://example.com/compare/v0.13.1...develop\n[0.13.1]: https://example.com/releases/tag/v0.13.1\n`,
  )
  git(repo, 'add', 'package.json', 'package-lock.json', 'CHANGELOG.md')
  git(repo, 'commit', '-m', 'chore: リリース基点を作成')
  const baseSha = git(repo, 'rev-parse', 'HEAD')
  git(repo, 'tag', '-a', 'v0.13.1', '-m', 'release fixture')
  return { repo, baseSha }
}

function commitFile(repo: string, name: string, subject: string): void {
  writeFileSync(join(repo, name), `${name}\n`)
  git(repo, 'add', name)
  git(repo, 'commit', '-m', subject)
}

/** Runs the CLI expecting a non-zero exit, and returns the combined output. */
function runPrepareExpectingFailure(repo: string, baseSha: string): string {
  const outputPath = join(repo, 'github-output.txt')
  writeFileSync(outputPath, '')
  try {
    execFileSync(process.execPath, [SCRIPT_PATH, '--base', baseSha], {
      cwd: repo,
      encoding: 'utf8',
      env: { ...process.env, GITHUB_OUTPUT: outputPath },
      stdio: 'pipe',
    })
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string }
    expect(failure.status).not.toBe(0)
    return `${failure.stdout ?? ''}${failure.stderr ?? ''}`
  }
  throw new Error('Expected prepare-release to exit non-zero, but it succeeded.')
}

describe('prepare-release: changes that must not produce a release', () => {
  // docs/CONTRIBUTING.md forbids a CHANGELOG entry for documentation-only work,
  // so bumping for it would always yield an empty section that the tagging step
  // rejects after the merge into main.
  it.each(['docs: 設計文書を同期', 'test: 検証仕様を追加', 'ci(release): ワークフローを調整'])(
    'treats %s as non-releasable and leaves the manifest untouched',
    (subject) => {
      const { repo, baseSha } = createFixtureRepo('\n')
      const originalPackage = readFileSync(join(repo, 'package.json'), 'utf8')
      const originalChangelog = readFileSync(join(repo, 'CHANGELOG.md'), 'utf8')

      commitFile(repo, 'note.txt', subject)

      expect(runPrepare(repo, baseSha)).toEqual({ version: '', changed: 'false' })
      expect(readFileSync(join(repo, 'package.json'), 'utf8')).toBe(originalPackage)
      expect(readFileSync(join(repo, 'CHANGELOG.md'), 'utf8')).toBe(originalChangelog)
    },
  )

  it('still releases when a user-facing commit accompanies documentation', () => {
    const { repo, baseSha } = createFixtureRepo('\n### 追加\n\n- 新しい画面\n\n')

    commitFile(repo, 'note.txt', 'docs: 設計文書を同期')
    commitFile(repo, 'feature.txt', 'feat: 新しい画面を追加')

    expect(runPrepare(repo, baseSha)).toEqual({ version: '0.14.0', changed: 'true' })
    expect(readFileSync(join(repo, 'CHANGELOG.md'), 'utf8')).toContain('- 新しい画面')
  })

  it('keeps a breaking documentation change releasable', () => {
    const { repo, baseSha } = createFixtureRepo('\n### 破壊的変更\n\n- 手順を変更\n\n')

    commitFile(repo, 'note.txt', 'docs!: 移行手順を変更')

    expect(runPrepare(repo, baseSha)).toEqual({ version: '0.14.0', changed: 'true' })
  })
})

describe('prepare-release: empty changelog section', () => {
  // Failing here keeps the problem on the branch. release-tag-state.mjs also
  // rejects this state, but only once the merge into main has already happened.
  it('refuses to prepare a release when [Unreleased] is empty', () => {
    const { repo, baseSha } = createFixtureRepo('\n')
    const originalPackage = readFileSync(join(repo, 'package.json'), 'utf8')
    const originalChangelog = readFileSync(join(repo, 'CHANGELOG.md'), 'utf8')

    commitFile(repo, 'patch.txt', 'fix: 不具合を修正')

    const output = runPrepareExpectingFailure(repo, baseSha)

    expect(output).toContain('::error::')
    expect(output).toContain('[Unreleased] が空')
    // Nothing may be written before the refusal.
    expect(readFileSync(join(repo, 'package.json'), 'utf8')).toBe(originalPackage)
    expect(readFileSync(join(repo, 'CHANGELOG.md'), 'utf8')).toBe(originalChangelog)
  })
})
