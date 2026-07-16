import { FieldValue } from 'firebase-admin/firestore'
import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-guard'
import { GLOBAL_SETTINGS_DOC_ID } from '@/lib/constants'
import { getAdminDb } from '@/lib/firebase-admin'
import { generateLineLinkCode } from '@/lib/line/link-code'

const LINK_CODE_TTL_MS = 10 * 60 * 1000

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
    const code = generateLineLinkCode()
    const expiresAt = new Date(Date.now() + LINK_CODE_TTL_MS).toISOString()
    const batch = db.batch()

    for (const document of existingCodes.docs) batch.delete(document.ref)
    // 衝突時に別ユーザーの有効なコードを上書きしないよう create precondition を使う。
    batch.create(db.collection('line_link_codes').doc(code), { uid, expires_at: expiresAt })
    await batch.commit()

    return NextResponse.json({ code, expires_at: expiresAt })
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
