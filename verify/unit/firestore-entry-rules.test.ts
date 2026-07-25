import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Firestore entries rules', () => {
  it('Client SDK は owner read のみで mutation できない', () => {
    const rules = readFileSync(join(process.cwd(), 'firestore.rules'), 'utf8')
    const block = rules.match(/match \/entries\/\{id\} \{([\s\S]*?)\n    \}/)?.[1]

    expect(block).toBeDefined()
    expect(block).toContain('allow read: if owns(resource);')
    expect(block).not.toMatch(/allow\s+(?:write|create|update|delete)/)
  })
})
