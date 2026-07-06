import { withAuth } from '@/lib/auth-guard'
import { NextRequest } from 'next/server'
import { getAdminDb } from '@/lib/firebase-admin'
import { withTimestamps } from '@/lib/firestore-helpers'
import { apiSuccess, apiError, catchError } from '@/lib/api-response'
import { parseBody, CardTypePostSchema, CardTypePutSchema } from '@/lib/validation'

async function GET_handler(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const formType = searchParams.get('form_type')
    const language = searchParams.get('language')

    const db = getAdminDb()
    let query: FirebaseFirestore.Query = db.collection('card_types')
    if (formType) query = query.where('form_type', '==', formType)
    if (language) query = query.where('language', '==', language)
    query = query.orderBy('sort_order', 'asc')

    const snapshot = await query.get()
    const cardTypes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    return apiSuccess({ cardTypes })
  } catch (error) {
    return catchError(error)
  }
}

async function POST_handler(request: NextRequest) {
  try {
    const parsed = parseBody(CardTypePostSchema, await request.json())
    if (!parsed.ok) return parsed.response

    const db = getAdminDb()
    const docRef = await db.collection('card_types').add(
      withTimestamps({ ...parsed.data, is_active: parsed.data.is_active ?? true }, true)
    )
    return apiSuccess({ success: true, id: docRef.id }, 201)
  } catch (error) {
    return catchError(error)
  }
}

async function PUT_handler(request: NextRequest) {
  try {
    const parsed = parseBody(CardTypePutSchema, await request.json())
    if (!parsed.ok) return parsed.response

    const { id, ...updateData } = parsed.data
    const db = getAdminDb()
    await db.collection('card_types').doc(id).update(withTimestamps(updateData, false))
    return apiSuccess({ success: true, id })
  } catch (error) {
    return catchError(error)
  }
}

async function DELETE_handler(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return apiError('Missing id', 400)
    const db = getAdminDb()
    await db.collection('card_types').doc(id).delete()
    return apiSuccess({ success: true, id })
  } catch (error) {
    return catchError(error)
  }
}

export const GET = withAuth(GET_handler)
export const POST = withAuth(POST_handler)
export const PUT = withAuth(PUT_handler)
export const DELETE = withAuth(DELETE_handler)
