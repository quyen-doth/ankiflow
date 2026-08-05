import { execSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Anti-rot guard for the portfolio screenshots. Keeps README / SCREENS.md and the
 * committed PNGs in `docs/screenshots/` in sync, and enforces the repo size budget:
 *   1. every screenshot referenced by the docs actually exists (no broken image links)
 *   2. every committed screenshot is referenced somewhere (no orphaned dead weight)
 *   3. every committed screenshot stays within the size budget (no repo bloat creep)
 *
 * Only tracked `.png` files count — the git-ignored `core-loop.webm` is intentionally excluded.
 */

const REPO_ROOT = process.cwd()
const SCREENSHOTS_DIR = 'docs/screenshots'
const BUDGET_BYTES = 300 * 1024
/** The docs that are allowed to embed screenshots (D9). */
const EMBEDDING_DOCS = ['README.md', 'docs/02-design/SCREENS.md'] as const

export interface TrackedImage {
  name: string
  size: number
}

/** Extract the set of referenced screenshot basenames (`sc-003-dashboard.png`) from markdown. */
export function referencedScreenshots(markdownSources: readonly string[]): Set<string> {
  const names = new Set<string>()
  for (const source of markdownSources) {
    for (const match of source.matchAll(/screenshots\/([A-Za-z0-9._-]+\.png)/g)) {
      names.add(match[1])
    }
  }
  return names
}

/** Pure core: returns a sorted list of violation messages (empty = healthy). */
export function validateScreenshotIntegrity(input: {
  tracked: readonly TrackedImage[]
  referenced: ReadonlySet<string>
  budgetBytes: number
}): string[] {
  const { tracked, referenced, budgetBytes } = input
  const trackedNames = new Set(tracked.map(image => image.name))
  const violations: string[] = []

  for (const name of referenced) {
    if (!trackedNames.has(name)) violations.push(`referenced but missing: ${name}`)
  }
  for (const image of tracked) {
    if (!referenced.has(image.name)) violations.push(`committed but unreferenced (orphan): ${image.name}`)
    if (image.size > budgetBytes) {
      violations.push(`over budget: ${image.name} is ${(image.size / 1024).toFixed(1)}KB > ${budgetBytes / 1024}KB`)
    }
  }
  return violations.sort()
}

function trackedScreenshots(): TrackedImage[] {
  return execSync(`git ls-files ${SCREENSHOTS_DIR}`, { cwd: REPO_ROOT, encoding: 'utf8' })
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.toLowerCase().endsWith('.png'))
    .map(path => ({ name: basename(path), size: statSync(join(REPO_ROOT, path)).size }))
}

function embeddingDocSources(): string[] {
  return EMBEDDING_DOCS.map(doc => readFileSync(join(REPO_ROOT, doc), 'utf8'))
}

describe('portfolio screenshot integrity', () => {
  it('docs references, committed PNGs, and the size budget are all in sync', () => {
    const tracked = trackedScreenshots()
    const referenced = referencedScreenshots(embeddingDocSources())
    expect(tracked.length, 'expected at least one committed screenshot').toBeGreaterThan(0)
    expect(validateScreenshotIntegrity({ tracked, referenced, budgetBytes: BUDGET_BYTES })).toEqual([])
  })

  // ── Proof the guard actually fails (R-18): synthetic inputs, no repo mutation. ──

  it('flags a screenshot referenced by the docs but not committed', () => {
    const tracked = [{ name: 'sc-003-dashboard.png', size: 1000 }]
    const referenced = new Set(['sc-003-dashboard.png', 'sc-999-ghost.png'])
    expect(validateScreenshotIntegrity({ tracked, referenced, budgetBytes: BUDGET_BYTES })).toContain(
      'referenced but missing: sc-999-ghost.png',
    )
  })

  it('flags a committed screenshot that no doc references (orphan)', () => {
    const tracked = [
      { name: 'sc-003-dashboard.png', size: 1000 },
      { name: 'sc-004-create.png', size: 1000 },
    ]
    const referenced = new Set(['sc-003-dashboard.png'])
    expect(validateScreenshotIntegrity({ tracked, referenced, budgetBytes: BUDGET_BYTES })).toContain(
      'committed but unreferenced (orphan): sc-004-create.png',
    )
  })

  it('flags a committed screenshot that exceeds the size budget', () => {
    const tracked = [{ name: 'sc-007-history.png', size: BUDGET_BYTES + 1 }]
    const referenced = new Set(['sc-007-history.png'])
    expect(validateScreenshotIntegrity({ tracked, referenced, budgetBytes: BUDGET_BYTES })).toContain(
      `over budget: sc-007-history.png is ${((BUDGET_BYTES + 1) / 1024).toFixed(1)}KB > ${BUDGET_BYTES / 1024}KB`,
    )
  })
})
