import { withAuthGuard } from '@/lib/auth-guard'
import { NextRequest } from 'next/server'
import { getAdminDb } from '@/lib/firebase-admin'
import { withTimestamps } from '@/lib/firestore-helpers'
import { apiSuccess, apiError, catchError } from '@/lib/api-response'
import { parseBody, CategoryPostSchema, CategoryPutSchema } from '@/lib/validation'

async function GET_handler(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const formType = searchParams.get('form_type')

    const db = getAdminDb()
    let query: FirebaseFirestore.Query = db.collection('categories')
    if (formType) query = query.where('form_type', '==', formType)
    query = query.orderBy('sort_order', 'asc')

    const snapshot = await query.get()
    const categories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    return apiSuccess({ categories })
  } catch (error) {
    return catchError(error)
  }
}

async function POST_handler(request: NextRequest) {
  try {
    const parsed = parseBody(CategoryPostSchema, await request.json())
    if (!parsed.ok) return parsed.response

    const db = getAdminDb()
    const docRef = await db.collection('categories').add(
      withTimestamps({ ...parsed.data, is_active: parsed.data.is_active ?? true }, true)
    )
    return apiSuccess({ success: true, id: docRef.id }, 201)
  } catch (error) {
    return catchError(error)
  }
}

async function PUT_handler(request: NextRequest) {
  try {
    const parsed = parseBody(CategoryPutSchema, await request.json())
    if (!parsed.ok) return parsed.response

    const { id, ...updateData } = parsed.data
    const db = getAdminDb()
    await db.collection('categories').doc(id).update(withTimestamps(updateData, false))
    return apiSuccess({ success: true, id })
  } catch (error) {
    return catchError(error)
  }
}

async function DELETE_handler(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const isActive = searchParams.get('is_active') === 'true'
    if (!id) return apiError('Missing id', 400)
    const db = getAdminDb()
    await db.collection('categories').doc(id).update(
      withTimestamps({ is_active: isActive }, false)
    )
    return apiSuccess({ success: true, id })
  } catch (error) {
    return catchError(error)
  }
}

export const GET = withAuthGuard(GET_handler)
export const POST = withAuthGuard(POST_handler)
export const PUT = withAuthGuard(PUT_handler)
export const DELETE = withAuthGuard(DELETE_handler)
