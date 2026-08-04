import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Guard: every tracked markdown file under `docs/` must be discoverable from the agent Docs table so an agent
 * reading CLAUDE.md / AGENTS.md knows the file exists. Separate from `agent-instructions-sync`
 * (which asserts the two files are identical) — this asserts they are complete (D4).
 *
 * "Covered" is defined precisely so the guard actually fails when a doc drifts out of the table
 * (R-18): a bare directory prefix does NOT cover its files — otherwise the four directories already
 * listed by filename (`docs/01-requirements/` … `docs/04-operations/`) would silently absorb any new
 * file added to them, and the root `docs/` mention in the Language Policy would absorb everything.
 */
const REPO_ROOT = process.cwd()
const AGENT_FILES = ['CLAUDE.md', 'AGENTS.md'] as const

function trackedDocsMarkdown(): string[] {
  return execSync('git ls-files docs', { cwd: REPO_ROOT, encoding: 'utf8' })
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.endsWith('.md'))
}

const DOCS_TABLE_HEADER = '| File | Read when |'

/** Slice out only the Docs table so incidental `docs/…` mentions elsewhere (prose, Gotchas) do not count as coverage. */
function docsTableRegion(content: string): string {
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  const start = lines.findIndex(line => line.trimStart().startsWith(DOCS_TABLE_HEADER))
  if (start === -1) throw new Error(`${DOCS_TABLE_HEADER} header not found — the Docs table may have moved`)
  let end = start + 1
  while (end < lines.length && lines[end].trimStart().startsWith('|')) end += 1
  return lines.slice(start, end).join('\n')
}

/** Extract coverage tokens from the agent file's Docs table: exact `docs/…/x.md` paths and explicit `docs/<dir>/` entries. */
function coverage(agentFile: string): { files: Set<string>; directories: Set<string> } {
  const content = readFileSync(resolve(REPO_ROOT, agentFile), 'utf8')
  const region = docsTableRegion(content)
  const files = new Set<string>()
  const directories = new Set<string>()

  for (const match of region.matchAll(/docs\/[A-Za-z0-9_./-]+/g)) {
    const token = match[0]
    if (token.endsWith('.md')) {
      files.add(token)
    } else if (token.endsWith('/') && token !== 'docs/') {
      // A bare sub-directory entry (e.g. `docs/adr/`). The root `docs/` is too broad to count.
      directories.add(token)
    }
  }
  return { files, directories }
}

export function uncoveredDocs(agentFile: string): string[] {
  const { files, directories } = coverage(agentFile)
  return trackedDocsMarkdown().filter(doc => {
    if (files.has(doc)) return false
    return !directories.has(`${dirname(doc)}/`)
  })
}

describe('agent docs coverage', () => {
  it.each(AGENT_FILES)('%s Docs table covers every tracked docs/**/*.md', agentFile => {
    const missing = uncoveredDocs(agentFile)
    expect(missing, `${agentFile} Docs table is missing coverage for: ${missing.join(', ')}`).toEqual([])
  })
})
