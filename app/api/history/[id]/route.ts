import { withAuth } from '@/lib/auth-guard'
import { NextRequest } from 'next/server'
import { getAdminDb } from '@/lib/firebase-admin'
import { withTimestamps } from '@/lib/firestore-helpers'
import { apiSuccess, apiError, catchError } from '@/lib/api-response'

type RouteContext = { params: Promise<Record<string, string>> }

/**
 * Ownership check: trả về docRef nếu entry tồn tại VÀ thuộc về user hiện tại.
 * Trả 404 (không phải 403) cho entry của user khác — không tiết lộ sự tồn tại.
 */
async function getOwnedEntryRef(id: string, uid: string) {
  const db = getAdminDb()
  const docRef = db.collection('entries').doc(id)
  const docSnap = await docRef.get()
  if (!docSnap.exists || docSnap.data()?.user_id !== uid) {
    return { docRef: null, docSnap: null }
  }
  return { docRef, docSnap }
}

async function GET_handler(_request: NextRequest, context: RouteContext, uid: string) {
  try {
    const { id } = await context.params
    const { docSnap } = await getOwnedEntryRef(id, uid)
    if (!docSnap) {
      return apiError('Entry not found', 404)
    }
    return apiSuccess({ entry: { id: docSnap.id, ...docSnap.data() } })
  } catch (error) {
    return catchError(error)
  }
}

async function PUT_handler(request: NextRequest, context: RouteContext, uid: string) {
  try {
    const { id } = await context.params
    const body = await request.json()
    const { docRef } = await getOwnedEntryRef(id, uid)
    if (!docRef) {
      return apiError('Entry not found', 404)
    }
    // Không cho đổi chủ sở hữu qua body
    delete body.user_id
    await docRef.update(withTimestamps(body, false))
    return apiSuccess({ success: true, id })
  } catch (error) {
    return catchError(error)
  }
}

async function DELETE_handler(_request: NextRequest, context: RouteContext, uid: string) {
  try {
    const { id } = await context.params
    const { docRef } = await getOwnedEntryRef(id, uid)
    if (!docRef) {
      return apiError('Entry not found', 404)
    }
    await docRef.delete()
    return apiSuccess({ success: true, id })
  } catch (error) {
    return catchError(error)
  }
}

export const GET = withAuth(GET_handler)
export const PUT = withAuth(PUT_handler)
export const DELETE = withAuth(DELETE_handler)
