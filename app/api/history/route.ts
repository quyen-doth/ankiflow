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
import {
  InvalidHistoryCursorError,
  loadHistoryPage,
  parseHistoryListParams,
} from '@/lib/history/historyQuery'

async function GET_handler(request: NextRequest, _ctx: unknown, uid: string) {
  const parsed = parseHistoryListParams(new URL(request.url))
  if (!parsed.success) {
    return apiError('Invalid query parameters', 400)
  }

  try {
    return apiSuccess(await loadHistoryPage(getAdminDb(), uid, parsed.data))
  } catch (error) {
    if (error instanceof InvalidHistoryCursorError) {
      return apiError('Invalid cursor', 400)
    }
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
