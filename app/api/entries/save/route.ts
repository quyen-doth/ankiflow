import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminDb } from '@/lib/firebase-admin'
import { withAuth } from '@/lib/auth-guard'

const saveSchema = z.object({
  entryData: z.record(z.string(), z.unknown()),
  anki_note_ids: z.array(z.number()).optional(),
  status: z.enum(['draft', 'reviewed', 'synced']).optional(),
})

export const POST = withAuth(async (request, _ctx, uid) => {
  try {
    const parsed = saveSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', issues: parsed.error.issues },
        { status: 400 },
      )
    }
    const { entryData, anki_note_ids, status } = parsed.data

    const db = getAdminDb()

    const newEntry = {
      ...entryData,
      user_id: uid,
      status: status ?? 'reviewed',
      anki_note_ids: anki_note_ids ?? [],
      created_at: new Date(),
      updated_at: new Date(),
    }

    const docRef = await db.collection('entries').add(newEntry)

    return NextResponse.json({ success: true, entryId: docRef.id })
  } catch (error) {
    console.error('Save entry error:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
})
