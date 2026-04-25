import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const formType = searchParams.get('form_type');

    const db = getAdminDb();
    let query: FirebaseFirestore.Query = db.collection('categories');

    if (formType) {
      query = query.where('form_type', '==', formType);
    }
    
    query = query.orderBy('sort_order', 'asc');

    const snapshot = await query.get();
    const categories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return NextResponse.json({ categories });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const db = getAdminDb();
    
    const docRef = await db.collection('categories').add({
      ...body,
      is_active: body.is_active ?? true,
      created_at: new Date(),
      updated_at: new Date()
    });
    
    return NextResponse.json({ success: true, id: docRef.id });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, ...updateData } = body;
    
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const db = getAdminDb();
    await db.collection('categories').doc(id).update({
      ...updateData,
      updated_at: new Date()
    });
    
    return NextResponse.json({ success: true, id });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const isActive = searchParams.get('is_active') === 'true';

    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const db = getAdminDb();
    await db.collection('categories').doc(id).update({
      is_active: isActive,
      updated_at: new Date()
    });
    
    return NextResponse.json({ success: true, id });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
