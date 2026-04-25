import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

export async function GET() {
  try {
    const db = getAdminDb();
    const snapshot = await db.collection('content_types').get();
    const contentTypes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return NextResponse.json({ contentTypes });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, fields } = body;
    if (!id || !fields) return NextResponse.json({ error: 'Missing id or fields' }, { status: 400 });

    const db = getAdminDb();
    await db.collection('content_types').doc(id).update({
      fields,
      updated_at: new Date()
    });
    
    return NextResponse.json({ success: true, id });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
