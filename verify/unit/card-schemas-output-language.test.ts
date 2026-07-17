import { describe, expect, it } from 'vitest'
import { resolveCardSpec, type CardSpec } from '@/lib/ai-agent/card-schemas'
import type { GenerateCardInput } from '@/lib/ai-agent/types'
import { FormType } from '@/types'

interface BranchCase {
  name: string
  input: GenerateCardInput
  languageBranch: boolean
  specializedPrompt: boolean
}

const BRANCHES: BranchCase[] = [
  {
    name: 'English',
    input: { form_type: FormType.LANGUAGE, language: 'en', word: 'book' },
    languageBranch: true,
    specializedPrompt: true,
  },
  {
    name: 'Chinese',
    input: { form_type: FormType.LANGUAGE, language: 'zh', word: '书' },
    languageBranch: true,
    specializedPrompt: true,
  },
  {
    name: 'Japanese',
    input: { form_type: FormType.LANGUAGE, language: 'ja', word: '本' },
    languageBranch: true,
    specializedPrompt: true,
  },
  {
    name: 'generic language',
    input: { form_type: FormType.LANGUAGE, language: 'fr', word: 'livre' },
    languageBranch: true,
    specializedPrompt: false,
  },
  {
    name: 'IT',
    input: { form_type: FormType.IT, term: 'event loop' },
    languageBranch: false,
    specializedPrompt: true,
  },
  {
    name: 'dynamic',
    input: {
      form_type: 'custom_type',
      word: 'photosynthesis',
      dynamicFields: { context: 'biology' },
      contentTypeName: 'Science',
    },
    languageBranch: false,
    specializedPrompt: false,
  },
]

function schemaProperties(spec: CardSpec): Record<string, unknown> {
  const schema = spec.inputSchema as { properties?: Record<string, unknown> }
  return schema.properties ?? {}
}

describe('resolveCardSpec — AI output language', () => {
  for (const branch of BRANCHES) {
    it(`${branch.name} は English を prompt と schema に反映する`, () => {
      const spec = resolveCardSpec({
        ...branch.input,
        output_language: 'en',
        output_language_name: 'English',
      })
      const serializedSchema = JSON.stringify(spec.inputSchema)

      expect(spec.systemPrompt).toContain('English')
      expect(spec.systemPrompt).not.toMatch(/ベトナム|Vietnamese|tiếng Việt/)
      expect(serializedSchema).toContain('English')
      if (branch.languageBranch) expect(serializedSchema).toContain('Meaning in English')
    })

    it(`${branch.name} は output language 未指定時に Vietnamese を使用する`, () => {
      const spec = resolveCardSpec(branch.input)

      expect(spec.systemPrompt).toContain('Vietnamese')
      if (branch.specializedPrompt) expect(spec.systemPrompt).toContain('Vietnamese話者')
      expect(JSON.stringify(spec.inputSchema)).toContain('Vietnamese')
    })
  }

  it('Chinese と Japanese は Vietnamese 出力時だけ han_viet を要求する', () => {
    for (const language of ['zh', 'ja']) {
      const vietnamese = resolveCardSpec({
        form_type: FormType.LANGUAGE,
        language,
        word: '本',
      })
      const english = resolveCardSpec({
        form_type: FormType.LANGUAGE,
        language,
        word: '本',
        output_language: 'en',
        output_language_name: 'English',
      })

      expect(schemaProperties(vietnamese)).toHaveProperty('han_viet')
      expect(schemaProperties(english)).not.toHaveProperty('han_viet')
    }
  })

  it('built-in strategy は dynamicFields を schema を変えず prompt context に追加する', () => {
    const spec = resolveCardSpec({
      form_type: FormType.IT,
      term: 'event loop',
      dynamicFields: {
        definition: 'Coordinates asynchronous callbacks',
        audience: 'Beginners',
      },
    })

    expect(spec.userMessage).toContain('Additional context:')
    expect(spec.userMessage).toContain('definition: Coordinates asynchronous callbacks')
    expect(spec.userMessage).toContain('audience: Beginners')
    expect(schemaProperties(spec)).not.toHaveProperty('audience')
  })
})
