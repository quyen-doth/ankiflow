import { withAuthGuard } from '@/lib/auth-guard';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

async function GET_handler(request: NextRequest) {
  try {
    const db = getAdminDb();
    const snapshot = await db.collection('content_types').get();
    const contentTypes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return NextResponse.json({ contentTypes });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

async function PUT_handler(request: NextRequest) {
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

export const GET = withAuthGuard(GET_handler);

export const PUT = withAuthGuard(PUT_handler);
