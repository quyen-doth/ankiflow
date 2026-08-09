import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { decideReleaseActions } from '../../scripts/release-tag-state.mjs'

const SCRIPT_PATH = resolve('scripts/release-tag-state.mjs')
const TEMP_REPOS: string[] = []

interface CliResult {
  status: number | null
  stderr: string
  outputs: Record<string, string>
}

function git(repo: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim()
}

function createRepo(version = '1.2.3'): { repo: string; headSha: string } {
  const repo = mkdtempSync(join(tmpdir(), 'ankiflow-release-tag-state-'))
  TEMP_REPOS.push(repo)
  git(repo, 'init')
  git(repo, 'config', 'user.name', 'AnkiFlow Test')
  git(repo, 'config', 'user.email', 'test@example.com')
  writeFileSync(
    join(repo, 'CHANGELOG.md'),
    `# 変更履歴\n\n## [Unreleased]\n\n## [${version}] - 2026-08-01\n\n### 追加\n\n- テスト用の変更\n`,
  )
  writeFileSync(join(repo, 'fixture.txt'), 'initial\n')
  git(repo, 'add', 'CHANGELOG.md', 'fixture.txt')
  git(repo, 'commit', '-m', 'feat: 初期コミット')
  return { repo, headSha: git(repo, 'rev-parse', 'HEAD') }
}

function runCli(
  repo: string,
  {
    version = '1.2.3',
    headSha = git(repo, 'rev-parse', 'HEAD'),
    ref = 'refs/heads/main',
    releaseExists = false,
  }: {
    version?: string
    headSha?: string
    ref?: string
    releaseExists?: boolean
  } = {},
): CliResult {
  const outputPath = join(repo, 'github-output.txt')
  const notesPath = join(repo, 'release-notes.md')
  writeFileSync(outputPath, '')
  const result = spawnSync(process.execPath, [SCRIPT_PATH], {
    cwd: repo,
    encoding: 'utf8',
    env: {
      ...process.env,
      VERSION: version,
      RELEASE_REF: ref,
      HEAD_SHA: headSha,
      RELEASE_EXISTS: String(releaseExists),
      RELEASE_NOTES_PATH: notesPath,
      GITHUB_OUTPUT: outputPath,
    },
  })
  const outputs = Object.fromEntries(
    readFileSync(outputPath, 'utf8')
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const separator = line.indexOf('=')
        return [line.slice(0, separator), line.slice(separator + 1)]
      }),
  )
  return { status: result.status, stderr: result.stderr, outputs }
}

afterEach(() => {
  for (const repo of TEMP_REPOS.splice(0)) rmSync(repo, { recursive: true, force: true })
})

describe('release tag state decisions', () => {
  const base = {
    version: '1.2.3',
    ref: 'refs/heads/main',
    tagExists: false,
    tagCommitSha: null,
    tagIsAncestor: false,
    headSha: 'head-sha',
    releaseExists: false,
    releaseNotesPresent: true,
  }

  it('creates both artifacts when neither exists', () => {
    expect(decideReleaseActions(base)).toMatchObject({
      outcome: 'ready',
      createTag: true,
      createRelease: true,
    })
  })

  it('creates only the release when the tag already points at HEAD', () => {
    expect(
      decideReleaseActions({
        ...base,
        tagExists: true,
        tagCommitSha: 'head-sha',
        tagIsAncestor: true,
      }),
    ).toMatchObject({ outcome: 'ready', createTag: false, createRelease: true })
  })

  it('does nothing when the tag and release both exist', () => {
    expect(
      decideReleaseActions({
        ...base,
        tagExists: true,
        tagCommitSha: 'head-sha',
        tagIsAncestor: true,
        releaseExists: true,
      }),
    ).toMatchObject({ outcome: 'noop', createTag: false, createRelease: false })
  })

  it('keeps existing artifacts when the tag points at an ancestor of HEAD', () => {
    expect(
      decideReleaseActions({
        ...base,
        tagExists: true,
        tagCommitSha: 'ancestor-sha',
        tagIsAncestor: true,
        releaseExists: true,
      }),
    ).toMatchObject({ outcome: 'noop', createTag: false, createRelease: false })
  })

  it('creates only a missing release when the tag points at an ancestor of HEAD', () => {
    expect(
      decideReleaseActions({
        ...base,
        tagExists: true,
        tagCommitSha: 'ancestor-sha',
        tagIsAncestor: true,
      }),
    ).toMatchObject({ outcome: 'ready', createTag: false, createRelease: true })
  })

  it('fails when the existing tag points at a non-ancestor commit', () => {
    expect(
      decideReleaseActions({
        ...base,
        tagExists: true,
        tagCommitSha: 'other-sha',
        tagIsAncestor: false,
      }),
    ).toMatchObject({ outcome: 'fail', createTag: false, createRelease: false })
  })

  it('fails when dispatched from a ref other than main', () => {
    expect(decideReleaseActions({ ...base, ref: 'refs/heads/feature' })).toMatchObject({
      outcome: 'fail',
      createTag: false,
      createRelease: false,
    })
  })

  it('fails when the version has no release notes', () => {
    expect(decideReleaseActions({ ...base, releaseNotesPresent: false })).toMatchObject({
      outcome: 'fail',
      createTag: false,
      createRelease: false,
    })
  })
})

