import { withAuthGuard } from '@/lib/auth-guard'
import { NextRequest } from 'next/server'
import { getAdminDb } from '@/lib/firebase-admin'
import { withTimestamps } from '@/lib/firestore-helpers'
import { apiSuccess, apiError, catchError } from '@/lib/api-response'

async function GET_handler(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const formType = searchParams.get('form_type')

    const db = getAdminDb()
    let query: FirebaseFirestore.Query = db.collection('decks')
    if (formType) query = query.where('form_type', '==', formType)
    query = query.orderBy('sort_order', 'asc')

    const snapshot = await query.get()
    const decks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    return apiSuccess({ decks })
  } catch (error) {
    return catchError(error)
  }
}

async function POST_handler(request: NextRequest) {
  try {
    const body = await request.json()
    const db = getAdminDb()
    const docRef = await db.collection('decks').add(
      withTimestamps({ ...body, is_active: body.is_active ?? true }, true)
    )
    return apiSuccess({ success: true, id: docRef.id }, 201)
  } catch (error) {
    return catchError(error)
  }
}

async function PUT_handler(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...updateData } = body
    if (!id) return apiError('Missing id', 400)
    const db = getAdminDb()
    await db.collection('decks').doc(id).update(withTimestamps(updateData, false))
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
    await db.collection('decks').doc(id).delete()
    return apiSuccess({ success: true, id })
  } catch (error) {
    return catchError(error)
  }
}

export const GET = withAuthGuard(GET_handler)
export const POST = withAuthGuard(POST_handler)
export const PUT = withAuthGuard(PUT_handler)
export const DELETE = withAuthGuard(DELETE_handler)
