import { withAuthGuard } from '@/lib/auth-guard';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

async function GET_handler(
  request: NextRequest,
  context: any
) {
  try {
    const params = await context.params;
    const id = params.id;
    const db = getAdminDb();
    const docRef = db.collection('entries').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    return NextResponse.json({ entry: { id: doc.id, ...doc.data() } });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

async function PUT_handler(
  request: NextRequest,
  context: any
) {
  try {
    const params = await context.params;
    const id = params.id;
    const body = await request.json();
    const db = getAdminDb();
    const docRef = db.collection('entries').doc(id);
    
    const updateData = {
      ...body,
      updated_at: new Date()
    };

    await docRef.update(updateData);
    
    return NextResponse.json({ success: true, id });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

async function DELETE_handler(
  request: NextRequest,
  context: any
) {
  try {
    const params = await context.params;
    const id = params.id;
    const db = getAdminDb();
    await db.collection('entries').doc(id).delete();
    
    return NextResponse.json({ success: true, id });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export const GET = withAuthGuard(GET_handler);

export const PUT = withAuthGuard(PUT_handler);

export const DELETE = withAuthGuard(DELETE_handler);
