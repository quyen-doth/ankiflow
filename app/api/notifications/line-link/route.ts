import { FieldValue } from 'firebase-admin/firestore'
import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-guard'
import { GLOBAL_SETTINGS_DOC_ID } from '@/lib/constants'
import { getAdminDb } from '@/lib/firebase-admin'
import { generateLineLinkCode } from '@/lib/line/link-code'

const LINK_CODE_TTL_MS = 10 * 60 * 1000
const LINK_CODE_CREATE_ATTEMPTS = 3

function isAlreadyExistsError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) return false
  const code = (error as { code?: unknown }).code
  return code === 6 || code === 'already-exists' || code === 'ALREADY_EXISTS'
}

export const POST = withAuth(async (_request, _ctx, uid) => {
  try {
    const db = getAdminDb()
    const globalSettings = await db.collection('settings').doc(GLOBAL_SETTINGS_DOC_ID).get()
    if (globalSettings.data()?.line_notifications_available === false) {
      return NextResponse.json(
        { error: 'LINE notifications are disabled by administrator' },
        { status: 403 },
      )
    }

    const existingCodes = await db.collection('line_link_codes').where('uid', '==', uid).get()
    const expiresAt = new Date(Date.now() + LINK_CODE_TTL_MS).toISOString()
    const ownCodes = new Set(existingCodes.docs.map((document) => document.id))

    for (let attempt = 0; attempt < LINK_CODE_CREATE_ATTEMPTS; attempt += 1) {
      const code = generateLineLinkCode()
      if (ownCodes.has(code)) continue

      const batch = db.batch()
      for (const document of existingCodes.docs) batch.delete(document.ref)
      // 別 user の code と衝突した場合は上書きせず、新しい code で再試行する。
      batch.create(db.collection('line_link_codes').doc(code), { uid, expires_at: expiresAt })

      try {
        await batch.commit()
        return NextResponse.json({ code, expires_at: expiresAt })
      } catch (error) {
        if (!isAlreadyExistsError(error) || attempt === LINK_CODE_CREATE_ATTEMPTS - 1) {
          throw error
        }
      }
    }

    throw new Error('Could not allocate a unique LINE link code')
  } catch (error) {
    console.error('Failed to generate LINE link code:', error)
    return NextResponse.json({ error: 'Failed to generate LINE link code' }, { status: 500 })
  }
})

export const DELETE = withAuth(async (_request, _ctx, uid) => {
  try {
    await getAdminDb().collection('settings').doc(uid).update({
      line_user_id: FieldValue.delete(),
      line_notifications_enabled: false,
      updated_at: new Date(),
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to unlink LINE account:', error)
    return NextResponse.json({ error: 'Failed to unlink LINE account' }, { status: 500 })
  }
})
