import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

const WORKFLOW_ROOT = join(process.cwd(), '.github/workflows')
const WORKFLOW_FILES = readdirSync(WORKFLOW_ROOT)
  .filter((file) => /\.ya?ml$/.test(file))
  .sort()

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readWorkflow(file: string): Record<string, unknown> {
  const parsed: unknown = parse(readFileSync(join(WORKFLOW_ROOT, file), 'utf8'))
  expect(isRecord(parsed), file).toBe(true)
  if (!isRecord(parsed)) throw new Error(`${file} must contain a YAML mapping`)
  return parsed
}

describe('GitHub workflow YAML', () => {
  it.each(WORKFLOW_FILES)('%s parses with the required top-level shape', (file) => {
    const workflow = readWorkflow(file)

    expect(typeof workflow.name, `${file}#name`).toBe('string')
    expect(workflow).toHaveProperty('on')
    expect(isRecord(workflow.jobs), `${file}#jobs`).toBe(true)
    expect(Object.keys(workflow.jobs as Record<string, unknown>).length, `${file}#jobs`).toBeGreaterThan(0)
  })

  it('release-tag.yml wires the production state CLI between probe and independent mutations', () => {
    const workflow = readWorkflow('release-tag.yml')
    const jobs = workflow.jobs
    expect(isRecord(jobs)).toBe(true)
    if (!isRecord(jobs)) return
    const job = jobs['tag-and-release']
    expect(isRecord(job)).toBe(true)
    if (!isRecord(job) || !Array.isArray(job.steps)) return

    const steps = job.steps.filter(isRecord)
    const guard = steps[0]
    const releaseProbe = steps.find((step) => step.id === 'release')
    const state = steps.find((step) => step.id === 'state')
    expect(guard?.name).toBe('Guard release ref')
    expect(guard?.run).toContain('refs/heads/main')
    expect(guard?.run).toContain('exit 1')
    expect(releaseProbe?.uses).toBe('actions/github-script@v9')
    expect(isRecord(releaseProbe?.with)).toBe(true)
    if (isRecord(releaseProbe?.with)) {
      expect(releaseProbe.with.script).toContain('error.status === 404')
      expect(releaseProbe.with.script).toContain('throw error')
    }
    expect(state?.run).toBe('node scripts/release-tag-state.mjs')
    expect(isRecord(state?.env) && state.env.GH_TOKEN).toBeUndefined()
    expect(steps.find((step) => step.name === 'Create tag')?.if).toBe(
      "steps.state.outputs.create_tag == 'true'",
    )
    expect(steps.find((step) => step.name === 'Create GitHub Release')?.if).toBe(
      "steps.state.outputs.create_release == 'true'",
    )
  })

  it('release-pr.yml creates a sync PR even when no version bump is required', () => {
    const workflow = readWorkflow('release-pr.yml')
    const jobs = workflow.jobs
    expect(isRecord(jobs)).toBe(true)
    if (!isRecord(jobs)) return
    const job = jobs['create-release-pr']
    expect(isRecord(job)).toBe(true)
    if (!isRecord(job) || !Array.isArray(job.steps)) return

    const steps = job.steps.filter(isRecord)
    const createPr = steps.find((step) => step.name === 'Create or update release PR')
    expect(createPr).toBeDefined()
    expect(createPr?.if).toBeUndefined()
    expect(createPr?.uses).toBe('actions/github-script@v9')
    expect(isRecord(createPr?.with)).toBe(true)
    if (!isRecord(createPr?.with)) return

    expect(createPr.with.script).toContain("version !== ''")
    expect(createPr.with.script).toContain('release: v${version}')
    expect(createPr.with.script).toContain('release: developをmainへ同期')
    expect(createPr.with.script).toContain('- バージョン: **変更なし**')
    expect(createPr.with.script).toContain('compare.data.files.length === 0')
  })
})
