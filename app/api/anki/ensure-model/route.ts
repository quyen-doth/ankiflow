import { NextResponse } from 'next/server'
import { flashcardService } from '@/lib/flashcard-service'
import { ANKI_MODEL_NAME, ANKI_MODEL_FIELDS, ANKI_CARD_TEMPLATES, ANKI_CARD_CSS } from '@/lib/anki/model'

export async function POST() {
  try {
    const models = await flashcardService.getModelNames()

    if (models.includes(ANKI_MODEL_NAME)) {
      // Model đã tồn tại → sync CSS + template để cập nhật card cũ
      await Promise.all([
        flashcardService.updateModelStyling(ANKI_MODEL_NAME, ANKI_CARD_CSS),
        flashcardService.updateModelTemplates(ANKI_MODEL_NAME, ANKI_CARD_TEMPLATES),
      ])
      return NextResponse.json({ exists: true, created: false, synced: true })
    }

    await flashcardService.createModel({
      modelName: ANKI_MODEL_NAME,
      inOrderFields: ANKI_MODEL_FIELDS,
      css: ANKI_CARD_CSS,
      cardTemplates: ANKI_CARD_TEMPLATES,
    })

    return NextResponse.json({ exists: true, created: true, synced: false })
  } catch (error) {
    console.error('Ensure Model Error:', error)
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 },
    )
  }
}
