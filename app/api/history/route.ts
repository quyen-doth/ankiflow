import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit') || '50';
    const formType = searchParams.get('form_type');
    const categoryId = searchParams.get('category_id');
    const keyword = searchParams.get('keyword');

    const db = getAdminDb();
    let query: FirebaseFirestore.Query = db.collection('entries');

    if (formType) {
      query = query.where('form_type', '==', formType);
    }
    if (categoryId) {
      query = query.where('category_id', '==', categoryId);
    }
    
    query = query.orderBy('created_at', 'desc').limit(parseInt(limitParam, 10));

    const snapshot = await query.get();
    let entries = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Client-side like search for keyword since Firestore doesn't support native partial text search easily
    if (keyword) {
      const lowerKeyword = keyword.toLowerCase();
      entries = entries.filter((entry: any) => 
        (entry.word && entry.word.toLowerCase().includes(lowerKeyword)) ||
        (entry.term && entry.term.toLowerCase().includes(lowerKeyword)) ||
        (entry.meaning_vi && entry.meaning_vi.toLowerCase().includes(lowerKeyword)) ||
        (entry.pinyin && entry.pinyin.toLowerCase().includes(lowerKeyword))
      );
    }

    return NextResponse.json({ entries });
  } catch (error) {
    console.error('Fetch History Error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const db = getAdminDb();
    
    const newEntry = {
      ...body,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const docRef = await db.collection('entries').add(newEntry);
    
    return NextResponse.json({ success: true, id: docRef.id });
  } catch (error) {
    console.error('Create Entry Error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
