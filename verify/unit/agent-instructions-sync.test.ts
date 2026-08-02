import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const REPO_ROOT = process.cwd()
const CANONICAL_BODY_START = '## Project Overview'

function canonicalBody(fileName: string): string {
  const content = readFileSync(resolve(REPO_ROOT, fileName), 'utf8')
  const bodyStart = content.indexOf(CANONICAL_BODY_START)
  if (bodyStart === -1) {
    throw new Error(`${fileName} is missing ${CANONICAL_BODY_START}`)
  }
  return content.slice(bodyStart).replace(/\r\n/g, '\n')
}

describe('agent instruction synchronization', () => {
  it('keeps the shared AGENTS.md and CLAUDE.md body identical', () => {
    expect(canonicalBody('AGENTS.md')).toBe(canonicalBody('CLAUDE.md'))
  })
})
