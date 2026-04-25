import os

base_dir = "/Users/hong-quyen/Documents/study/flashcard/ankiflow"

def write_file(path, content):
    full_path = os.path.join(base_dir, path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, "w", encoding="utf-8") as f:
        f.write(content)

# 1. Categories
write_file("app/api/admin/categories/route.ts", """import { NextResponse } from 'next/server';
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
""")

# 2. Card Types
write_file("app/api/admin/card-types/route.ts", """import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

export async function GET(request: Request) {
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

export async function POST(request: Request) {
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

export async function PUT(request: Request) {
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

export async function DELETE(request: Request) {
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
""")

# 3. Topics
write_file("app/api/admin/topics/route.ts", """import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

export async function GET() {
  try {
    const db = getAdminDb();
    const snapshot = await db.collection('topics').orderBy('name', 'asc').get();
    const topics = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return NextResponse.json({ topics });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const db = getAdminDb();
    
    const docRef = await db.collection('topics').add(body);
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
    await db.collection('topics').doc(id).update(updateData);
    return NextResponse.json({ success: true, id });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const db = getAdminDb();
    await db.collection('topics').doc(id).delete();
    return NextResponse.json({ success: true, id });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
""")

# 4. Decks
write_file("app/api/admin/decks/route.ts", """import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

export async function GET() {
  try {
    const db = getAdminDb();
    const snapshot = await db.collection('decks').get();
    const decks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return NextResponse.json({ decks });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const db = getAdminDb();
    
    const docRef = await db.collection('decks').add(body);
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
    await db.collection('decks').doc(id).update(updateData);
    return NextResponse.json({ success: true, id });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const db = getAdminDb();
    await db.collection('decks').doc(id).delete();
    return NextResponse.json({ success: true, id });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
""")

# 5. Content Types
write_file("app/api/admin/content-types/route.ts", """import { NextResponse } from 'next/server';
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
""")

# 6. Session Logic
write_file("lib/session.ts", """import { FormType } from "@/types";

export interface SessionState {
  categoryId?: string;
  language?: string;
  deckId?: string;
  cardTypeIds?: string[];
  topicIds?: string[];
  difficulty?: string;
  tags?: string[];
  [key: string]: any;
}

const getStorageKey = (formType: FormType) => `ankiflow_session_${formType}`;

export const saveSession = (formType: FormType, data: SessionState) => {
  if (typeof window === 'undefined') return;
  try {
    const existing = loadSession(formType) || {};
    const updated = { ...existing, ...data };
    localStorage.setItem(getStorageKey(formType), JSON.stringify(updated));
  } catch (e) {
    console.error("Error saving session", e);
  }
};

export const loadSession = (formType: FormType): SessionState | null => {
  if (typeof window === 'undefined') return null;
  try {
    const item = localStorage.getItem(getStorageKey(formType));
    return item ? JSON.parse(item) : null;
  } catch (e) {
    console.error("Error loading session", e);
    return null;
  }
};

export const clearSession = (formType: FormType) => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(getStorageKey(formType));
};

export const resetContentFields = (formType: FormType) => {
  if (typeof window === 'undefined') return;
  const current = loadSession(formType);
  if (!current) return;

  const preservedFields = ['categoryId', 'language', 'deckId', 'cardTypeIds', 'topicIds', 'difficulty', 'tags'];
  const newSession: SessionState = {};

  preservedFields.forEach(field => {
    if (current[field] !== undefined) {
      newSession[field] = current[field];
    }
  });

  localStorage.setItem(getStorageKey(formType), JSON.stringify(newSession));
  return newSession;
};
""")

write_file("hooks/useSession.ts", """"use client";

import { useState, useEffect, useCallback } from 'react';
import { FormType } from '@/types';
import { loadSession, saveSession, clearSession, resetContentFields, SessionState } from '@/lib/session';

export function useSession(formType: FormType) {
  const [session, setSessionState] = useState<SessionState | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const initialSession = loadSession(formType);
    if (initialSession) {
      setSessionState(initialSession);
    }
    setIsLoaded(true);
  }, [formType]);

  const updateSession = useCallback((data: Partial<SessionState>) => {
    setSessionState(prev => {
      const newState = { ...(prev || {}), ...data };
      saveSession(formType, newState);
      return newState;
    });
  }, [formType]);

  const clear = useCallback(() => {
    clearSession(formType);
    setSessionState(null);
  }, [formType]);

  const resetContent = useCallback(() => {
    const newSession = resetContentFields(formType);
    setSessionState(newSession || null);
  }, [formType]);

  return {
    session,
    isLoaded,
    updateSession,
    clear,
    resetContent
  };
}
""")

print("DONE")
