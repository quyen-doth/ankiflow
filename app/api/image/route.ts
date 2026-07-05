import { NextResponse } from 'next/server';
import { searchImages } from '@/lib/unsplash';
import { withAuth } from '@/lib/auth-guard';

export const GET = withAuth(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const keyword = searchParams.get('keyword');
    const count = searchParams.get('count') ? parseInt(searchParams.get('count') as string, 10) : 5;

    if (!keyword) {
      return NextResponse.json({ error: 'Keyword is required' }, { status: 400 });
    }

    const images = await searchImages(keyword, count);
    
    return NextResponse.json({ images });
  } catch (error) {
    console.error('Unsplash API Error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
})
