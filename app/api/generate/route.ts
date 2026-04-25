import { NextResponse } from 'next/server';
import { generateCardContent } from '@/lib/gemini';
import { FormType } from '@/types';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { word, term, form_type, language, topics } = body;

    if (!form_type) {
      return NextResponse.json({ error: 'form_type is required' }, { status: 400 });
    }

    if (form_type === FormType.LANGUAGE && !word) {
      return NextResponse.json({ error: 'word is required for language form' }, { status: 400 });
    }

    if (form_type === FormType.IT && !term) {
      return NextResponse.json({ error: 'term is required for IT form' }, { status: 400 });
    }

    const content = await generateCardContent({ word, term, form_type, language, topics });
    
    return NextResponse.json({ content });
  } catch (error) {
    console.error('Generation Error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
