import { withAuthGuard } from '@/lib/auth-guard';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

async function GET_handler(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const formType = searchParams.get('form_type');
    const language = searchParams.get('language');

    const db = getAdminDb();
    let query: FirebaseFirestore.Query = db.collection('card_types');

    if (formType) query = query.where('form_type', '==', formType);
    if (language) query = query.where('language', '==', language);
    
    query = query.orderBy('sort_order', 'asc');

    const snapshot = await query.get();
    const cardTypes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return NextResponse.json({ cardTypes });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

async function POST_handler(request: NextRequest) {
  try {
    const body = await request.json();
    const db = getAdminDb();
    
    const docRef = await db.collection('card_types').add({
      ...body,
      is_active: body.is_active ?? true,
      created_at: new Date()
    });
    
    return NextResponse.json({ success: true, id: docRef.id });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

async function PUT_handler(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updateData } = body;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const db = getAdminDb();
    await db.collection('card_types').doc(id).update(updateData);
    
    return NextResponse.json({ success: true, id });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

async function DELETE_handler(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const db = getAdminDb();
    await db.collection('card_types').doc(id).delete();
    
    return NextResponse.json({ success: true, id });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export const GET = withAuthGuard(GET_handler);

export const POST = withAuthGuard(POST_handler);

export const PUT = withAuthGuard(PUT_handler);

export const DELETE = withAuthGuard(DELETE_handler);
