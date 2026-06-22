import { NextResponse } from 'next/server'
import { flashcardService } from '@/lib/flashcard-service'

const ANKIFLOW_BASIC_MODEL = 'AnkiFlow-Basic'

const CARD_CSS = `.card {
  font-family: 'Inter', -apple-system, 'Noto Sans SC', 'Noto Sans JP', sans-serif;
  font-size: 20px;
  text-align: center;
  color: #1e293b;
  background-color: #ffffff;
  padding: 24px;
}
small { font-size: 0.75em; color: #64748b; }
img { max-height: 200px; border-radius: 8px; margin: 8px auto; }
hr#answer { border: 0; height: 1px; background: #e2e8f0; margin: 20px 0; }`

export async function POST() {
  try {
    const models = await flashcardService.getModelNames()

    if (models.includes(ANKIFLOW_BASIC_MODEL)) {
      return NextResponse.json({ exists: true, created: false })
    }

    await flashcardService.createModel({
      modelName: ANKIFLOW_BASIC_MODEL,
      inOrderFields: ['Front', 'Back'],
      css: CARD_CSS,
      cardTemplates: [
        {
          Name: 'Card 1',
          Front: '{{Front}}',
          Back: '{{FrontSide}}<hr id="answer">{{Back}}',
        },
      ],
    })

    return NextResponse.json({ exists: true, created: true })
  } catch (error) {
    console.error('Ensure Model Error:', error)
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 },
    )
  }
}
