import { NextResponse } from 'next/server';
import { searchImages } from '@/lib/unsplash';
import { withAuth } from '@/lib/auth-guard';
import { getAdminDb } from '@/lib/firebase-admin';
import { GLOBAL_SETTINGS_DOC_ID } from '@/lib/constants';

/** Cổng chi phí: admin có thể tắt Unsplash cho mọi user qua /api/admin/global-config. Fail-open nếu doc chưa seed. */
async function isUnsplashAvailable(): Promise<boolean> {
  try {
    const snap = await getAdminDb().collection('settings').doc(GLOBAL_SETTINGS_DOC_ID).get();
    const data = snap.data();
    return (data?.unsplash_available as boolean | undefined) ?? true;
  } catch {
    return true;
  }
}

export const GET = withAuth(async (request) => {
  try {
    if (!(await isUnsplashAvailable())) {
      return NextResponse.json({ error: 'Image search is disabled by the administrator' }, { status: 403 });
    }

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