describe('release tag state production CLI', () => {
  it('peels an annotated tag to the commit at HEAD', () => {
    const { repo, headSha } = createRepo()
    git(repo, 'tag', '-a', 'v1.2.3', '-m', 'release fixture')

    const result = runCli(repo, { headSha })

    expect(result.status).toBe(0)
    expect(result.outputs).toMatchObject({
      tag_exists: 'true',
      tag_commit_sha: headSha,
      tag_is_ancestor: 'true',
      create_tag: 'false',
      create_release: 'true',
    })
    expect(git(repo, 'rev-parse', 'refs/tags/v1.2.3')).not.toBe(headSha)
  })

  it('accepts an annotated tag that points at an ancestor commit', () => {
    const { repo } = createRepo()
    git(repo, 'tag', '-a', 'v1.2.3', '-m', 'release fixture')
    writeFileSync(join(repo, 'fixture.txt'), 'second\n')
    git(repo, 'add', 'fixture.txt')
    git(repo, 'commit', '-m', 'fix: 次のコミット')

    const result = runCli(repo)

    expect(result.status).toBe(0)
    expect(result.outputs).toMatchObject({
      outcome: 'ready',
      tag_is_ancestor: 'true',
      create_tag: 'false',
      create_release: 'true',
    })
  })

  it('fails when an annotated tag points at a non-ancestor commit', () => {
    const { repo } = createRepo()
    git(repo, 'checkout', '-b', 'tagged-release')
    writeFileSync(join(repo, 'fixture.txt'), 'tagged release\n')
    git(repo, 'add', 'fixture.txt')
    git(repo, 'commit', '-m', 'fix: タグ側のコミット')
    git(repo, 'tag', '-a', 'v1.2.3', '-m', 'release fixture')
    git(repo, 'checkout', '-')
    writeFileSync(join(repo, 'fixture.txt'), 'main line\n')
    git(repo, 'add', 'fixture.txt')
    git(repo, 'commit', '-m', 'fix: main側のコミット')

    const result = runCli(repo)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('::error::')
    expect(result.outputs).toMatchObject({
      outcome: 'fail',
      tag_is_ancestor: 'false',
      create_tag: 'false',
    })
  })

  it('does not mistake a same-named branch for an exact tag ref', () => {
    const { repo, headSha } = createRepo()
    git(repo, 'branch', 'v1.2.3')

    const result = runCli(repo, { headSha })

    expect(result.status).toBe(0)
    expect(result.outputs).toMatchObject({
      tag_exists: 'false',
      tag_commit_sha: '',
      tag_is_ancestor: 'false',
      create_tag: 'true',
      create_release: 'true',
    })
  })
})
