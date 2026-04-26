export interface IFlashcardService {
  ping(): Promise<{ connected: boolean; version?: number }>
  getDecks(): Promise<string[]>
  addNotes(notes: AnkiNote[]): Promise<number[]>
  storeMediaFile(filename: string, base64Data: string): Promise<string>
}

export interface AnkiNote {
  deckName: string
  modelName: string
  fields: Record<string, string>
  tags?: string[]
}