import { describe, expect, it } from 'vitest'
import { buildEngineCardSpec } from '@/lib/ai-agent/promptEngine'
import {
  cloneAiOutputProfiles,
  parseAiOutputProfiles,
  RESERVED_AI_OUTPUT_KEYS,
} from '@/lib/ai-agent/outputProfiles'
import type { AiOutputProfile } from '@/types'

const profiles: AiOutputProfile[] = [
  {
    profile: 'default',
    fields: [
      { key: 'prompt', type: 'string', instruction: 'Original {study_language} prompt' },
      { key: 'answer', type: 'string', instruction: 'Answer in {output_language}' },
      { key: 'sources', type: 'string_array', instruction: 'Useful sources', max_items: 3 },
      { key: 'local_note', type: 'string', instruction: 'Vietnamese-only note', include_when: 'output_vi' },
    ],
  },
  {
    profile: 'en',
    fields: [
      { key: 'prompt', type: 'string', instruction: 'English prompt' },
      { key: 'answer', type: 'string', instruction: 'English answer in {output_language}' },
    ],
  },
]

function build(options: { studyCode?: string; outputCode?: string } = {}) {
  return buildEngineCardSpec({
    definition: {
      name: 'Research Note',
      primary_field_key: 'prompt',
      ai_output_profiles: profiles,
      field_labels: { prompt: 'Question', audience: 'Audience' },
    },
    ...(options.studyCode
      ? { studyLanguage: { code: options.studyCode, name: 'English' } }
      : {}),
    outputLanguage: {
      code: options.outputCode ?? 'vi',
      name: options.outputCode === 'en' ? 'English' : 'Vietnamese',
    },
    primaryValue: 'Why do event loops matter?',
    formValues: {
      prompt: 'Why do event loops matter?',
      audience: 'Beginners',
      blank: '   ',
    },
  })
}

function schemaProperties(spec: ReturnType<typeof build>) {
  return (spec.inputSchema as {
    properties: Record<string, { description?: string; maxItems?: number }>
  }).properties
}

describe('prompt engine — custom profiles', () => {
  it('exact language profile を選び、なければ default に fallback する', () => {
    expect(Object.keys(schemaProperties(build({ studyCode: 'en-GB' })))).toEqual(['prompt', 'answer'])
    expect(Object.keys(schemaProperties(build({ studyCode: 'fr' })))).toEqual([
      'prompt', 'answer', 'sources', 'local_note',
    ])
  })

  it('placeholder、array limit、output_vi 条件を解決する', () => {
    const vietnamese = schemaProperties(build({ studyCode: 'fr' }))
    const english = schemaProperties(build({ studyCode: 'fr', outputCode: 'en' }))

    expect(vietnamese.answer?.description).toBe('Answer in Vietnamese')
    expect(vietnamese.prompt?.description).toBe('Original English prompt')
    expect(vietnamese.sources?.maxItems).toBe(3)
    expect(vietnamese).toHaveProperty('local_note')
    expect(english).not.toHaveProperty('local_note')
  })

  it('user context は label を使用し、blank/primary duplicate を除外する', () => {
    const message = build().userMessage
    expect(message).toContain('Question: "Why do event loops matter?"')
    expect(message).toContain('Audience: Beginners')
    expect(message).not.toContain('- prompt:')
    expect(message).not.toContain('blank')
  })

  it('system prompt と user message の control text は English だけを使用する', () => {
    const spec = build({ studyCode: 'fr' })
    expect(spec.systemPrompt).toContain('You are an expert')
    expect(spec.systemPrompt).toContain('Key requirements:')
    expect(spec.systemPrompt).toContain('Submit the result only through')
    expect(spec.userMessage).toContain('Additional context:')
    expect(`${spec.systemPrompt}\n${spec.userMessage}`).not.toMatch(/[ぁ-んァ-ヶ]/)
  })

  it('schema は extra field を拒否し、array 上限を検証する', () => {
    const spec = build({ studyCode: 'fr', outputCode: 'en' })
    const valid = {
      prompt: 'Question',
      answer: 'Answer',
      sources: ['one', 'two', 'three'],
    }
    expect(spec.schema.parse({ ...valid, ignored: 'x' })).toEqual(valid)
    expect(() => spec.schema.parse({ ...valid, sources: ['1', '2', '3', '4'] })).toThrow()
    expect(spec.inputSchema).toMatchObject({ additionalProperties: false })
  })
})

describe('AI output profile validation', () => {
  it('reserved metadata key をすべて拒否する', () => {
    for (const key of RESERVED_AI_OUTPUT_KEYS) {
      expect(() => parseAiOutputProfiles([{
        profile: 'default',
        fields: [{ key, type: 'string', instruction: 'Unsafe' }],
      }])).toThrow()
    }
  })

  it('default profile、unique key、primary field を必須にする', () => {
    expect(() => parseAiOutputProfiles([{
      profile: 'en',
      fields: [{ key: 'prompt', type: 'string', instruction: 'Prompt' }],
    }])).toThrow('default')

    expect(() => parseAiOutputProfiles([{
      profile: 'default',
      fields: [
        { key: 'prompt', type: 'string', instruction: 'Prompt' },
        { key: 'prompt', type: 'string', instruction: 'Duplicate' },
      ],
    }])).toThrow()

    expect(() => parseAiOutputProfiles([{
      profile: 'default',
      fields: [{ key: 'answer', type: 'string', instruction: 'Answer' }],
    }], 'prompt')).toThrow('must include primary field')
  })

  it('primary field に conditional include を許可しない', () => {
    expect(() => parseAiOutputProfiles([{
      profile: 'default',
      fields: [{
        key: 'prompt',
        type: 'string',
        instruction: 'Prompt',
        include_when: 'output_vi',
      }],
    }], 'prompt')).toThrow('must always be included')
  })

  it('明示的な inheritance は空の own fields を許可し、metadata を round-trip する', () => {
    const parsed = parseAiOutputProfiles([
      {
        profile: 'default',
        fields: [{ key: 'prompt', type: 'string', instruction: 'Prompt' }],
      },
      {
        profile: 'fr',
        inherit: true,
        exclude: [],
        fields: [],
      },
    ], 'prompt')

    expect(parseAiOutputProfiles(cloneAiOutputProfiles(parsed), 'prompt')).toEqual(parsed)
    expect(parsed[1]).toEqual({ profile: 'fr', inherit: true, exclude: [], fields: [] })
  })

  it('inherit=false と primary field の exclude を拒否する', () => {
    expect(() => parseAiOutputProfiles([
      {
        profile: 'default',
        fields: [{ key: 'prompt', type: 'string', instruction: 'Prompt' }],
      },
      {
        profile: 'fr',
        inherit: false,
        fields: [],
      },
    ], 'prompt')).toThrow()

    expect(() => parseAiOutputProfiles([
      {
        profile: 'default',
        fields: [{ key: 'prompt', type: 'string', instruction: 'Prompt' }],
      },
      {
        profile: 'fr',
        inherit: true,
        exclude: ['prompt'],
        fields: [],
      },
    ], 'prompt')).toThrow('cannot exclude primary field')
  })

  it('string field の max_items と不正 profile key を拒否する', () => {
    expect(() => parseAiOutputProfiles([{
      profile: 'default',
      fields: [{ key: 'prompt', type: 'string', instruction: 'Prompt', max_items: 3 }],
    }])).toThrow('max_items')

    expect(() => parseAiOutputProfiles([{
      profile: 'en-US',
      fields: [{ key: 'prompt', type: 'string', instruction: 'Prompt' }],
    }])).toThrow()
  })
})
