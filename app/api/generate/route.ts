import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAIAgentProvider } from '@/lib/ai-agent'
import { withAuth } from '@/lib/auth-guard'
import { readAISettings } from '@/lib/ai-settings'
import { getAdminDb } from '@/lib/firebase-admin'
import {
  generationContentTypeInlineSchema,
  parseGenerationContentTypeDocument,
  parseInlineGenerationContentType,
} from '@/lib/ai-agent/contentTypeDefinition'
import { CONTENT_TYPE_CODE_PATTERN, USER_CONTENT_TYPES_COLLECTION } from '@/lib/constants'
import { FormType } from '@/types'
import { canonicalizeLanguageCode, inferLanguageDisplayName } from '@/lib/studyLanguages'
import type { EngineDefinition } from '@/lib/ai-agent/promptEngine'

const dynamicFieldsSchema = z.record(
  z.string().trim().min(1).max(40).refine(
    key => !['__proto__', 'prototype', 'constructor'].includes(key),
    'dynamic field key is reserved',
  ),
  z.string().max(2_000),
).superRefine((fields, ctx) => {
  if (Object.keys(fields).length > 40) {
    ctx.addIssue({
      code: 'custom',
      path: [],
      message: 'dynamicFields must contain at most 40 fields',
    })
  }
})

const generateRequestSchema = z.object({
  word: z.string().trim().min(1).max(500).optional(),
  term: z.string().trim().min(1).max(500).optional(),
  form_type: z.string().trim().min(1).max(40).regex(CONTENT_TYPE_CODE_PATTERN),
  language: z.string().trim().min(1).max(64).optional(),
  language_name: z.string().trim().max(100).optional(),
  output_language: z.string().trim().min(1).max(64).optional(),
  output_language_name: z.string().trim().max(100).optional(),
  topics: z.array(z.string().trim().min(1).max(100)).max(50).optional(),
  dynamicFields: dynamicFieldsSchema.optional(),
  contentTypeName: z.string().trim().max(100).optional(),
  content_type_id: z.string().trim().min(1).max(200).refine(
    id => !id.includes('/'),
    'content_type_id must be a Firestore document ID',
  ).optional(),
  content_type_inline: generationContentTypeInlineSchema.optional(),
})

export const POST = withAuth(async (request, _ctx, uid) => {
  let requestBody: unknown
  try {
    requestBody = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsedRequest = generateRequestSchema.safeParse(requestBody)
  if (!parsedRequest.success) {
    return NextResponse.json(
      { error: 'Invalid request body', issues: parsedRequest.error.issues },
      { status: 400 },
    )
  }

  const {
    word,
    term,
    form_type,
    language,
    language_name,
    output_language,
    output_language_name,
    topics,
    dynamicFields,
    content_type_id,
    content_type_inline,
  } = parsedRequest.data

  if (form_type === FormType.LANGUAGE && !word) {
    return NextResponse.json({ error: 'word is required for language form' }, { status: 400 })
  }

  const languageCode = language ? canonicalizeLanguageCode(language) : null
  if (form_type === FormType.LANGUAGE && !languageCode) {
    return NextResponse.json(
      { error: 'language must be a valid BCP 47 code for language form' },
      { status: 400 },
    )
  }

  if (form_type === FormType.IT && !term) {
    return NextResponse.json({ error: 'term is required for IT form' }, { status: 400 })
  }

  const isBuiltIn = Object.values(FormType).includes(form_type as FormType)
  if (!isBuiltIn && !word) {
    return NextResponse.json({ error: 'word is required' }, { status: 400 })
  }

  let authoritativeName = parsedRequest.data.contentTypeName
  let contentTypeDefinition: EngineDefinition | undefined
  if (content_type_inline) {
    try {
      const contentType = parseInlineGenerationContentType(content_type_inline)
      if (contentType.routingCode !== form_type) {
        return NextResponse.json(
          { error: 'Inline content type does not match form_type' },
          { status: 400 },
        )
      }
      authoritativeName = contentType.name
      contentTypeDefinition = contentType.definition
    } catch (error) {
      console.error('Invalid inline content type:', error)
      return NextResponse.json(
        { error: 'Inline content type configuration is invalid' },
        { status: 400 },
      )
    }
  } else if (content_type_id) {
    const snapshot = await getAdminDb()
      .collection(USER_CONTENT_TYPES_COLLECTION)
      .doc(content_type_id)
      .get()
    const stored = snapshot.data()
    if (!snapshot.exists || stored?.user_id !== uid) {
      return NextResponse.json({ error: 'Content type not found' }, { status: 404 })
    }

    try {
      const contentType = parseGenerationContentTypeDocument(stored)
      if (contentType.routingCode !== form_type) {
        return NextResponse.json(
          { error: 'Content type does not match form_type' },
          { status: 400 },
        )
      }
      authoritativeName = contentType.name
      contentTypeDefinition = contentType.definition
    } catch (error) {
      console.error(`Invalid ${USER_CONTENT_TYPES_COLLECTION}/${content_type_id}:`, error)
      return NextResponse.json(
        { error: 'Stored content type configuration is invalid' },
        { status: 400 },
      )
    }
  }

  const outputLanguage = canonicalizeLanguageCode(output_language ?? '') ?? 'vi'
  const outputLanguageName = outputLanguage === 'vi'
    ? 'Vietnamese'
    : output_language_name || inferLanguageDisplayName(outputLanguage)

  try {
    const { model, webSearchEnabled } = await readAISettings()
    const provider = createAIAgentProvider({ model, webSearchEnabled })
    const content = await provider.generateCard({
      word,
      term,
      form_type,
      language: languageCode ?? undefined,
      language_name,
      output_language: outputLanguage,
      output_language_name: outputLanguageName,
      topics,
      dynamicFields,
      contentTypeName: authoritativeName,
      content_type: contentTypeDefinition,
    })

    return NextResponse.json({ content })
  } catch (error) {
    console.error('Generation Error:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
})
