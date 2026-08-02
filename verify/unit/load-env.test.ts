import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadEnv } from '../../scripts/lib/load-env'

const TEST_VALUE_NAME = 'ANKIFLOW_LOAD_ENV_TEST_VALUE'
const REQUIRED_NAME_A = 'ANKIFLOW_LOAD_ENV_REQUIRED_A'
const REQUIRED_NAME_B = 'ANKIFLOW_LOAD_ENV_REQUIRED_B'
const TEST_ENV_NAMES = [TEST_VALUE_NAME, REQUIRED_NAME_A, REQUIRED_NAME_B] as const

describe.sequential('loadEnv', () => {
  let originalCwd: string
  let temporaryCwd: string
  let originalValues: Map<string, string | undefined>

  beforeEach(() => {
    originalCwd = process.cwd()
    temporaryCwd = mkdtempSync(join(tmpdir(), 'ankiflow-load-env-'))
    originalValues = new Map(TEST_ENV_NAMES.map((name) => [name, process.env[name]]))
    for (const name of TEST_ENV_NAMES) delete process.env[name]
    process.chdir(temporaryCwd)
  })

  afterEach(() => {
    process.chdir(originalCwd)
    for (const [name, value] of originalValues) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
    rmSync(temporaryCwd, { recursive: true, force: true })
  })

  it('loads a value from .env when it is the only file', () => {
    writeFileSync('.env', `${TEST_VALUE_NAME}=from-env\n`)

    loadEnv()

    expect(process.env[TEST_VALUE_NAME]).toBe('from-env')
  })

  it('gives .env.local precedence over .env', () => {
    writeFileSync('.env', `${TEST_VALUE_NAME}=from-env\n`)
    writeFileSync('.env.local', `${TEST_VALUE_NAME}=from-env-local\n`)

    loadEnv()

    expect(process.env[TEST_VALUE_NAME]).toBe('from-env-local')
  })

  it('preserves a shell-provided value over both files', () => {
    process.env[TEST_VALUE_NAME] = 'from-shell'
    writeFileSync('.env', `${TEST_VALUE_NAME}=from-env\n`)
    writeFileSync('.env.local', `${TEST_VALUE_NAME}=from-env-local\n`)

    loadEnv()

    expect(process.env[TEST_VALUE_NAME]).toBe('from-shell')
  })

  it('does not throw when no files or required names are provided', () => {
    expect(() => loadEnv()).not.toThrow()
  })

  it('reports every missing or blank required name in one error', () => {
    process.env[REQUIRED_NAME_A] = '   '

    expect(() =>
      loadEnv({ required: [REQUIRED_NAME_A, REQUIRED_NAME_B] }),
    ).toThrowError(
      `Missing required environment variables: ${REQUIRED_NAME_A}, ${REQUIRED_NAME_B}`,
    )
  })

  it('does not throw when every required name is present', () => {
    process.env[REQUIRED_NAME_A] = 'from-shell'
    writeFileSync('.env', `${REQUIRED_NAME_B}=from-env\n`)

    expect(() =>
      loadEnv({ required: [REQUIRED_NAME_A, REQUIRED_NAME_B] }),
    ).not.toThrow()
  })
})
