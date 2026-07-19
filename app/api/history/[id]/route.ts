import { withAuth } from '@/lib/auth-guard'
import { NextRequest } from 'next/server'
import { getAdminDb } from '@/lib/firebase-admin'
import { withTimestamps } from '@/lib/firestore-helpers'
import { apiSuccess, apiError, catchError } from '@/lib/api-response'

type RouteContext = { params: Promise<Record<string, string>> }

/**
 * Ownership check: entry が存在し、かつ現在の user の所有であれば docRef を返す。
 * 他 user の entry には 404 を返す (403 ではない) — 存在自体を漏らさない。
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
    // body 経由での所有者変更は許可しない
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
