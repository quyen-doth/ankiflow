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
