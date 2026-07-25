import { NextRequest } from 'next/server'
import { getAdminDb } from '@/lib/firebase-admin'
import { withAuth } from '@/lib/auth-guard'
import { withTimestamps } from '@/lib/firestore-helpers'
import { apiError, apiSuccess, catchError } from '@/lib/api-response'
import {
  deriveEntryQueryMetadata,
  findReservedEntryQueryFields,
  reservedEntryQueryFieldsError,
} from '@/lib/entries/queryMetadata'
import type { Entry } from '@/types'

async function GET_handler(request: NextRequest, _ctx: unknown, uid: string) {
  try {
    const { searchParams } = new URL(request.url)
    const limitParam = searchParams.get('limit') || '50'
    const formType = searchParams.get('form_type')
    const categoryId = searchParams.get('category_id')
    const keyword = searchParams.get('keyword')

    const db = getAdminDb()
    let query: FirebaseFirestore.Query = db.collection('entries')

    query = query.where('user_id', '==', uid)
    if (formType) query = query.where('form_type', '==', formType)
    if (categoryId) query = query.where('category_id', '==', categoryId)
    query = query.orderBy('created_at', 'desc').limit(parseInt(limitParam, 10))

    const snapshot = await query.get()
    let entries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Entry))

    if (keyword) {
      const lowerKeyword = keyword.toLowerCase()
      entries = entries.filter((entry: Entry) =>
        (entry.word ?? '').toLowerCase().includes(lowerKeyword) ||
        (entry.term ?? '').toLowerCase().includes(lowerKeyword) ||
        (entry.meaning_vi ?? '').toLowerCase().includes(lowerKeyword) ||
        (entry.pinyin ?? '').toLowerCase().includes(lowerKeyword)
      )
    }

    return apiSuccess({ entries })
  } catch (error) {
    console.error('Fetch History Error:', error)
    return catchError(error)
  }
}

async function POST_handler(request: NextRequest, _ctx: unknown, uid: string) {
  try {
    const body: unknown = await request.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return apiError('Invalid request body', 400)
    }
    const reservedFields = findReservedEntryQueryFields(body)
    if (reservedFields.length > 0) {
      return apiError(reservedEntryQueryFieldsError(reservedFields), 400)
    }
    const db = getAdminDb()
    const baseEntry = { ...body, user_id: uid }
    const newEntry = withTimestamps({
      ...baseEntry,
      ...deriveEntryQueryMetadata(baseEntry),
    }, true)
    const docRef = await db.collection('entries').add(newEntry)
    return apiSuccess({ success: true, id: docRef.id }, 201)
  } catch (error) {
    console.error('Create Entry Error:', error)
    return catchError(error)
  }
}

export const GET = withAuth(GET_handler)
export const POST = withAuth(POST_handler)
