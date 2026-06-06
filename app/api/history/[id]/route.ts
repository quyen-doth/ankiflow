import { withAuthGuard } from '@/lib/auth-guard'
import { NextRequest } from 'next/server'
import { getAdminDb } from '@/lib/firebase-admin'
import { withTimestamps } from '@/lib/firestore-helpers'
import { apiSuccess, apiError, catchError } from '@/lib/api-response'

async function GET_handler(
  _request: NextRequest,
  context: { params: Promise<Record<string, string>> }
) {
  try {
    const { id } = await context.params
    const db = getAdminDb()
    const docRef = db.collection('entries').doc(id)
    const docSnap = await docRef.get()

    if (!docSnap.exists) {
      return apiError('Entry not found', 404)
    }
    return apiSuccess({ entry: { id: docSnap.id, ...docSnap.data() } })
  } catch (error) {
    return catchError(error)
  }
}

async function PUT_handler(
  request: NextRequest,
  context: { params: Promise<Record<string, string>> }
) {
  try {
    const { id } = await context.params
    const body = await request.json()
    const db = getAdminDb()
    await db.collection('entries').doc(id).update(withTimestamps(body, false))
    return apiSuccess({ success: true, id })
  } catch (error) {
    return catchError(error)
  }
}

async function DELETE_handler(
  _request: NextRequest,
  context: { params: Promise<Record<string, string>> }
) {
  try {
    const { id } = await context.params
    const db = getAdminDb()
    await db.collection('entries').doc(id).delete()
    return apiSuccess({ success: true, id })
  } catch (error) {
    return catchError(error)
  }
}

export const GET = withAuthGuard(GET_handler)
export const PUT = withAuthGuard(PUT_handler)
export const DELETE = withAuthGuard(DELETE_handler)
