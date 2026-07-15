import { NextResponse } from 'next/server';
import { createAIAgentProvider } from '@/lib/ai-agent';
import { withAuth } from '@/lib/auth-guard';
import { readAISettings } from '@/lib/ai-settings';
import { FormType } from '@/types';
import { canonicalizeLanguageCode, inferLanguageDisplayName } from '@/lib/studyLanguages';

export const POST = withAuth(async (request) => {
  try {
    const body = await request.json();
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
      contentTypeName,
    } = body;

    if (!form_type) {
      return NextResponse.json({ error: 'form_type is required' }, { status: 400 });
    }

    if (form_type === FormType.LANGUAGE && !word) {
      return NextResponse.json({ error: 'word is required for language form' }, { status: 400 });
    }

    const languageCode = typeof language === 'string' ? canonicalizeLanguageCode(language) : null;
    if (form_type === FormType.LANGUAGE && !languageCode) {
      return NextResponse.json({ error: 'language must be a valid BCP 47 code for language form' }, { status: 400 });
    }

    if (form_type === FormType.IT && !term) {
      return NextResponse.json({ error: 'term is required for IT form' }, { status: 400 });
    }

    const isBuiltIn = Object.values(FormType).includes(form_type as FormType);
    if (!isBuiltIn && !word) {
      return NextResponse.json({ error: 'word is required' }, { status: 400 });
    }

    const outputLanguage = canonicalizeLanguageCode(
      typeof output_language === 'string' ? output_language : '',
    ) ?? 'vi';
    const requestedOutputLanguageName = typeof output_language_name === 'string'
      ? output_language_name.trim()
      : '';
    const outputLanguageName = outputLanguage === 'vi'
      ? 'Vietnamese'
      : requestedOutputLanguageName || inferLanguageDisplayName(outputLanguage);

    const { model, webSearchEnabled } = await readAISettings();
    const provider = createAIAgentProvider({ model, webSearchEnabled });
    const content = await provider.generateCard({
      word,
      term,
      form_type,
      language: languageCode ?? undefined,
      language_name,
      output_language: outputLanguage,
      output_language_name: outputLanguageName,
      topics,
      dynamicFields: dynamicFields as Record<string, string> | undefined,
      contentTypeName: contentTypeName as string | undefined,
    });

    return NextResponse.json({ content });
  } catch (error) {
    console.error('Generation Error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
})
