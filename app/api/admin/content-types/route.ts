import { withAdmin, withAuth } from '@/lib/auth-guard'
import { NextRequest } from 'next/server'
import { getAdminDb } from '@/lib/firebase-admin'
import { withTimestamps } from '@/lib/firestore-helpers'
import { apiError, apiSuccess, catchError } from '@/lib/api-response'
import { parseBody, ContentTypePutSchema } from '@/lib/validation'
import {
  GLOBAL_CONTENT_TYPES_COLLECTION,
} from '@/lib/constants'
import { isProtectedGlobalContentTypeId } from '@/lib/contentTypes'
import { validateContentTypeBlueprint } from '@/lib/create/formBlueprint'

async function GET_handler() {
  try {
    const db = getAdminDb()
    const snapshot = await db.collection(GLOBAL_CONTENT_TYPES_COLLECTION).get()
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
    const ref = db.collection(GLOBAL_CONTENT_TYPES_COLLECTION).doc(id)
    const snapshot = await ref.get()
    if (!snapshot.exists) return apiError('Content type not found', 404)

    // routing key は doc ID ではなく保存済み code — global custom は auto-ID なので必須。
    const existing = snapshot.data() ?? {}
    const code = typeof existing.code === 'string' ? existing.code : id
    const name = typeof existing.name === 'string' ? existing.name : id
    const blueprintValidation = validateContentTypeBlueprint({ code, name, fields })
    if (!blueprintValidation.success) {
      return apiError(blueprintValidation.error, 400)
    }

    await ref.update(withTimestamps({ fields }, false))
    return apiSuccess({ success: true, id })
  } catch (error) {
    return catchError(error)
  }
}

async function DELETE_handler(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id')?.trim()
    if (!id) return apiError('id is required', 400)
    if (isProtectedGlobalContentTypeId(id)) {
      return apiError('Built-in content types cannot be deleted', 403)
    }

    await getAdminDb().collection(GLOBAL_CONTENT_TYPES_COLLECTION).doc(id).delete()
    return apiSuccess({ success: true, id })
  } catch (error) {
    return catchError(error)
  }
}

export const GET = withAuth(GET_handler)
export const PUT = withAdmin(PUT_handler)
export const DELETE = withAdmin(DELETE_handler)
