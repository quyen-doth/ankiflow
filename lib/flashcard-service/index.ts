import { AnkiConnectProvider } from './anki-connect-provider'
import type { IFlashcardService } from './types'

// Factory — sau này thêm provider khác tại đây
export function createFlashcardService(): IFlashcardService {
  // TODO Phase 3: đọc env FLASHCARD_PROVIDER để switch provider
  return new AnkiConnectProvider(
    process.env.ANKI_CONNECT_URL ?? 'http://localhost:8765'
  )
}

// Singleton để dùng trong routes
export const flashcardService = createFlashcardService()