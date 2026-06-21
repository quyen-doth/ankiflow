import { NextResponse } from 'next/server';
import { createAIAgentProvider } from '@/lib/ai-agent';
import { getAdminDb } from '@/lib/firebase-admin';
import { FormType } from '@/types';

// Đọc cấu hình AI từ settings singleton (server-side). Lỗi → dùng mặc định an toàn.
async function readAISettings(): Promise<{ model: string | null; webSearchEnabled: boolean }> {
  try {
    const snap = await getAdminDb().collection('settings').doc('default').get();
    const data = snap.data();
    return {
      model: (data?.ai_model as string | undefined) ?? null,
      webSearchEnabled: (data?.web_search_enabled as boolean | undefined) ?? false,
    };
  } catch (error) {
    console.warn('Could not read AI settings, using defaults:', error);
    return { model: null, webSearchEnabled: false };
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { word, term, form_type, language, topics, dynamicFields, contentTypeName } = body;

    if (!form_type) {
      return NextResponse.json({ error: 'form_type is required' }, { status: 400 });
    }

    if (form_type === FormType.LANGUAGE && !word) {
      return NextResponse.json({ error: 'word is required for language form' }, { status: 400 });
    }

    if (form_type === FormType.IT && !term) {
      return NextResponse.json({ error: 'term is required for IT form' }, { status: 400 });
    }

    const isBuiltIn = Object.values(FormType).includes(form_type as FormType);
    if (!isBuiltIn && !word) {
      return NextResponse.json({ error: 'word is required' }, { status: 400 });
    }

    const { model, webSearchEnabled } = await readAISettings();
    const provider = createAIAgentProvider({ model, webSearchEnabled });
    const content = await provider.generateCard({
      word, term, form_type, language, topics,
      dynamicFields: dynamicFields as Record<string, string> | undefined,
      contentTypeName: contentTypeName as string | undefined,
    });

    return NextResponse.json({ content });
  } catch (error) {
    console.error('Generation Error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
