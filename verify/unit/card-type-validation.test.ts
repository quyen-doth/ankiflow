import { describe, expect, it } from 'vitest'
import { CardTypePostSchema, CardTypePutSchema } from '@/lib/validation'
import { FormType } from '@/types'

describe('Card Type validation', () => {
  it('POST payload の study/output language に null を受け入れる', () => {
    expect(CardTypePostSchema.parse({
      name: 'All languages',
      form_type: FormType.LANGUAGE,
      language: null,
      output_language: null,
    })).toMatchObject({
      language: null,
      output_language: null,
    })
  })

  it('PUT payload の study/output language に null を受け入れる', () => {
    expect(CardTypePutSchema.parse({
      id: 'card-type-id',
      language: null,
      output_language: null,
    })).toEqual({
      id: 'card-type-id',
      language: null,
      output_language: null,
    })
  })
})
