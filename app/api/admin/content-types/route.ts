import { withAuth } from '@/lib/auth-guard'
import { NextRequest } from 'next/server'
import { getAdminDb } from '@/lib/firebase-admin'
import { withTimestamps } from '@/lib/firestore-helpers'
import { apiSuccess, catchError } from '@/lib/api-response'
import { parseBody, ContentTypePutSchema } from '@/lib/validation'

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
    const parsed = parseBody(ContentTypePutSchema, await request.json())
    if (!parsed.ok) return parsed.response

    const { id, fields } = parsed.data
    const db = getAdminDb()
    await db.collection('content_types').doc(id).update(
      withTimestamps({ fields }, false)
    )
    return apiSuccess({ success: true, id })
  } catch (error) {
    return catchError(error)
  }
}

export const GET = withAuth(GET_handler)
export const PUT = withAuth(PUT_handler)
