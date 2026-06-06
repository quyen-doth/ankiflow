import { withAuthGuard } from '@/lib/auth-guard'
import { NextRequest } from 'next/server'
import { getAdminDb } from '@/lib/firebase-admin'
import { withTimestamps } from '@/lib/firestore-helpers'
import { apiSuccess, apiError, catchError } from '@/lib/api-response'

async function GET_handler() {
  try {
    const db = getAdminDb()
    const snapshot = await db.collection('content_types').get()
    const contentTypes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    return apiSuccess({ contentTypes })
  } catch (error) {
    return catchError(error)
  }
}

async function PUT_handler(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, fields } = body
    if (!id || !fields) return apiError('Missing id or fields', 400)
    const db = getAdminDb()
    await db.collection('content_types').doc(id).update(
      withTimestamps({ fields }, false)
    )
    return apiSuccess({ success: true, id })
  } catch (error) {
    return catchError(error)
  }
}

export const GET = withAuthGuard(GET_handler)
export const PUT = withAuthGuard(PUT_handler)
