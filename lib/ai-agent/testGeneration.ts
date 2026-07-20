import { resolveContentTypeFormType, resolveRuntimeContentTypeCode } from '@/lib/contentTypes'
import { cloneAiOutputProfiles } from '@/lib/ai-agent/outputProfiles'
import { inferLanguageDisplayName } from '@/lib/studyLanguages'
import { FormType } from '@/types'
import type { AiOutputProfile, FormFieldConfig, StudyLanguage } from '@/types'

export interface TestGenerationContentTypeDraft {
  code: string
  name: string
  description: string
  fields: FormFieldConfig[]
}

interface BuildTestGenerationRequestArgs {
  contentType: TestGenerationContentTypeDraft
  profiles: AiOutputProfile[]
  sample: string
  studyLanguage?: Pick<StudyLanguage, 'code' | 'display_name'>
  outputLanguage: string
}

/** Editor の未保存 draft を /api/generate の inline request に変換する。 */
export function buildTestGenerationRequest({
  contentType,
  profiles,
  sample,
  studyLanguage,
  outputLanguage,
}: BuildTestGenerationRequestArgs): Record<string, unknown> {
  const formType = resolveRuntimeContentTypeCode(contentType.code)
  const builtInFormType = resolveContentTypeFormType(contentType.code.trim().toLocaleLowerCase('en-US'))
  const trimmedSample = sample.trim()

  return {
    form_type: formType,
    ...(builtInFormType === FormType.IT
      ? { term: trimmedSample }
      : { word: trimmedSample }),
    ...(builtInFormType === FormType.LANGUAGE && studyLanguage
      ? {
          language: studyLanguage.code,
          language_name: studyLanguage.display_name,
        }
      : {}),
    output_language: outputLanguage,
    output_language_name: inferLanguageDisplayName(outputLanguage),
    content_type_inline: {
      code: contentType.code.trim(),
      name: contentType.name.trim(),
      description: contentType.description,
      fields: contentType.fields.map(field => ({
        ...field,
        ...(field.options ? { options: field.options.slice() } : {}),
      })),
      ai_output_profiles: cloneAiOutputProfiles(profiles),
    },
  }
}
