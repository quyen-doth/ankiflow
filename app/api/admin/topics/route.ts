import { withAuthGuard } from '@/lib/auth-guard'
import { NextRequest } from 'next/server'
import { getAdminDb } from '@/lib/firebase-admin'
import { withTimestamps } from '@/lib/firestore-helpers'
import { apiSuccess, apiError, catchError } from '@/lib/api-response'
import { parseBody, TopicPostSchema, TopicPutSchema } from '@/lib/validation'

async function GET_handler() {
  try {
    const db = getAdminDb()
    const snapshot = await db.collection('topics').orderBy('name', 'asc').get()
    const topics = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    return apiSuccess({ topics })
  } catch (error) {
    return catchError(error)
  }
}

async function POST_handler(request: NextRequest) {
  try {
    const parsed = parseBody(TopicPostSchema, await request.json())
    if (!parsed.ok) return parsed.response

    const db = getAdminDb()
    const docRef = await db.collection('topics').add(
      withTimestamps({ ...parsed.data, is_active: parsed.data.is_active ?? true }, true)
    )
    return apiSuccess({ success: true, id: docRef.id }, 201)
  } catch (error) {
    return catchError(error)
  }
}

async function PUT_handler(request: NextRequest) {
  try {
    const parsed = parseBody(TopicPutSchema, await request.json())
    if (!parsed.ok) return parsed.response

    const { id, ...updateData } = parsed.data
    const db = getAdminDb()
    await db.collection('topics').doc(id).update(withTimestamps(updateData, false))
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
    await db.collection('topics').doc(id).delete()
    return apiSuccess({ success: true, id })
  } catch (error) {
    return catchError(error)
  }
}

export const GET = withAuthGuard(GET_handler)
export const POST = withAuthGuard(POST_handler)
export const PUT = withAuthGuard(PUT_handler)
export const DELETE = withAuthGuard(DELETE_handler)
